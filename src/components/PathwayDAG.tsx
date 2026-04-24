"use client";

import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import { parseNonlinearity, IterationGrid } from "@/components/NonlinearityBadge";
import { useGeneHighlight } from "@/components/GeneHighlightContext";

// ── Types ─────────────────────────────────────────────────────────────────────

export type DAGStep = {
  order: string | null;
  enzyme: string;
  module: string | null;
  nonlinearity: string | null;
  substrate: {
    raw: string;
    precursor_refs: string[] | null;
    molecules: string[] | null;
  };
  product_smiles: string;
  product_id: string;
};

// ── Layout constants ──────────────────────────────────────────────────────────

const NW = 182;   // node width
const NH = 92;    // node height
const HGAP = 50;  // horizontal gap between levels (sequential steps)
const VGAP = 14;  // vertical gap between parallel branches at the same level
const PAD = 20;   // canvas padding

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseOrderNum(order: string | null): number {
  if (!order) return 0;
  const m = order.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function formatNonlinearity(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.includes("Inactive")) {
    const m = raw.match(/\[([^\]]+)\]/);
    if (m) {
      const domains = m[1].replace(/['"]/g, "").replace(/,\s*/g, ", ");
      return `Inactive: ${domains}`;
    }
  }
  if (raw.includes("Iteration")) return "Iterative";
  if (raw.includes("ModuleSkip")) return "Module Skip";
  if (raw.includes("transAT")) return "Trans-AT";
  return raw.length > 28 ? raw.slice(0, 26) + "…" : raw;
}

function moduleLabel(mod: string | null): string | null {
  if (mod === null) return null;
  if (mod === "0") return "Load";
  if (mod === "TE") return "TE";
  return `M${mod}`;
}

function truncate(s: string | null, n: number): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// ── Step type classification ──────────────────────────────────────────────────

type StepClass = "PKS" | "NRPS" | "Other";

const AMINO_ACIDS = new Set([
  "glycine", "alanine", "valine", "leucine", "isoleucine", "proline",
  "phenylalanine", "tryptophan", "methionine", "serine", "threonine",
  "cysteine", "tyrosine", "histidine", "aspartate", "asparagine",
  "glutamate", "glutamine", "lysine", "arginine", "ornithine",
  "beta-alanine", "d-alanine", "d-valine", "pipecolic",
  "4-hydroxyphenylglycine", "3,5-dihydroxyphenylglycine",
  "2-aminobutyrate", "2-amino", "hydroxyphenyl",
]);

function classifyStep(step: DAGStep): StepClass {
  const mols = step.substrate.molecules ?? [];
  const raw = step.substrate.raw ?? "";
  const text = [...mols, raw].join(" ").toLowerCase();

  if (text.includes("coa")) return "PKS";

  const words = text.split(/[\s,+/]+/);
  for (const aa of AMINO_ACIDS) {
    if (text.includes(aa)) return "NRPS";
  }
  // Single-word substrates that are common amino acid short names
  if (words.some((w) => w.match(/^l-\w+$/) || w.match(/^d-\w+$/))) return "NRPS";

  return "Other";
}

const stepClassStyle: Record<StepClass, { strip: string; label: string }> = {
  PKS:   { strip: "#3b82f6", label: "PKS step"  },
  NRPS:  { strip: "#ec4899", label: "NRPS step" },
  Other: { strip: "#94a3b8", label: "Tailoring/other" },
};

// ── Graph node (after layout) ─────────────────────────────────────────────────

type GNode = {
  id: string;
  order: string | null;
  enzyme: string | null;
  module: string | null;
  molecules: string[];
  nonlinearity: string | null;
  stepClass: StepClass;
  isFinal: boolean;
  isRoot: boolean;
  level: number;
  x: number;
  y: number;
};

type GEdge = { id: string; source: string; target: string };

// ── Layout engine ─────────────────────────────────────────────────────────────

function buildLayout(steps: DAGStep[]): {
  nodes: GNode[];
  edges: GEdge[];
  W: number;
  H: number;
} {
  if (steps.length === 0) return { nodes: [], edges: [], W: 0, H: 0 };

  const stepSet = new Set(steps.map((s) => s.product_id));

  // ── Three-phase edge builder ───────────────────────────────────────────────
  const edgeSet = new Set<string>(); // dedup guard
  const edges: GEdge[] = [];

  function addEdge(src: string, tgt: string) {
    if (src === tgt) return;                      // no self-loops
    if (!stepSet.has(src) || !stepSet.has(tgt)) return;
    const key = `${src}→${tgt}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({ id: key, source: src, target: tgt });
  }

  // Phase 1 – explicit precursor_refs that point to a step in this pathway
  for (const step of steps) {
    for (const ref of step.substrate.precursor_refs ?? []) {
      addEdge(ref, step.product_id);
    }
  }

  // Phase 2 – scan substrate.raw for product_ids embedded in the text
  // (handles cases like raw = "296-5;4-methyl-3-hydroxyanthranilic acid")
  for (const step of steps) {
    const raw = step.substrate.raw ?? "";
    // split on common delimiters between a product-id and a molecule name
    for (const token of raw.split(/[;,+\s]+/)) {
      const t = token.trim();
      if (t && t !== step.product_id && stepSet.has(t)) {
        addEdge(t, step.product_id);
      }
    }
  }

  // Phase 3 – order-based fallback for "orphaned" steps
  // A step is orphaned when it had explicit precursor_refs but all point outside
  // this pathway (e.g. cross-BGC references). Connect it to the immediately
  // preceding step by order number so the graph stays connected.
  const sortedByOrder = [...steps].sort(
    (a, b) => parseOrderNum(a.order) - parseOrderNum(b.order)
  );
  // Track which product_ids already have at least one incoming edge after phases 1+2
  const hasIncoming = new Set<string>();
  for (const e of edges) hasIncoming.add(e.target);

  for (let i = 1; i < sortedByOrder.length; i++) {
    const step = sortedByOrder[i];
    if (hasIncoming.has(step.product_id)) continue;
    // Only apply fallback if there were explicit refs (even if external).
    // Steps with precursor_refs:null may be genuine parallel-branch starters.
    if ((step.substrate.precursor_refs ?? []).length === 0) continue;
    const prev = sortedByOrder[i - 1];
    addEdge(prev.product_id, step.product_id);
    hasIncoming.add(step.product_id); // mark so later orphans chain through
  }

  // Adjacency lists
  const adj = new Map<string, string[]>();
  const radj = new Map<string, string[]>();
  for (const id of stepSet) {
    adj.set(id, []);
    radj.set(id, []);
  }
  for (const e of edges) {
    adj.get(e.source)!.push(e.target);
    radj.get(e.target)!.push(e.source);
  }

  // Kahn's BFS: assign levels as longest-path-from-source
  const inDeg = new Map<string, number>();
  for (const id of stepSet) inDeg.set(id, (radj.get(id) ?? []).length);

  const levelMap = new Map<string, number>();
  const queue: string[] = [];
  for (const id of stepSet) {
    if (inDeg.get(id) === 0) {
      levelMap.set(id, 0);
      queue.push(id);
    }
  }

  let qi = 0;
  while (qi < queue.length) {
    const id = queue[qi++];
    const l = levelMap.get(id) ?? 0;
    for (const nb of adj.get(id) ?? []) {
      const newL = Math.max(levelMap.get(nb) ?? 0, l + 1);
      levelMap.set(nb, newL);
      const deg = (inDeg.get(nb) ?? 1) - 1;
      inDeg.set(nb, deg);
      if (deg <= 0) queue.push(nb);
    }
  }

  // Root nodes (no predecessors) and final nodes (no successors)
  const roots = new Set([...stepSet].filter((id) => (radj.get(id) ?? []).length === 0));
  const finals = new Set([...stepSet].filter((id) => (adj.get(id) ?? []).length === 0));

  // Group steps by level, sorted by order number within each level
  const byLevel = new Map<number, DAGStep[]>();
  for (const step of steps) {
    const l = levelMap.get(step.product_id) ?? 0;
    if (!byLevel.has(l)) byLevel.set(l, []);
    byLevel.get(l)!.push(step);
  }
  for (const ls of byLevel.values()) {
    ls.sort((a, b) => parseOrderNum(a.order) - parseOrderNum(b.order));
  }

  // Horizontal layout: levels → columns, siblings → rows
  const maxRows = Math.max(...[...byLevel.values()].map((ls) => ls.length));
  const innerH = maxRows * NH + Math.max(0, maxRows - 1) * VGAP;
  const H = PAD * 2 + innerH;

  const nodes: GNode[] = [];
  const maxLevel = Math.max(...levelMap.values());

  for (const [level, ls] of byLevel) {
    // Center this level's nodes vertically within the canvas
    const levelH = ls.length * NH + Math.max(0, ls.length - 1) * VGAP;
    const startY = PAD + (innerH - levelH) / 2;
    ls.forEach((step, i) => {
      nodes.push({
        id: step.product_id,
        order: step.order,
        enzyme: step.enzyme,
        module: step.module,
        molecules: step.substrate.molecules ?? [],
        nonlinearity: step.nonlinearity,
        stepClass: classifyStep(step),
        isFinal: finals.has(step.product_id),
        isRoot: roots.has(step.product_id),
        level,
        x: PAD + level * (NW + HGAP),
        y: startY + i * (NH + VGAP),
      });
    });
  }

  // Second pass: inherit class for "Other" nodes (e.g. TE, tailoring)
  // from their predecessors — propagate PKS/NRPS context up the chain.
  const classById = new Map(nodes.map((n) => [n.id, n.stepClass]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (node.stepClass !== "Other") continue;
      const preds = radj.get(node.id) ?? [];
      const predClasses = preds
        .map((pid) => classById.get(pid))
        .filter((c): c is StepClass => c === "PKS" || c === "NRPS");
      if (predClasses.length === 0) continue;
      const pksCnt = predClasses.filter((c) => c === "PKS").length;
      const nrpsCnt = predClasses.filter((c) => c === "NRPS").length;
      const inherited: StepClass = pksCnt >= nrpsCnt ? "PKS" : "NRPS";
      node.stepClass = inherited;
      classById.set(node.id, inherited);
      changed = true;
    }
  }

  const W = PAD + (maxLevel + 1) * (NW + HGAP) - HGAP + PAD;
  return { nodes, edges, W, H };
}

// ── Bezier path between two nodes ─────────────────────────────────────────────

function edgePath(
  sx: number, sy: number,
  tx: number, ty: number
): string {
  const dx = tx - sx;
  const cp = Math.max(20, Math.abs(dx) * 0.45);
  return `M ${sx} ${sy} C ${sx + cp} ${sy}, ${tx - cp} ${ty}, ${tx} ${ty}`;
}

// ── Node colours ──────────────────────────────────────────────────────────────

function nodeBg(n: GNode) {
  if (n.module === "TE") return "#fef3c7";
  if (n.module === "0")  return "#dcfce7";
  if (n.module !== null) return "#e8f0fe";
  // No module: fall back to position-based tint
  if (n.isFinal) return "#fff7ed";
  if (n.isRoot)  return "#f0fdf4";
  return "#ffffff";
}
function nodeBorder(n: GNode) {
  if (n.isFinal) return "#f59e0b";
  if (n.isRoot) return "#34d399";
  return "#c4c4e8";
}

// ── Gene loci types (passed from parent) ─────────────────────────────────────

type GeneDomain = {
  type: string | null; start: number; end: number; strand: number;
  domain_id: string | null; module_idx: number | null;
};
type GeneLocus  = {
  gene: string | null; locus_tag: string | null;
  start: number; end: number; strand: number;
  gene_kind: string | null; product: string | null;
  gene_functions: string[]; domains: GeneDomain[];
};

const DOMAIN_VIZ: Record<string, { fill: string; abbr: string; label: string }> = {
  // PKS catalytic core — five hue families so each is instantly distinct
  "PKS_KS":            { fill: "#1e40af", abbr: "KS",  label: "Ketosynthase" },         // indigo blue
  "PKS_AT":            { fill: "#c2410c", abbr: "AT",  label: "Acyltransferase" },       // burnt orange
  "PKS_DH":            { fill: "#0e7490", abbr: "DH",  label: "Dehydratase" },           // dark cyan
  "PKS_ER":            { fill: "#166534", abbr: "ER",  label: "Enoylreductase" },        // forest green
  "PKS_KR":            { fill: "#7e22ce", abbr: "KR",  label: "Ketoreductase" },         // deep violet
  // Carrier proteins — neutral grays so they don't compete with catalytic domains
  "ACP":               { fill: "#475569", abbr: "ACP", label: "Acyl carrier (ACP)" },   // slate
  "PKS_PP":            { fill: "#64748b", abbr: "PP",  label: "Phosphopantetheine" },   // lighter slate
  // NRPS core — warm reds/amber clearly separated from each other
  "Condensation":      { fill: "#991b1b", abbr: "C",   label: "Condensation" },         // dark crimson
  "AMP-binding":       { fill: "#b45309", abbr: "A",   label: "Adenylation" },          // dark amber
  "PCP":               { fill: "#9d174d", abbr: "PCP", label: "Peptidyl carrier (PCP)" }, // dark rose
  "PP-binding":        { fill: "#4c1d95", abbr: "PP",  label: "PP-binding" },           // very dark purple
  // Release / tailoring
  "Thioesterase":      { fill: "#d97706", abbr: "TE",  label: "Thioesterase" },         // amber
  "Epimerization":     { fill: "#be123c", abbr: "E",   label: "Epimerization" },        // rose-red
  "Heterocyclization": { fill: "#134e4a", abbr: "Cy",  label: "Heterocyclization" },    // very dark teal
  // Docking / misc
  "PKS_Docking_Nterm": { fill: "#374151", abbr: "Dn",  label: "Docking N-term" },       // dark charcoal
  "PKS_Docking_Cterm": { fill: "#6b7280", abbr: "Dc",  label: "Docking C-term" },       // gray
  "FkbH":              { fill: "#14532d", abbr: "Fk",  label: "FkbH-like" },            // very dark green
};
const DV_UNKNOWN = { fill: "#94a3b8", abbr: "?", label: "Unknown domain" };
function dv(type: string | null) {
  return (type && DOMAIN_VIZ[type]) ? DOMAIN_VIZ[type] : DV_UNKNOWN;
}

// ── Nonlinearity popup ────────────────────────────────────────────────────────

type PopupPos = { x: number; y: number };

// ── Component ─────────────────────────────────────────────────────────────────

export default function PathwayDAG({ steps, genes }: { steps: DAGStep[]; genes?: GeneLocus[] }) {
  const { nodes, edges, W, H } = useMemo(() => buildLayout(steps), [steps]);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [popup, setPopup] = useState<{ nodeId: string; pos: PopupPos } | null>(null);
  const { activeIds, setActiveIds } = useGeneHighlight();

  const nodeMap = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes]
  );

  // Fit on mount / resize
  const fit = useCallback(() => {
    const el = containerRef.current;
    if (!el || W === 0 || H === 0) return;
    const z = (el.clientWidth / W) * 0.92;
    setZoom(Math.min(1, Math.max(0.18, z)));
  }, [W, H]);

  // Only auto-fit when the pathway itself changes (W/H change).
  // No ResizeObserver — observing the container causes a feedback loop:
  // zoom-in → SVG overflows → scrollbar shrinks container → ResizeObserver fires → fit() resets zoom.
  useEffect(() => {
    fit();
  }, [fit]);

  // Attach a native (non-passive) wheel listener so preventDefault() actually works.
  // React's synthetic onWheel is passive in modern browsers and cannot prevent scrolling.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => Math.max(0.18, Math.min(3, z * (e.deltaY > 0 ? 0.9 : 1.1))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  if (nodes.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "#aaa" }}>
        No pathway steps available.
      </div>
    );
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative" }} onClick={() => setPopup(null)}>
      {/* ── Node detail popup (domain architecture + nonlinearity) ─────────── */}
      {popup && (() => {
        const n = nodeMap.get(popup.nodeId);
        if (!n) return null;
        const matchedGene = (n.module !== null && genes)
          ? (genes.find((g) => g.gene === n.enzyme || g.locus_tag === n.enzyme) ?? null)
          : null;
        if (!matchedGene && !n.nonlinearity) return null;

        const nRounds = n.nonlinearity
          ? (parseNonlinearity(n.nonlinearity).find((p) => p.type === "Iteration")?.rounds?.length ?? 0)
          : 0;
        const popupW = Math.max(288, 48 + nRounds * 25 + 24);
        const barW   = popupW - 28;

        return (
          <div onClick={(e) => e.stopPropagation()}>
            <div style={{
              position: "absolute", left: popup.pos.x, top: popup.pos.y,
              zIndex: 50, backgroundColor: "#fff", border: "1px solid #dde",
              borderRadius: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.13)",
              padding: "12px 14px", width: popupW, fontSize: 12, pointerEvents: "auto",
            }}>

              {/* ── Domain architecture ──────────────────────────────────── */}
              {matchedGene && (() => {
                const gene = matchedGene;
                const mlLabel = n.module === "0" ? "Loading module"
                              : n.module === "TE" ? "Thioesterase"
                              : `Module ${n.module}`;
                const mlBg    = n.module === "TE" ? "#fef3c7" : n.module === "0" ? "#dcfce7" : "#e8f0fe";
                const mlColor = n.module === "TE" ? "#92400e" : n.module === "0" ? "#166534" : "#1a56db";

                // Determine the gene-local module index for this pathway step.
                // Modules within a gene are ordered N→C terminal, so we rank
                // all pathway nodes that share this enzyme by module number.
                function parseModOrder(m: string | null): number {
                  if (m === "0")  return 0;
                  if (m === "TE") return 99999;
                  const v = parseInt(m ?? "", 10);
                  return isNaN(v) ? 99998 : v;
                }
                const localModIdx: number | null = (() => {
                  if (n.module === null) return null;
                  const sameEnzyme = nodes
                    .filter((nd) => nd.enzyme === n.enzyme && nd.module !== null)
                    .sort((a, b) => parseModOrder(a.module) - parseModOrder(b.module));
                  const idx = sameEnzyme.findIndex((nd) => nd.module === n.module && nd.id === n.id);
                  return idx >= 0 ? idx : null;
                })();

                // Filter domains to only those belonging to this module.
                // Fall back to all domains if module_idx data is absent.
                const hasMidxData = gene.domains.some((d) => d.module_idx !== null);
                const visibleDomains = (hasMidxData && localModIdx !== null)
                  ? gene.domains.filter((d) => d.module_idx === localModIdx)
                  : gene.domains;

                return (
                  <div style={{ marginBottom: n.nonlinearity ? 10 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <code style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e" }}>{gene.gene}</code>
                      {n.module !== null && (
                        <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4,
                          fontWeight: 600, backgroundColor: mlBg, color: mlColor }}>
                          {mlLabel}
                        </span>
                      )}
                    </div>
                    {gene.product && (
                      <div style={{ fontSize: 10, color: "#64748b", fontStyle: "italic", marginBottom: 6 }}>
                        {gene.product}
                      </div>
                    )}
                    {visibleDomains.length > 0 ? (() => {
                      // Scale the bar to the visible domains' span for clarity
                      const domStart = Math.min(...visibleDomains.map((d) => d.start));
                      const domEnd   = Math.max(...visibleDomains.map((d) => d.end));
                      const span     = Math.max(domEnd - domStart, 1);
                      const bx = (bp: number) => ((bp - domStart) / span) * barW;
                      return (
                        <>
                          <svg width={barW} height={26} style={{ display: "block", marginBottom: 5 }}>
                            <rect x={0} y={7} width={barW} height={12} fill="#e2e8f0" rx={3} />
                            {visibleDomains.map((dom, di) => {
                              const x1 = bx(dom.start), x2 = bx(dom.end);
                              const w  = Math.max(x2 - x1, 2);
                              const { fill, abbr } = dv(dom.type);
                              return (
                                <g key={di}>
                                  <rect x={x1} y={4} width={w} height={18} fill={fill} rx={2} opacity={0.9} />
                                  {w >= 16 && (
                                    <text x={x1 + w / 2} y={16} textAnchor="middle"
                                      fontSize={7.5} fontWeight="bold" fill="white">{abbr}</text>
                                  )}
                                </g>
                              );
                            })}
                          </svg>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px",
                            fontSize: 10, color: "#475569" }}>
                            {visibleDomains.map((dom, di) => {
                              const { fill, label } = dv(dom.type);
                              return (
                                <span key={di} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                  <span style={{ width: 7, height: 7, borderRadius: 1, flexShrink: 0,
                                    backgroundColor: fill, display: "inline-block" }} />
                                  {label}
                                </span>
                              );
                            })}
                          </div>
                        </>
                      );
                    })() : (
                      <div style={{ color: "#94a3b8", fontSize: 10, fontStyle: "italic" }}>
                        No domain data available for this gene.
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Divider between sections */}
              {matchedGene && n.nonlinearity && (
                <div style={{ borderTop: "1px solid #eee", margin: "8px 0" }} />
              )}

              {/* ── Nonlinearity section ─────────────────────────────────── */}
              {n.nonlinearity && (() => {
                const parsed = parseNonlinearity(n.nonlinearity);
                if (parsed.length === 0) return null;
                return (
                  <>
                    {parsed.map((p, pi) => (
                      <div key={pi} style={{ marginBottom: pi < parsed.length - 1 ? 10 : 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 11, color: "#6464dc",
                          textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
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
      })()}

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 12,
          zIndex: 10,
          display: "flex",
          gap: 5,
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 11, color: "#aaa", marginRight: 4 }}>
          {nodes.length} steps · {edges.length} edges
        </span>
        {(
          [
            { label: "+", title: "Zoom in", fn: () => setZoom((z) => Math.min(3, z * 1.25)) },
            { label: "−", title: "Zoom out", fn: () => setZoom((z) => Math.max(0.18, z / 1.25)) },
            { label: "Fit", title: "Fit to view", fn: fit },
          ] as { label: string; title: string; fn: () => void }[]
        ).map(({ label, title, fn }) => (
          <button
            key={label}
            onClick={fn}
            title={title}
            style={{
              padding: "2px 9px",
              border: "1px solid #ccd",
              borderRadius: 6,
              background: "#fff",
              cursor: "pointer",
              fontSize: 13,
              color: "#444",
              lineHeight: "1.6",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Canvas ───────────────────────────────────────────────────────── */}
      {/*
        SVG viewport scaling (width/height ≠ viewBox) breaks <foreignObject>
        on Safari/WebKit: path arrows scale but HTML nodes do not.
        Fix: keep SVG at native logical size and use CSS transform on a wrapper
        div. CSS scale applies to the entire rendered element (raster), so
        foreignObject content scales correctly on all browsers.
      */}
      <div
        ref={containerRef}
        className="dag-scroll"
        style={{
          width: "100%",
          height: Math.max(140, Math.round(H * zoom) + 30),
          overflowX: "scroll",
          overflowY: "hidden",
          backgroundColor: "#f8f8fc",
          border: "1px solid #dde",
          borderRadius: 10,
          cursor: "default",
        }}
        onMouseLeave={() => setActiveIds([])}
      >
        {/* Sized to the scaled dimensions so the scrollbar tracks correctly */}
        <div style={{ width: Math.round(W * zoom), height: Math.round(H * zoom), position: "relative", flexShrink: 0 }}>
          {/* CSS scale applied here — affects SVG paths AND foreignObject uniformly */}
          <div style={{ position: "absolute", top: 0, left: 0, transformOrigin: "top left", transform: `scale(${zoom})` }}>
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ display: "block" }}
        >
          {/* ── Arrow marker ─────────────────────────────────────────────── */}
          <defs>
            <marker
              id="dag-arrow"
              markerWidth="9"
              markerHeight="9"
              refX="8"
              refY="3.5"
              orient="auto"
            >
              <path d="M0,0.5 L0,6.5 L8,3.5 z" fill="#9090bb" />
            </marker>
          </defs>

          {/* ── Edges ────────────────────────────────────────────────────── */}
          {edges.map((e) => {
            const src = nodeMap.get(e.source);
            const tgt = nodeMap.get(e.target);
            if (!src || !tgt) return null;
            // Keep an edge visible when either endpoint enzyme is highlighted
            const edgeActive = activeIds.length === 0 ||
              (src.enzyme !== null && activeIds.includes(src.enzyme)) ||
              (tgt.enzyme !== null && activeIds.includes(tgt.enzyme));
            return (
              <path
                key={e.id}
                d={edgePath(
                  src.x + NW,     src.y + NH / 2,
                  tgt.x,          tgt.y + NH / 2
                )}
                fill="none"
                stroke="#9090bb"
                strokeWidth={1.5}
                opacity={edgeActive ? 1 : 0.1}
                markerEnd="url(#dag-arrow)"
              />
            );
          })}

          {/* ── Nodes ────────────────────────────────────────────────────── */}
          {nodes.map((n) => {
            const nl = formatNonlinearity(n.nonlinearity);
            const ml = moduleLabel(n.module);
            const mlBg = ml === "TE" ? "#fef3c7" : ml === "Load" ? "#dcfce7" : "#e8f0fe";
            const mlColor = ml === "TE" ? "#92400e" : ml === "Load" ? "#166534" : "#1a56db";
            const molsToShow = (n.molecules ?? []).slice(0, 2);
            const { strip: stripColor } = stepClassStyle[n.stepClass];

            const isNodeHighlighted =
              activeIds.length > 0 && n.enzyme !== null && activeIds.includes(n.enzyme);

            return (
              <foreignObject
                key={n.order ?? n.id}
                x={n.x}
                y={n.y}
                width={NW}
                height={NH}
                style={{
                  overflow: "visible",
                  opacity: activeIds.length === 0 ? 1 : isNodeHighlighted ? 1 : 0.15,
                  transition: "opacity 0.12s",
                }}
              >
                {/* React correctly handles the HTML namespace inside foreignObject */}
                <div
                  style={{
                    width: NW,
                    height: NH,
                    backgroundColor: nodeBg(n),
                    border: `1.5px solid ${nodeBorder(n)}`,
                    borderRadius: 8,
                    padding: "7px 9px",
                    paddingTop: 11,
                    boxSizing: "border-box",
                    fontFamily: "'Segoe UI', Arial, sans-serif",
                    fontSize: 11,
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                    boxShadow: isNodeHighlighted
                      ? "0 0 0 2px #f59e0b, 0 2px 8px rgba(245,158,11,0.35)"
                      : "0 1px 3px rgba(0,0,0,0.08)",
                    position: "relative",
                    cursor: (n.nonlinearity || (n.module !== null && !!genes)) ? "pointer" : "default",
                    outline: popup?.nodeId === n.id ? "2px solid #6464dc" : "none",
                    outlineOffset: -2,
                  }}
                  onMouseEnter={() => { if (n.enzyme) setActiveIds([n.enzyme]); }}
                  onMouseLeave={() => setActiveIds([])}
                  onClick={(n.nonlinearity || (n.module !== null && !!genes)) ? (e) => {
                    e.stopPropagation();
                    // Toggle off if already open for this node
                    if (popup?.nodeId === n.id) { setPopup(null); return; }
                    const container = containerRef.current;
                    const wrapper = wrapperRef.current;
                    if (!container || !wrapper) return;
                    const cr = container.getBoundingClientRect();
                    const wr = wrapper.getBoundingClientRect();
                    // Anchor popup below the node, centered on it
                    const nodeScreenLeft = cr.left - wr.left + n.x * zoom - container.scrollLeft;
                    const nodeScreenBottom = cr.top - wr.top + (n.y + NH) * zoom - container.scrollTop;
                    const x = Math.max(4, Math.min(nodeScreenLeft, wr.width - 360));
                    setPopup({ nodeId: n.id, pos: { x, y: nodeScreenBottom + 8 } });
                  } : undefined}
                >
                  {/* PKS / NRPS / Other color strip */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 4,
                      borderRadius: "8px 8px 0 0",
                      backgroundColor: stripColor,
                    }}
                  />
                  {/* Row 1: Step order + module badge */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 11,
                        color: "#6464dc",
                        letterSpacing: "0.2px",
                      }}
                    >
                      Step {n.order}
                    </span>
                    {ml && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          padding: "1px 5px",
                          borderRadius: 4,
                          backgroundColor: mlBg,
                          color: mlColor,
                          flexShrink: 0,
                        }}
                      >
                        {ml}
                      </span>
                    )}
                  </div>

                  {/* Row 2: Enzyme (monospace) */}
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 11,
                      color: "#1a1a2e",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={n.enzyme ?? undefined}
                  >
                    {truncate(n.enzyme, 24)}
                  </div>

                  {/* Row 3: Substrate molecules */}
                  {molsToShow.length > 0 && (
                    <div
                      style={{
                        fontSize: 10,
                        color: "#059669",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={n.molecules.join(", ")}
                    >
                      +{molsToShow.map((m) => truncate(m, 18)).join(", ")}
                    </div>
                  )}

                  {/* Row 4: Nonlinearity badge */}
                  {nl && (
                    <div
                      style={{
                        fontSize: 9,
                        padding: "1px 5px",
                        borderRadius: 3,
                        backgroundColor: "#fef3c7",
                        color: "#92400e",
                        alignSelf: "flex-start",
                        marginTop: "auto",
                        flexShrink: 0,
                        maxWidth: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={n.nonlinearity ?? ""}
                    >
                      {nl}
                    </div>
                  )}
                </div>
              </foreignObject>
            );
          })}
        </svg>
          </div>
        </div>
      </div>

      {/* ── Legend ───────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: 14,
          marginTop: 8,
          flexWrap: "wrap",
          fontSize: 11,
          color: "#666",
          paddingLeft: 4,
          alignItems: "center",
        }}
      >
        {/* Node border = position in pathway */}
        {[
          { bg: "#f0fdf4", border: "#34d399", label: "Starting step" },
          { bg: "#ffffff", border: "#c4c4e8", label: "Intermediate" },
          { bg: "#fff7ed", border: "#f59e0b", label: "Final product" },
        ].map(({ bg, border, label }) => (
          <span
            key={label}
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            <span
              style={{
                display: "inline-block",
                width: 12,
                height: 12,
                borderRadius: 3,
                backgroundColor: bg,
                border: `1.5px solid ${border}`,
                flexShrink: 0,
              }}
            />
            {label}
          </span>
        ))}

        {/* Divider */}
        <span style={{ color: "#dde", userSelect: "none" }}>│</span>

        {/* Background = module type */}
        {[
          { bg: "#e8f0fe", label: "Module"   },
          { bg: "#dcfce7", label: "Loading"  },
          { bg: "#fef3c7", label: "TE"       },
          { bg: "#ffffff", label: "No module" },
        ].map(({ bg, label }) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{
              display: "inline-block",
              width: 12,
              height: 12,
              borderRadius: 3,
              backgroundColor: bg,
              border: "1.5px solid #c4c4e8",
              flexShrink: 0,
            }} />
            {label}
          </span>
        ))}

        {/* Divider */}
        <span style={{ color: "#dde", userSelect: "none" }}>│</span>

        {/* Top strip = reaction type */}
        {(["PKS", "NRPS", "Other"] as StepClass[]).map((cls) => (
          <span
            key={cls}
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            <span
              style={{
                display: "inline-block",
                width: 18,
                height: 4,
                borderRadius: 2,
                backgroundColor: stepClassStyle[cls].strip,
                flexShrink: 0,
              }}
            />
            {stepClassStyle[cls].label}
          </span>
        ))}

        <span style={{ color: "#aaa", marginLeft: "auto" }}>
          Scroll to pan · Wheel to zoom
        </span>
      </div>
    </div>
  );
}
