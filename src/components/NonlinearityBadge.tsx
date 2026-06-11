"use client";

// ── Types ─────────────────────────────────────────────────────────────────────

type ParsedNonlinearity = {
  type: "Inactive" | "transAT" | "Iteration" | "ModuleSkip" | "Missing" | "Halogenation" | "Unknown";
  domains?: string[];          // Inactive / Missing
  gene?: string;               // transAT
  substrate?: string;          // transAT
  rounds?: IterationRound[];   // Iteration
  raw?: string;                // fallback / Halogenation
};

type IterationRound = {
  domains: string[];
  extender: string;
};

// ── Domain color map ──────────────────────────────────────────────────────────

const domainColor: Record<string, { bg: string; color: string }> = {
  KR:   { bg: "#dbeafe", color: "#1d4ed8" },
  DH:   { bg: "#dcfce7", color: "#15803d" },
  ER:   { bg: "#ede9fe", color: "#6d28d9" },
  MT:   { bg: "#ffedd5", color: "#c2410c" },
  cMT:  { bg: "#ffedd5", color: "#c2410c" },
  oMT:  { bg: "#ffedd5", color: "#a16207" },
  ACP:  { bg: "#f3f4f6", color: "#4b5563" },
  KS:   { bg: "#cffafe", color: "#0e7490" },
  AT:   { bg: "#fce7f3", color: "#9d174d" },
  TE:   { bg: "#fef3c7", color: "#92400e" },
  PCP:  { bg: "#f3f4f6", color: "#4b5563" },
  C:    { bg: "#f0fdf4", color: "#166534" },
  A:    { bg: "#fdf4ff", color: "#7e22ce" },
  E:    { bg: "#eff6ff", color: "#1e40af" },
};

const defaultDomainStyle = { bg: "#f1f5f9", color: "#475569" };

function domainStyle(d: string) {
  return domainColor[d.trim()] ?? domainColor[d.trim().toUpperCase()] ?? defaultDomainStyle;
}

// ── Parser ────────────────────────────────────────────────────────────────────

/**
 * Extracts the value of a key from a Python-style dict string by scanning
 * bracket depth rather than regex, so nested lists/tuples don't confuse it.
 */
function extractValue(src: string, key: string): string | null {
  const keyRe = new RegExp(`['"]${key}['"]\\s*:\\s*`);
  const km = keyRe.exec(src);
  if (!km) return null;

  let i = km.index + km[0].length;
  const start = i;
  let depth = 0;
  let inStr = false;
  let strChar = "";

  while (i < src.length) {
    const c = src[i];
    if (inStr) {
      if (c === strChar) inStr = false;
    } else if (c === "'" || c === '"') {
      inStr = true;
      strChar = c;
    } else if (c === "(" || c === "[" || c === "{") {
      depth++;
    } else if (c === ")" || c === "]" || c === "}") {
      if (depth === 0) break;        // hit the closing brace of the parent dict
      depth--;
      if (depth === 0) { i++; break; } // value just closed (list/tuple ended)
    } else if (c === "," && depth === 0) {
      break; // comma at top level = next key
    }
    i++;
  }

  return src.slice(start, i).trim();
}

/**
 * Parse a Python list of strings like `['KR', 'DH']`
 * Returns string array.
 */
function parsePyStringList(src: string): string[] {
  const inner = src.replace(/^\[|\]$/g, "").trim();
  if (!inner) return [];
  const items: string[] = [];
  for (const m of inner.matchAll(/'([^']+)'|"([^"]+)"/g)) {
    items.push((m[1] ?? m[2]).trim());
  }
  return items;
}

/**
 * Parse transAT value: `['gene', 'substrate']` or `[None, 'substrate']`
 */
function parseTransAT(src: string): { gene: string; substrate: string } {
  const items = parsePyStringList(src);
  // src may also contain None literal
  const noneGene = /\[\s*None\s*,/.test(src);
  return {
    gene: noneGene ? "" : (items[0] ?? ""),
    substrate: items[1] ?? items[0] ?? "",
  };
}

/**
 * Parse Iteration value:
 * `[(('KR', 'DH'), 'Malonyl-CoA'), ((), 'Malonyl-CoA')]`
 * Each element is a tuple `((domains...), extender)`.
 */
function parseIteration(src: string): IterationRound[] {
  const rounds: IterationRound[] = [];
  // Match each outer tuple: ((...), 'extender')
  // Use a simple approach: find outer-level tuple groups
  let depth = 0;
  let start = -1;
  for (let i = 0; i < src.length; i++) {
    if (src[i] === "(") {
      if (depth === 0) start = i;
      depth++;
    } else if (src[i] === ")") {
      depth--;
      if (depth === 0 && start !== -1) {
        const chunk = src.slice(start, i + 1);
        // Each chunk looks like: (('KR', 'DH'), 'Malonyl-CoA')
        // Extract inner domain tuple and extender
        const domainTupleMatch = /\(([^)]*)\)/.exec(chunk);
        const domains = domainTupleMatch
          ? parsePyStringList(domainTupleMatch[1])
          : [];
        // Extender: last quoted string after the domain tuple
        const rest = chunk.slice(
          (domainTupleMatch?.index ?? 0) + (domainTupleMatch?.[0].length ?? 0)
        );
        const extMatch = /'([^']+)'|"([^"]+)"/.exec(rest);
        const extender = extMatch ? (extMatch[1] ?? extMatch[2]) : "";
        if (extender || domains.length > 0) {
          rounds.push({ domains, extender });
        }
        start = -1;
      }
    }
  }
  return rounds;
}

/**
 * Top-level parser: returns array of ParsedNonlinearity (one per key in the dict).
 */
export function parseNonlinearity(raw: string | null): ParsedNonlinearity[] {
  if (!raw) return [];

  let s = raw.trim();
  // Normalize BEFORE extractValue: curly quotes from Excel → straight ASCII quotes,
  // and malformed iteration entries missing their outer '(' are repaired so that
  // extractValue's bracket-depth scanner doesn't terminate prematurely on unmatched ')'.
  s = s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"');
  s = s.replace(/,(\s*)\(None\),/g, ',$1((None),');

  // ── Plain-text cases (not a Python dict) ──────────────────────────────────
  if (!s.startsWith("{")) {
    const lower = s.toLowerCase();
    if (lower.includes("halogenation") || lower.includes("halogen")) {
      return [{ type: "Halogenation", raw: s }];
    }
    return [{ type: "Unknown", raw: s }];
  }

  const results: ParsedNonlinearity[] = [];

  // ── Keys to detect ────────────────────────────────────────────────────────
  const keyPatterns: Array<{
    key: string;
    canonical: ParsedNonlinearity["type"];
  }> = [
    { key: "Inactive", canonical: "Inactive" },
    { key: "Missing",  canonical: "Missing"  },
    { key: "transAT",  canonical: "transAT"  },
    { key: "Iteration",canonical: "Iteration"},
    { key: "iteration",canonical: "Iteration"},
    { key: "ModuleSkip",canonical:"ModuleSkip"},
  ];

  for (const { key, canonical } of keyPatterns) {
    if (!new RegExp(`['"]${key}['"]`).test(s)) continue;

    const valRaw = extractValue(s, key);
    if (valRaw === null) {
      results.push({ type: canonical, raw: s });
      continue;
    }

    if (canonical === "Inactive" || canonical === "Missing") {
      const domains = parsePyStringList(valRaw);
      results.push({ type: canonical, domains, raw: valRaw });
    } else if (canonical === "transAT") {
      const { gene, substrate } = parseTransAT(valRaw);
      results.push({ type: "transAT", gene, substrate, raw: valRaw });
    } else if (canonical === "Iteration") {
      const rounds = parseIteration(valRaw);
      results.push({ type: "Iteration", rounds, raw: valRaw });
    } else if (canonical === "ModuleSkip") {
      results.push({ type: "ModuleSkip", raw: valRaw });
    }
  }

  if (results.length === 0) {
    results.push({ type: "Unknown", raw: s });
  }

  return results;
}

// ── Sub-renderers ─────────────────────────────────────────────────────────────

function DomainPill({ d }: { d: string }) {
  const { bg, color } = domainStyle(d);
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 6px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: 600,
        backgroundColor: bg,
        color,
        fontFamily: "monospace",
        whiteSpace: "nowrap",
      }}
    >
      {d}
    </span>
  );
}

// ── IterationGrid — shared domain-activity heatmap ────────────────────────────

const CELL = 22;      // px — width & height of each round cell
const LABEL_W = 48;   // px — domain label column width

function abbrevExt(ext: string): string {
  const s = ext.toLowerCase();
  if (s.includes("methylmalonyl")) return "MM";
  if (s.includes("malonyl"))       return "M";
  if (s.includes("ethylmalonyl"))  return "EM";
  if (s.includes("hydroxymalonyl"))return "HM";
  if (s.includes("spontaneous"))   return "Sp";
  if (!ext || s === "none")        return "—";
  return ext.slice(0, 3);
}

export function IterationGrid({ rounds }: { rounds: IterationRound[] }) {
  if (rounds.length === 0) return null;

  const allDomains = [...new Set(rounds.flatMap((r) => r.domains))];
  const uniqueExts = [
    ...new Map(rounds.map((r) => [abbrevExt(r.extender), r.extender]))
      .entries(),
  ].filter(([abbr]) => abbr !== "—");

  return (
    <div style={{ overflowX: "auto" }}>
      {/* Round header */}
      <div style={{ display: "flex", marginLeft: LABEL_W, gap: 3, marginBottom: 4 }}>
        {rounds.map((_, ri) => (
          <div
            key={ri}
            style={{
              width: CELL, fontSize: 9, textAlign: "center",
              color: "#888", fontWeight: 700, flexShrink: 0,
            }}
          >
            R{ri + 1}
          </div>
        ))}
      </div>

      {/* Domain rows */}
      {allDomains.map((domain) => {
        const ds = domainStyle(domain);
        return (
          <div
            key={domain}
            style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 3 }}
          >
            <div
              style={{
                width: LABEL_W, flexShrink: 0,
                fontSize: 10, fontWeight: 700, fontFamily: "monospace",
                color: ds.color, textAlign: "right", paddingRight: 6,
              }}
            >
              {domain}
            </div>
            {rounds.map((r, ri) => {
              const active = r.domains.includes(domain);
              return (
                <div
                  key={ri}
                  style={{
                    width: CELL, height: CELL, flexShrink: 0,
                    borderRadius: 4,
                    backgroundColor: active ? ds.bg : "#f5f5f9",
                    border: `1.5px solid ${active ? ds.color : "#e5e7eb"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {active && (
                    <div
                      style={{
                        width: 8, height: 8, borderRadius: 2,
                        backgroundColor: ds.color,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Extender row */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 3,
          marginTop: 5, paddingTop: 5, borderTop: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            width: LABEL_W, flexShrink: 0,
            fontSize: 9.5, color: "#888", textAlign: "right", paddingRight: 6,
          }}
        >
          ext.
        </div>
        {rounds.map((r, ri) => (
          <div
            key={ri}
            style={{
              width: CELL, flexShrink: 0,
              fontSize: 8.5, textAlign: "center", color: "#555", fontWeight: 600,
            }}
          >
            {abbrevExt(r.extender)}
          </div>
        ))}
      </div>

      {/* Extender legend */}
      {uniqueExts.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 9, color: "#aaa", lineHeight: 1.7 }}>
          {uniqueExts.map(([abbr, full]) => (
            <span key={abbr} style={{ marginRight: 8 }}>
              <span style={{ fontWeight: 700, color: "#777" }}>{abbr}</span>
              {" = "}{full}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const typeLabel: Record<ParsedNonlinearity["type"], string> = {
  Inactive:    "Inactive",
  Missing:     "Missing",
  transAT:     "trans-AT",
  Iteration:   "Iteration",
  ModuleSkip:  "Module Skip",
  Halogenation:"Halogenation",
  Unknown:     "Note",
};

const typeHeader: Record<ParsedNonlinearity["type"], { bg: string; color: string; border: string }> = {
  Inactive:    { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" },
  Missing:     { bg: "#f3f4f6", color: "#374151", border: "#d1d5db" },
  transAT:     { bg: "#ecfdf5", color: "#065f46", border: "#6ee7b7" },
  Iteration:   { bg: "#eff6ff", color: "#1e40af", border: "#93c5fd" },
  ModuleSkip:  { bg: "#fefce8", color: "#854d0e", border: "#fde047" },
  Halogenation:{ bg: "#fdf4ff", color: "#6b21a8", border: "#d8b4fe" },
  Unknown:     { bg: "#f8fafc", color: "#475569", border: "#cbd5e1" },
};

// ── Main component ────────────────────────────────────────────────────────────

export default function NonlinearityBadge({ raw }: { raw: string | null }) {
  if (!raw) return <span style={{ color: "#ccc", fontSize: "12px" }}>—</span>;

  const parsed = parseNonlinearity(raw);

  if (parsed.length === 0) {
    return <span style={{ color: "#ccc", fontSize: "12px" }}>—</span>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {parsed.map((p, idx) => {
        const hdr = typeHeader[p.type];

        const isIter = p.type === "Iteration";
        return (
          <div
            key={idx}
            style={{
              display: "inline-flex",
              flexDirection: "column",
              gap: "4px",
              backgroundColor: hdr.bg,
              border: `1px solid ${hdr.border}`,
              borderRadius: "6px",
              padding: isIter ? "6px 10px" : "4px 8px",
              // No maxWidth for iteration — let the grid breathe
              maxWidth: isIter ? "none" : "220px",
            }}
          >
            {/* Type label */}
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: hdr.color,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {isIter
                ? `${typeLabel[p.type]} — ${p.rounds?.length ?? 0} rounds`
                : typeLabel[p.type]}
            </span>

            {/* Inactive / Missing: domain pills */}
            {(p.type === "Inactive" || p.type === "Missing") && p.domains && p.domains.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "3px" }}>
                {p.domains.map((d) => <DomainPill key={d} d={d} />)}
              </div>
            )}

            {/* trans-AT: gene + substrate */}
            {p.type === "transAT" && (
              <div style={{ fontSize: "11px", color: hdr.color, lineHeight: 1.5 }}>
                {p.gene && (
                  <span>
                    <span style={{ opacity: 0.7 }}>gene: </span>
                    <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{p.gene}</span>
                    {"  "}
                  </span>
                )}
                {p.substrate && (
                  <span>
                    <span style={{ opacity: 0.7 }}>sub: </span>
                    <span style={{ fontWeight: 500 }}>{p.substrate}</span>
                  </span>
                )}
              </div>
            )}

            {/* Iteration: domain activity grid */}
            {isIter && p.rounds && p.rounds.length > 0 && (
              <IterationGrid rounds={p.rounds} />
            )}

            {/* Halogenation / Unknown: raw text */}
            {(p.type === "Halogenation" || p.type === "Unknown") && (
              <span style={{ fontSize: "11px", color: hdr.color, fontWeight: 500 }}>
                {p.raw}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
