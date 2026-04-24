"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import NonlinearityBadge, { parseNonlinearity, IterationGrid } from "@/components/NonlinearityBadge";

const MoleculeViewer = dynamic(() => import("@/components/MoleculeViewer"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: 420,
        height: 300,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#bbb",
        fontSize: 13,
        backgroundColor: "#fafafa",
        borderRadius: 8,
      }}
    >
      Loading structure…
    </div>
  ),
});

// ── Types ─────────────────────────────────────────────────────────────────────

type Substrate = {
  raw: string;
  precursor_refs: string[] | null;
  molecules: string[] | null;
};

export type StepRow = {
  order: string;
  enzyme: string;
  module: string | null;
  nonlinearity: string | null;
  substrate: Substrate;
  product_smiles: string;
  product_id: string;
};

type GeneDomain = {
  type: string | null;
  start: number;
  end: number;
  strand: number;
  domain_id: string | null;
  module_idx: number | null;
};

type GeneLocus = {
  gene: string | null;
  locus_tag: string | null;
  start: number;
  end: number;
  strand: number;
  gene_kind: string | null;
  product: string | null;
  gene_functions: string[];
  domains: GeneDomain[];
};

// ── Domain visualisation palette (shared with PathwayDAG) ─────────────────────

const DOMAIN_VIZ: Record<string, { fill: string; abbr: string; label: string }> = {
  // PKS catalytic core — hues chosen to NOT overlap any gene-kind colour
  "PKS_KS":            { fill: "#0f766e", abbr: "KS",  label: "Ketosynthase" },          // teal
  "PKS_AT":            { fill: "#a21caf", abbr: "AT",  label: "Acyltransferase" },        // fuchsia
  "PKS_DH":            { fill: "#4d7c0f", abbr: "DH",  label: "Dehydratase" },            // lime
  "PKS_ER":            { fill: "#166534", abbr: "ER",  label: "Enoylreductase" },         // forest green
  "PKS_KR":            { fill: "#be185d", abbr: "KR",  label: "Ketoreductase" },          // pink
  // Carrier proteins — warm stone gray
  "ACP":               { fill: "#44403c", abbr: "ACP", label: "Acyl carrier (ACP)" },    // stone-700
  "PKS_PP":            { fill: "#78716c", abbr: "PP",  label: "Phosphopantetheine" },    // stone-500
  // NRPS core
  "Condensation":      { fill: "#14532d", abbr: "C",   label: "Condensation" },          // dark forest green
  "AMP-binding":       { fill: "#713f12", abbr: "A",   label: "Adenylation" },           // dark warm brown
  "PCP":               { fill: "#581c87", abbr: "PCP", label: "Peptidyl carrier (PCP)" }, // violet-900
  "PP-binding":        { fill: "#1e1b4b", abbr: "PP",  label: "PP-binding" },            // indigo-950
  "NRPS-COM_Nterm":    { fill: "#292524", abbr: "Cn",  label: "COM N-term" },            // stone-900
  "NRPS-COM_Cterm":    { fill: "#57534e", abbr: "Cc",  label: "COM C-term" },            // stone-600
  // Release / tailoring
  "Thioesterase":      { fill: "#3730a3", abbr: "TE",  label: "Thioesterase" },          // indigo-700
  "Epimerization":     { fill: "#831843", abbr: "E",   label: "Epimerization" },         // dark maroon
  "Heterocyclization": { fill: "#451a03", abbr: "Cy",  label: "Heterocyclization" },     // dark warm brown-red
  // Docking / misc — warm charcoal
  "PKS_Docking_Nterm": { fill: "#231f1e", abbr: "Dn",  label: "Docking N-term" },        // stone-950
  "PKS_Docking_Cterm": { fill: "#574b47", abbr: "Dc",  label: "Docking C-term" },        // stone-600
  "FkbH":              { fill: "#1a2e05", abbr: "Fk",  label: "FkbH-like" },            // very dark olive
};
const DV_UNKNOWN = { fill: "#94a3b8", abbr: "?", label: "Unknown domain" };
function dv(type: string | null) {
  return (type && DOMAIN_VIZ[type]) ? DOMAIN_VIZ[type] : DV_UNKNOWN;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseModOrder(m: string | null): number {
  if (m === "0")  return 0;
  if (m === "TE") return 99999;
  const v = parseInt(m ?? "", 10);
  return isNaN(v) ? 99998 : v;
}

// Parses enzyme annotation strings into individual gene names.
// Handles: "apoP", "apoS3;apoS4", "(apoM1;apoM3;apoM4), apoP, ?"
function parseEnzymes(raw: string | null): string[] {
  if (!raw) return [];
  const result = new Set<string>();
  const re = /\(([^)]+)\)|([^\s,;()?]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m[1]) {
      for (const part of m[1].split(";")) {
        const t = part.trim();
        if (t && t !== "?") result.add(t);
      }
    } else if (m[2]) {
      const t = m[2].trim();
      if (t && t !== "?") result.add(t);
    }
  }
  return [...result];
}

function moduleLabel(mod: string | null): string | null {
  if (mod === null) return null;
  if (mod === "0") return "Loading";
  if (mod === "TE") return "TE";
  return `M${mod}`;
}

// ── Domain architecture popup ─────────────────────────────────────────────────

function DomainPopup({
  step,
  steps,
  genes,
  pos,
  onClose,
}: {
  step: StepRow;
  steps: StepRow[];
  genes: GeneLocus[];
  pos: { x: number; y: number };
  onClose: () => void;
}) {
  const ml = step.module;
  const mlLabel = ml === "0" ? "Loading module" : ml === "TE" ? "Thioesterase" : `Module ${ml}`;
  const mlBg    = ml === "TE" ? "#fef3c7" : ml === "0" ? "#dcfce7" : "#e8f0fe";
  const mlColor = ml === "TE" ? "#92400e" : ml === "0" ? "#166534" : "#1a56db";
  const hasNonlinearity = !!step.nonlinearity;

  // ── Build gene sections (same logic as PathwayDAG) ────────────────────
  type GeneSection = { gene: GeneLocus; visibleDomains: GeneDomain[] };
  const enzymeNames = parseEnzymes(step.enzyme);
  const geneSections: GeneSection[] = (ml !== null)
    ? enzymeNames.flatMap((enzName) => {
        const gene = genes.find((g) => g.gene === enzName || g.locus_tag === enzName);
        if (!gene) return [];
        // localRank: position of this step among all steps referencing this gene
        const peerSteps = steps
          .filter((s) => s.module !== null && parseEnzymes(s.enzyme).includes(enzName))
          .sort((a, b) => parseModOrder(a.module) - parseModOrder(b.module));
        const localRank = peerSteps.findIndex(
          (s) => s.module === step.module && s.product_id === step.product_id
        );
        const hasMidx = gene.domains.some((d) => d.module_idx !== null);
        const visible = (hasMidx && localRank >= 0)
          ? gene.domains.filter((d) => d.module_idx === localRank)
          : gene.domains;
        return [{ gene, visibleDomains: visible }] as GeneSection[];
      })
    : [];

  // Sort gene sections N→C: for reverse-strand genes highest start = N-terminus
  const orderedSections = [...geneSections].sort((a, b) =>
    a.gene.strand === -1 ? b.gene.start - a.gene.start : a.gene.start - b.gene.start
  );

  if (orderedSections.length === 0 && !hasNonlinearity) return null;

  const isSplit  = orderedSections.length > 1;
  const popupW   = isSplit ? 320 : 288;
  const barW     = popupW - 28;
  const sectionW = isSplit
    ? Math.floor((barW - 10 * (orderedSections.length - 1)) / orderedSections.length)
    : barW;

  // All domains ordered N→C (across genes) — for the combined legend
  const allDomains = orderedSections.flatMap(({ gene, visibleDomains }) => {
    const rev = gene.strand === -1;
    return [...visibleDomains].sort((a, b) => rev ? b.start - a.start : a.start - b.start);
  });

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 200, pointerEvents: "none" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          left: pos.x,
          top: pos.y,
          pointerEvents: "auto",
          backgroundColor: "#fff",
          border: "1px solid #dde",
          borderRadius: 10,
          boxShadow: "0 6px 24px rgba(0,0,0,0.14)",
          padding: "12px 14px",
          width: barW + 28,
          fontSize: 12,
          zIndex: 201,
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 6, right: 8,
            background: "none", border: "none", fontSize: 16,
            color: "#aaa", cursor: "pointer", lineHeight: 1, padding: "0 2px",
          }}
          aria-label="Close"
        >
          ×
        </button>

        {/* ── Domain architecture ──────────────────────────────────────── */}
        {orderedSections.length > 0 && (
          <div style={{ marginBottom: hasNonlinearity ? 10 : 0 }}>
            {/* Header: gene name(s) + module badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap", paddingRight: 20 }}>
              <code style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e" }}>
                {orderedSections.map((s) => s.gene.gene).join(" · ")}
              </code>
              {ml !== null && (
                <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, fontWeight: 600, backgroundColor: mlBg, color: mlColor }}>
                  {mlLabel}
                </span>
              )}
              {isSplit && (
                <span style={{ fontSize: 9, color: "#9ca3af", fontStyle: "italic" }}>
                  split module
                </span>
              )}
            </div>
            {/* Product annotation — single-gene only */}
            {!isSplit && orderedSections[0].gene.product && (
              <div style={{ fontSize: 10, color: "#64748b", fontStyle: "italic", marginBottom: 6 }}>
                {orderedSections[0].gene.product}
              </div>
            )}
            {/* Domain bars (one per gene section) + combined legend */}
            {allDomains.length > 0 ? (
              <>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 5 }}>
                  {orderedSections.map(({ gene, visibleDomains }, si) => {
                    const rev = gene.strand === -1;
                    const domStart = visibleDomains.length > 0
                      ? Math.min(...visibleDomains.map((d) => d.start)) : 0;
                    const domEnd = visibleDomains.length > 0
                      ? Math.max(...visibleDomains.map((d) => d.end)) : 1;
                    const span = Math.max(domEnd - domStart, 1);
                    const bx = rev
                      ? (bp: number) => ((domEnd - bp) / span) * sectionW
                      : (bp: number) => ((bp - domStart) / span) * sectionW;
                    return (
                      <div key={si}>
                        {isSplit && (
                          <div style={{ fontSize: 9, color: "#64748b", fontFamily: "monospace", marginBottom: 2 }}>
                            {gene.gene}
                          </div>
                        )}
                        <svg width={sectionW} height={30} style={{ display: "block" }}>
                          <rect x={0} y={7} width={sectionW} height={12}
                            fill={visibleDomains.length > 0 ? "#e2e8f0" : "#f1f5f9"}
                            rx={3}
                            stroke={visibleDomains.length === 0 ? "#cbd5e1" : "none"}
                            strokeWidth={0.5}
                            strokeDasharray={visibleDomains.length === 0 ? "3,2" : undefined} />
                          {visibleDomains.map((dom, di) => {
                            const x1 = rev ? bx(dom.end) : bx(dom.start);
                            const w  = Math.max(
                              rev ? bx(dom.start) - bx(dom.end) : bx(dom.end) - bx(dom.start),
                              2
                            );
                            const { fill, abbr } = dv(dom.type);
                            return (
                              <g key={di}>
                                <rect x={x1} y={4} width={w} height={18} fill={fill} rx={2} opacity={0.9} />
                                {w >= 14 && (
                                  <text x={x1 + w / 2} y={16} textAnchor="middle"
                                    fontSize={7} fontWeight="bold" fill="white">{abbr}</text>
                                )}
                              </g>
                            );
                          })}
                          <text x={2} y={28} fontSize={7} fill="#94a3b8" fontStyle="italic">N</text>
                          <text x={sectionW - 2} y={28} textAnchor="end" fontSize={7} fill="#94a3b8" fontStyle="italic">C</text>
                        </svg>
                      </div>
                    );
                  })}
                </div>
                {/* Domain legend in N→C order */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px", fontSize: 10, color: "#475569" }}>
                  {allDomains.map((dom, di) => {
                    const { fill, label } = dv(dom.type);
                    return (
                      <span key={di} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <span style={{ width: 7, height: 7, borderRadius: 1, flexShrink: 0, backgroundColor: fill, display: "inline-block" }} />
                        {label}
                      </span>
                    );
                  })}
                </div>
              </>
            ) : (
              <div style={{ color: "#94a3b8", fontSize: 10, fontStyle: "italic" }}>
                No domain data available for this module.
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        {orderedSections.length > 0 && hasNonlinearity && (
          <div style={{ borderTop: "1px solid #eee", margin: "8px 0" }} />
        )}

        {/* ── Nonlinearity section ──────────────────────────────────────── */}
        {hasNonlinearity && (() => {
          const parsed = parseNonlinearity(step.nonlinearity);
          if (parsed.length === 0) return null;
          return (
            <>
              {parsed.map((p, pi) => (
                <div key={pi} style={{ marginBottom: pi < parsed.length - 1 ? 10 : 0 }}>
                  <div style={{
                    fontWeight: 700, fontSize: 11, color: "#6464dc",
                    textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8,
                  }}>
                    {p.type === "Iteration"    ? `Iteration — ${p.rounds?.length ?? 0} rounds`
                     : p.type === "Inactive"   ? "Inactive domains"
                     : p.type === "Missing"    ? "Missing domains"
                     : p.type === "transAT"    ? "trans-AT"
                     : p.type === "ModuleSkip" ? "Module Skip"
                     : p.type === "Halogenation" ? "Halogenation" : "Note"}
                  </div>
                  {p.type === "Iteration" && p.rounds && p.rounds.length > 0 && (
                    <IterationGrid rounds={p.rounds} />
                  )}
                  {(p.type === "Inactive" || p.type === "Missing") && p.domains && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {p.domains.map((d) => (
                        <span key={d} style={{
                          padding: "1px 6px", borderRadius: 4,
                          fontSize: 11, fontWeight: 600, fontFamily: "monospace",
                          backgroundColor: "#f1f5f9", color: "#475569",
                        }}>{d}</span>
                      ))}
                    </div>
                  )}
                  {p.type === "transAT" && (
                    <div style={{ color: "#374151", lineHeight: 1.7 }}>
                      {p.gene && <div><span style={{ color: "#888" }}>Gene: </span>
                        <code style={{ fontFamily: "monospace", fontWeight: 600 }}>{p.gene}</code></div>}
                      {p.substrate && <div><span style={{ color: "#888" }}>Substrate: </span>{p.substrate}</div>}
                    </div>
                  )}
                  {(p.type === "Halogenation" || p.type === "Unknown") && (
                    <div style={{ color: "#374151" }}>{p.raw}</div>
                  )}
                </div>
              ))}
            </>
          );
        })()}
      </div>
    </div>
  );
}

// ── Molecule modal ────────────────────────────────────────────────────────────

function MoleculeModal({
  steps,
  index,
  onNavigate,
  onClose,
}: {
  steps: StepRow[];
  index: number;
  onNavigate: (newIndex: number) => void;
  onClose: () => void;
}) {
  const step = steps[index];
  const hasPrev = index > 0;
  const hasNext = index < steps.length - 1;

  const backdropRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Reset copy state when navigating to a different step
  useEffect(() => {
    setCopied(false);
  }, [index]);

  // Keyboard: Escape closes, ArrowLeft/ArrowRight navigates
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasPrev) onNavigate(index - 1);
      else if (e.key === "ArrowRight" && hasNext) onNavigate(index + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, onNavigate, index, hasPrev, hasNext]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  function handleCopy() {
    navigator.clipboard.writeText(step.product_smiles).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const ml = moduleLabel(step.module);
  const substrate =
    step.substrate.molecules && step.substrate.molecules.length > 0
      ? step.substrate.molecules.join(" + ")
      : step.substrate.raw;

  return (
    <div
      ref={backdropRef}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(20,20,40,0.55)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 16px",
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: 14,
          boxShadow: "0 8px 40px rgba(0,0,0,0.22)",
          width: "100%",
          maxWidth: 820,
          maxHeight: "90vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 22px",
            borderBottom: "1px solid #eef",
            flexShrink: 0,
          }}
        >
          {/* Left group: step info */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 13,
                fontWeight: 700,
                color: "#6464dc",
                backgroundColor: "#f0f0ff",
                padding: "3px 9px",
                borderRadius: 6,
              }}
            >
              {step.product_id}
            </span>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#1a1a2e" }}>
              Step {step.order}
            </span>
            {ml && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 4,
                  backgroundColor:
                    ml === "TE"
                      ? "#fef3c7"
                      : ml === "Loading"
                      ? "#dcfce7"
                      : "#e8f0fe",
                  color:
                    ml === "TE"
                      ? "#92400e"
                      : ml === "Loading"
                      ? "#166534"
                      : "#1a56db",
                }}
              >
                {ml}
              </span>
            )}
          </div>

          {/* Right group: prev / counter / next / close */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={() => hasPrev && onNavigate(index - 1)}
              disabled={!hasPrev}
              title="Previous reaction (←)"
              style={{
                background: "none",
                border: "1px solid #dde",
                borderRadius: 6,
                width: 30,
                height: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                color: hasPrev ? "#6464dc" : "#ccc",
                cursor: hasPrev ? "pointer" : "default",
              }}
              aria-label="Previous"
            >
              ‹
            </button>
            <span style={{ fontSize: 12, color: "#888", minWidth: 48, textAlign: "center" }}>
              {index + 1} / {steps.length}
            </span>
            <button
              onClick={() => hasNext && onNavigate(index + 1)}
              disabled={!hasNext}
              title="Next reaction (→)"
              style={{
                background: "none",
                border: "1px solid #dde",
                borderRadius: 6,
                width: 30,
                height: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                color: hasNext ? "#6464dc" : "#ccc",
                cursor: hasNext ? "pointer" : "default",
              }}
              aria-label="Next"
            >
              ›
            </button>
            <div style={{ width: 1, height: 20, backgroundColor: "#eef", margin: "0 4px" }} />
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                fontSize: 22,
                color: "#888",
                cursor: "pointer",
                lineHeight: 1,
                padding: "0 4px",
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        {/* ── Body (scrollable) ────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            overflow: "auto",
            flex: 1,
          }}
        >
          {/* Top row: compact metadata + chemical structure side by side */}
          <div style={{ display: "flex", flexShrink: 0 }}>
            {/* Left: metadata (scrollable so tall content doesn't push into right column) */}
            <div
              style={{
                padding: "20px 22px",
                minWidth: 220,
                maxWidth: 260,
                borderRight: "1px solid #eef",
                flexShrink: 0,
                overflowY: "auto",
                maxHeight: 400,
              }}
            >
              <dl
                style={{
                  display: "grid",
                  gridTemplateColumns: "max-content 1fr",
                  columnGap: 12,
                  rowGap: 8,
                  fontSize: 13,
                  margin: 0,
                }}
              >
                <dt style={{ color: "#888", fontWeight: 500, whiteSpace: "nowrap" }}>
                  Enzyme
                </dt>
                <dd
                  style={{
                    margin: 0,
                    fontFamily: "monospace",
                    fontWeight: 600,
                    color: "#1a1a2e",
                    wordBreak: "break-word",
                  }}
                >
                  {step.enzyme}
                </dd>

                <dt style={{ color: "#888", fontWeight: 500 }}>Substrate</dt>
                <dd style={{ margin: 0, color: "#333", wordBreak: "break-word" }}>
                  {substrate}
                </dd>

                {step.substrate.precursor_refs &&
                  step.substrate.precursor_refs.length > 0 && (
                    <>
                      <dt
                        style={{
                          color: "#888",
                          fontWeight: 500,
                          whiteSpace: "nowrap",
                        }}
                      >
                        From
                      </dt>
                      <dd style={{ margin: 0 }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {step.substrate.precursor_refs.map((r) => (
                            <span
                              key={r}
                              style={{
                                fontFamily: "monospace",
                                fontSize: 11,
                                fontWeight: 600,
                                color: "#6464dc",
                                backgroundColor: "#f0f0ff",
                                padding: "1px 6px",
                                borderRadius: 4,
                              }}
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </dd>
                    </>
                  )}
              </dl>
            </div>

            {/* Right: chemical structure */}
            <div
              style={{
                flex: 1,
                padding: "20px 22px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  backgroundColor: "#fafafe",
                  border: "1px solid #eef",
                  borderRadius: 10,
                  padding: "12px",
                  display: "inline-block",
                }}
              >
                <MoleculeViewer
                  smiles={step.product_smiles}
                  width={420}
                  height={290}
                  theme="light"
                />
              </div>

              {/* SMILES string */}
              <div
                style={{
                  width: "100%",
                  backgroundColor: "#f8f8fc",
                  border: "1px solid #eef",
                  borderRadius: 8,
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <code
                  style={{
                    flex: 1,
                    fontSize: 11,
                    fontFamily: "monospace",
                    color: "#374151",
                    wordBreak: "break-all",
                    lineHeight: 1.6,
                  }}
                >
                  {step.product_smiles}
                </code>
                <button
                  onClick={handleCopy}
                  title="Copy SMILES"
                  style={{
                    flexShrink: 0,
                    padding: "3px 10px",
                    border: "1px solid #ccd",
                    borderRadius: 6,
                    background: copied ? "#dcfce7" : "#fff",
                    color: copied ? "#166534" : "#555",
                    fontSize: 11.5,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    whiteSpace: "nowrap",
                  }}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </div>

          {/* Bottom section: nonlinearity details (full width, only when present) */}
          {step.nonlinearity && (
            <div
              style={{
                borderTop: "1px solid #eef",
                padding: "16px 22px",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#888",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: 10,
                }}
              >
                Notes
              </div>
              <NonlinearityBadge raw={step.nonlinearity} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Steps table ───────────────────────────────────────────────────────────────

export default function StepsTable({
  steps,
  genes,
}: {
  steps: StepRow[];
  genes?: GeneLocus[];
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [popup, setPopup] = useState<{
    step: StepRow;
    pos: { x: number; y: number };
  } | null>(null);

  // Close popup on click-outside (handled by the fixed overlay in DomainPopup)
  // Also close when molecule modal opens
  function openModal(i: number) {
    setPopup(null);
    setSelectedIndex(i);
  }

  // Compute popup position relative to the clicked element, clamped to viewport
  function computePopupPos(rect: DOMRect, popW = 288): { x: number; y: number } {
    const estH = 280;  // estimated max popup height

    let left = rect.left;
    let top  = rect.bottom + 6;

    // Clamp horizontally
    if (left + popW > window.innerWidth - 8) {
      left = window.innerWidth - popW - 8;
    }
    if (left < 8) left = 8;

    // Flip above row if popup would go off the bottom
    if (top + estH > window.innerHeight - 8) {
      top = rect.top - estH - 6;
      if (top < 8) top = 8;
    }

    return { x: left, y: top };
  }

  return (
    <>
      {selectedIndex !== null && (
        <MoleculeModal
          steps={steps}
          index={selectedIndex}
          onNavigate={setSelectedIndex}
          onClose={() => setSelectedIndex(null)}
        />
      )}

      {popup !== null && (
        <DomainPopup
          step={popup.step}
          steps={steps}
          genes={genes!}
          pos={popup.pos}
          onClose={() => setPopup(null)}
        />
      )}

      <div
        style={{
          backgroundColor: "#fff",
          border: "1px solid #dde",
          borderRadius: "10px",
          overflow: "hidden",
          boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "13px",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f5f5fb" }}>
                {[
                  "Step",
                  "Product ID",
                  "Enzyme",
                  "Module",
                  "Substrate",
                  "Product SMILES",
                  "Notes",
                ].map((col) => (
                  <th
                    key={col}
                    style={{
                      padding: "10px 14px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "#444",
                      borderBottom: "2px solid #dde",
                      whiteSpace: "nowrap",
                      fontSize: "12px",
                      letterSpacing: "0.3px",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {steps.map((step, i) => {
                const ml = moduleLabel(step.module);
                const isSelected = selectedIndex === i;
                const isPopupOpen = popup?.step.product_id === step.product_id;

                // Module badge is clickable when any parsed enzyme name matches a gene,
                // or when the step has a module with nonlinearity info.
                const stepEnzymeNames = step.module !== null ? parseEnzymes(step.enzyme) : [];
                const isBadgeClickable =
                  (stepEnzymeNames.length > 0 && genes !== undefined &&
                    stepEnzymeNames.some((name) => genes.find((g) => g.gene === name || g.locus_tag === name))) ||
                  (step.module !== null && !!step.nonlinearity);

                return (
                  <tr
                    key={step.order}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedIndex(null);
                      } else {
                        openModal(i);
                      }
                    }}
                    style={{
                      backgroundColor:
                        isSelected || isPopupOpen ? "#f0f0ff" :
                        hoveredIdx === i           ? "#f5f5fb" :
                        i % 2 === 0               ? "#fff"    : "#fafafe",
                      borderBottom: "1px solid #eef",
                      cursor: "pointer",
                      transition: "background-color 0.1s",
                    }}
                    onMouseEnter={() => setHoveredIdx(i)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  >
                    {/* Step order */}
                    <td
                      style={{
                        padding: "10px 14px",
                        textAlign: "center",
                        fontWeight: 600,
                        color: "#6464dc",
                        whiteSpace: "nowrap",
                        minWidth: "52px",
                      }}
                    >
                      {step.order}
                    </td>

                    {/* Product ID */}
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      <code
                        style={{
                          fontFamily: "monospace",
                          fontSize: "12px",
                          fontWeight: 600,
                          color: "#6464dc",
                          backgroundColor: "#f0f0ff",
                          padding: "2px 7px",
                          borderRadius: "4px",
                        }}
                      >
                        {step.product_id}
                      </code>
                    </td>

                    {/* Enzyme */}
                    <td
                      style={{
                        padding: "10px 14px",
                        fontFamily: "monospace",
                        color: "#1a1a2e",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {step.enzyme}
                    </td>

                    {/* Module */}
                    <td
                      style={{
                        padding: "10px 14px",
                        textAlign: "center",
                        color: "#555",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {ml !== null ? (
                        <span
                          onClick={isBadgeClickable ? (e) => {
                            e.stopPropagation();
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            if (isPopupOpen) {
                              setPopup(null);
                            } else {
                              // Use wider estimate for split modules so clamping is accurate
                              const matchCount = genes ? stepEnzymeNames.filter(
                                (name) => genes.find((g) => g.gene === name || g.locus_tag === name)
                              ).length : 0;
                              setPopup({ step, pos: computePopupPos(rect, matchCount > 1 ? 348 : 288) });
                            }
                          } : undefined}
                          title={isBadgeClickable ? "Click to view domain architecture" : undefined}
                          style={{
                            display: "inline-block",
                            padding: "1px 8px",
                            borderRadius: "4px",
                            backgroundColor:
                              ml === "TE"
                                ? "#fef3c7"
                                : ml === "Loading"
                                ? "#dcfce7"
                                : "#f0f4ff",
                            color:
                              ml === "TE"
                                ? "#92400e"
                                : ml === "Loading"
                                ? "#166534"
                                : "#3730a3",
                            fontSize: "12px",
                            fontWeight: 500,
                            cursor: isBadgeClickable ? "pointer" : "default",
                            outline: isPopupOpen ? "2px solid #6464dc" : "none",
                            outlineOffset: 1,
                          }}
                        >
                          {ml}
                        </span>
                      ) : (
                        <span style={{ color: "#ccc" }}>—</span>
                      )}
                    </td>

                    {/* Substrate */}
                    <td style={{ padding: "10px 14px", maxWidth: "220px" }}>
                      <div style={{ color: "#333" }}>
                        {step.substrate.molecules &&
                        step.substrate.molecules.length > 0
                          ? step.substrate.molecules.join(" + ")
                          : step.substrate.raw}
                      </div>
                      {step.substrate.precursor_refs &&
                        step.substrate.precursor_refs.length > 0 && (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#aaa",
                              marginTop: "2px",
                            }}
                          >
                            from: {step.substrate.precursor_refs.join(", ")}
                          </div>
                        )}
                    </td>

                    {/* Product SMILES */}
                    <td style={{ padding: "10px 14px", maxWidth: "200px" }}>
                      <code
                        style={{
                          fontSize: "11.5px",
                          fontFamily: "monospace",
                          color: "#374151",
                          backgroundColor: "#f8f8fc",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          display: "inline-block",
                          wordBreak: "break-all",
                          maxWidth: "100%",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxHeight: "2.2em",
                          verticalAlign: "top",
                        }}
                        title={step.product_smiles}
                      >
                        {step.product_smiles}
                      </code>
                    </td>

                    {/* Notes */}
                    <td
                      style={{
                        padding: "10px 14px",
                        maxWidth: "200px",
                      }}
                    >
                      {step.nonlinearity ? (
                        <span
                          style={{
                            fontSize: "11.5px",
                            color: "#92400e",
                            backgroundColor: "#fef3c7",
                            padding: "2px 7px",
                            borderRadius: "4px",
                            display: "inline-block",
                          }}
                        >
                          {step.nonlinearity.length > 30
                            ? step.nonlinearity.slice(0, 28) + "…"
                            : step.nonlinearity}
                        </span>
                      ) : (
                        <span style={{ color: "#ccc", fontSize: "12px" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div
          style={{
            padding: "8px 14px",
            fontSize: 11.5,
            color: "#aaa",
            borderTop: "1px solid #eef",
          }}
        >
          Click any row to view the chemical structure · Click a module badge (M1, TE…) to view domain architecture
        </div>
      </div>
    </>
  );
}