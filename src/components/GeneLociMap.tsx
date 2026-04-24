"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGeneHighlight } from "@/components/GeneHighlightContext";

// ── Types ──────────────────────────────────────────────────────────────────────

type GeneDomain = {
  type: string | null;
  start: number;
  end: number;
  strand: number;
  domain_id: string | null;
  module_idx: number | null;
};

type Gene = {
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

type Props = {
  totalLength: number;
  genes: Gene[];
};

// ── Layout constants ───────────────────────────────────────────────────────────

const VW        = 1000;
const LANE_H    = 20;
const LANE_GAP  = 6;
const TRACK_PAD = 12;
const SCALE_H   = 26;
const PAD_X     = 4;
const ARROW_TIP = 10;

// ── Gene kind styles ───────────────────────────────────────────────────────────

type KindStyle = { fill: string; stroke: string; label: string };

const KIND_STYLES: Record<string, KindStyle> = {
  "biosynthetic":            { fill: "#2563eb", stroke: "#1d4ed8", label: "Biosynthetic (core)" },
  "biosynthetic-additional": { fill: "#7c3aed", stroke: "#6d28d9", label: "Biosynthetic (additional)" },
  "regulatory":              { fill: "#d97706", stroke: "#b45309", label: "Regulatory" },
  "transport":               { fill: "#0891b2", stroke: "#0e7490", label: "Transport" },
  "resistance":              { fill: "#dc2626", stroke: "#b91c1c", label: "Resistance" },
  "other":                   { fill: "#64748b", stroke: "#475569", label: "Other" },
};
const UNKNOWN_STYLE: KindStyle = { fill: "#94a3b8", stroke: "#64748b", label: "Unknown" };
function kindStyle(k: string | null): KindStyle {
  return (k && KIND_STYLES[k]) ? KIND_STYLES[k] : UNKNOWN_STYLE;
}

// ── Domain styles ──────────────────────────────────────────────────────────────

type DomainStyle = { fill: string; stroke: string; abbr: string; label: string };

const DOMAIN_STYLES: Record<string, DomainStyle> = {
  // PKS catalytic core — five hue families so each is instantly distinct
  "PKS_KS":            { fill: "#1e40af", stroke: "#3b5fd4", abbr: "KS",  label: "Ketosynthase (KS)" },         // indigo blue
  "PKS_AT":            { fill: "#c2410c", stroke: "#e05c1a", abbr: "AT",  label: "Acyltransferase (AT)" },       // burnt orange
  "PKS_DH":            { fill: "#0e7490", stroke: "#1899b5", abbr: "DH",  label: "Dehydratase (DH)" },           // dark cyan
  "PKS_ER":            { fill: "#166534", stroke: "#1d8043", abbr: "ER",  label: "Enoylreductase (ER)" },        // forest green
  "PKS_KR":            { fill: "#7e22ce", stroke: "#9c35f2", abbr: "KR",  label: "Ketoreductase (KR)" },         // deep violet
  // Carrier proteins — neutral grays
  "ACP":               { fill: "#475569", stroke: "#5e7186", abbr: "ACP", label: "Acyl carrier protein (ACP)" }, // slate
  "PKS_PP":            { fill: "#64748b", stroke: "#7d91a8", abbr: "PP",  label: "Phosphopantetheine (PP)" },    // lighter slate
  // NRPS core — warm reds/amber clearly separated from each other
  "Condensation":      { fill: "#991b1b", stroke: "#c02222", abbr: "C",   label: "Condensation (C)" },          // dark crimson
  "AMP-binding":       { fill: "#b45309", stroke: "#d9660b", abbr: "A",   label: "Adenylation (A)" },           // dark amber
  "PCP":               { fill: "#9d174d", stroke: "#c01e61", abbr: "PCP", label: "Peptidyl carrier (PCP)" },    // dark rose
  "PP-binding":        { fill: "#4c1d95", stroke: "#6528bc", abbr: "PP",  label: "PP-binding" },                // very dark purple
  "NRPS-COM_Nterm":    { fill: "#374151", stroke: "#4b5563", abbr: "Cn",  label: "COM N-term" },                // dark charcoal
  "NRPS-COM_Cterm":    { fill: "#6b7280", stroke: "#9ca3af", abbr: "Cc",  label: "COM C-term" },                // gray
  // Release / tailoring
  "Thioesterase":      { fill: "#d97706", stroke: "#f59e0b", abbr: "TE",  label: "Thioesterase (TE)" },         // amber
  "Epimerization":     { fill: "#be123c", stroke: "#e0184a", abbr: "E",   label: "Epimerization (E)" },         // rose-red
  "Heterocyclization": { fill: "#134e4a", stroke: "#1a6b65", abbr: "Cy",  label: "Heterocyclization (Cy)" },    // very dark teal
  // Docking / misc
  "PKS_Docking_Nterm": { fill: "#374151", stroke: "#4b5563", abbr: "Dn",  label: "Docking N-term" },            // dark charcoal
  "PKS_Docking_Cterm": { fill: "#6b7280", stroke: "#9ca3af", abbr: "Dc",  label: "Docking C-term" },            // gray
  "FkbH":              { fill: "#14532d", stroke: "#1a6e3c", abbr: "Fk",  label: "FkbH-like" },                 // very dark green
};
const UNKNOWN_DOMAIN: DomainStyle = { fill: "#94a3b8", stroke: "#64748b", abbr: "?", label: "Unknown domain" };
function domainStyle(t: string | null): DomainStyle {
  return (t && DOMAIN_STYLES[t]) ? DOMAIN_STYLES[t] : UNKNOWN_DOMAIN;
}

// ── Scale helpers ──────────────────────────────────────────────────────────────

const NICE_STEPS = [50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000];
function pickScaleLength(span: number): number {
  const target = span / 5;
  let best = NICE_STEPS[0], bestDist = Math.abs(NICE_STEPS[0] - target);
  for (const s of NICE_STEPS) {
    const d = Math.abs(s - target);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return best;
}
function formatBp(bp: number): string {
  if (bp >= 1_000_000) return `${(bp / 1_000_000).toFixed(1)} Mb`;
  if (bp >= 1000) return `${(bp / 1000).toFixed(bp % 1000 === 0 ? 0 : 1)} kb`;
  return `${Math.round(bp)} bp`;
}

// ── Lane assignment ────────────────────────────────────────────────────────────

type LaneGene = Gene & { lane: number };
function assignLanes(genes: Gene[]): LaneGene[] {
  const sorted = [...genes].sort((a, b) => a.start - b.start);
  const laneEnds: number[] = [];
  return sorted.map((g) => {
    let assigned = -1;
    for (let i = 0; i < laneEnds.length; i++) {
      if (g.start > laneEnds[i]) { assigned = i; break; }
    }
    if (assigned === -1) { assigned = laneEnds.length; laneEnds.push(0); }
    laneEnds[assigned] = g.end;
    return { ...g, lane: assigned };
  });
}

// ── Arrow path ─────────────────────────────────────────────────────────────────

function arrowPath(x1: number, x2: number, y0: number, y1: number, strand: number): string {
  const width = x2 - x1;
  const mid   = y0 + (y1 - y0) / 2;
  if (width < 2) return `M ${x1} ${y0} L ${x2} ${y0} L ${x2} ${y1} L ${x1} ${y1} Z`;
  const tip = Math.min(ARROW_TIP, width * 0.6);
  if (strand >= 0) {
    return `M ${x1} ${y0} L ${x2 - tip} ${y0} L ${x2} ${mid} L ${x2 - tip} ${y1} L ${x1} ${y1} Z`;
  } else {
    return `M ${x2} ${y0} L ${x1 + tip} ${y0} L ${x1} ${mid} L ${x1 + tip} ${y1} L ${x2} ${y1} Z`;
  }
}

// ── Tooltip type ───────────────────────────────────────────────────────────────

type TooltipState =
  | { visible: true; x: number; y: number; gene: Gene; domain?: GeneDomain }
  | { visible: false };

// ── Button style ───────────────────────────────────────────────────────────────

const btnStyle: React.CSSProperties = {
  background: "white", border: "1px solid #cbd5e1", borderRadius: 4,
  width: 24, height: 24, fontSize: 15, cursor: "pointer", color: "#475569",
  padding: 0, display: "flex", alignItems: "center", justifyContent: "center",
  userSelect: "none", flexShrink: 0,
};

// ── Main component ─────────────────────────────────────────────────────────────

export default function GeneLociMap({ totalLength, genes }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const svgRef     = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false });
  const { activeIds, setActiveIds } = useGeneHighlight();

  // ── Visible bp range (zoom/pan state) ─────────────────────────────────────
  // Instead of changing the SVG viewBox, we change which bp range maps to the
  // fixed SVG width. This avoids SVG preserveAspectRatio distortion issues.
  const [visBp, setVisBp] = useState({ start: 1, end: totalLength });
  const visBpRef = useRef({ start: 1, end: totalLength });

  function updateVisBp(rawStart: number, rawEnd: number) {
    const span       = rawEnd - rawStart;
    const minSpan    = Math.min(200, totalLength);
    const clampSpan  = Math.max(minSpan, span);
    let s = rawStart;
    let e = s + clampSpan;
    if (e > totalLength) { e = totalLength; s = e - clampSpan; }
    if (s < 1)           { s = 1;           e = Math.min(totalLength, s + clampSpan); }
    const next = { start: Math.round(s), end: Math.round(e) };
    visBpRef.current = next;
    setVisBp(next);
  }

  // ── Geometry ───────────────────────────────────────────────────────────────
  const laneGenes = useMemo(() => assignLanes(genes), [genes]);
  const numLanes  = useMemo(
    () => laneGenes.length === 0 ? 1 : Math.max(...laneGenes.map((g) => g.lane)) + 1,
    [laneGenes],
  );
  const trackTop  = TRACK_PAD;
  const trackH    = numLanes * (LANE_H + LANE_GAP) - LANE_GAP;
  const trackMid  = trackTop + trackH / 2;
  const svgH      = TRACK_PAD + trackH + TRACK_PAD + SCALE_H;
  const drawW     = VW - 2 * PAD_X;

  // bp → SVG x — uses visBp STATE so render is always consistent
  function bpToX(bp: number): number {
    const span = visBp.end - visBp.start;
    return PAD_X + ((bp - visBp.start) / Math.max(span, 1)) * drawW;
  }

  // Scale bar (adapts to visible bp span)
  const visSpan    = visBp.end - visBp.start;
  const scaleLen   = pickScaleLength(visSpan);
  const scaleWInSvg = (scaleLen / Math.max(visSpan, 1)) * drawW;
  const scaleY     = trackTop + trackH + TRACK_PAD;
  const tickH      = 4;

  const zoomedIn = visBp.start > 1 || visBp.end < totalLength;

  // ── Drag state ─────────────────────────────────────────────────────────────
  const isDragging  = useRef(false);
  const [grabbing, setGrabbing] = useState(false);
  const dragOrigin  = useRef({ clientX: 0, bpStart: 1, bpEnd: totalLength });

  // ── Wheel zoom (non-passive) ───────────────────────────────────────────────
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect   = el.getBoundingClientRect();
      const ratio  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const { start, end } = visBpRef.current;
      const span   = end - start;
      const pivot  = start + ratio * span;         // bp under cursor
      const factor = e.deltaY < 0 ? 1.35 : 1 / 1.35;
      const newSpan = span / factor;
      updateVisBp(pivot - ratio * newSpan, pivot + (1 - ratio) * newSpan);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drag pan (document-level) ──────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current || !svgRef.current) return;
      const rect  = svgRef.current.getBoundingClientRect();
      const dxRatio = (e.clientX - dragOrigin.current.clientX) / rect.width;
      const origSpan = dragOrigin.current.bpEnd - dragOrigin.current.bpStart;
      const dxBp  = -dxRatio * origSpan;
      updateVisBp(
        dragOrigin.current.bpStart + dxBp,
        dragOrigin.current.bpEnd   + dxBp,
      );
    };
    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      setGrabbing(false);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSvgMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    isDragging.current = true;
    setGrabbing(true);
    dragOrigin.current = {
      clientX: e.clientX,
      bpStart: visBpRef.current.start,
      bpEnd:   visBpRef.current.end,
    };
    setTooltip({ visible: false });
  }

  // ── Zoom buttons ───────────────────────────────────────────────────────────
  function zoomIn() {
    const { start, end } = visBpRef.current;
    const cx = (start + end) / 2, span = end - start;
    updateVisBp(cx - span / 2 / 1.5, cx + span / 2 / 1.5);
  }
  function zoomOut() {
    const { start, end } = visBpRef.current;
    const cx = (start + end) / 2, span = end - start;
    updateVisBp(cx - span / 2 * 1.5, cx + span / 2 * 1.5);
  }
  function resetZoom() { updateVisBp(1, totalLength); }

  // ── Tooltip + highlight handlers ───────────────────────────────────────────
  function onEnter(e: React.MouseEvent, g: Gene, domain?: GeneDomain) {
    if (isDragging.current || !wrapperRef.current) return;
    // Broadcast all identifiers for this gene so StepsTable can match either
    setActiveIds([g.gene, g.locus_tag].filter((x): x is string => x !== null));
    const r = wrapperRef.current.getBoundingClientRect();
    setTooltip({ visible: true, x: e.clientX - r.left + 12, y: e.clientY - r.top - 12, gene: g, domain });
  }
  function onMove(e: React.MouseEvent, g: Gene, domain?: GeneDomain) {
    if (isDragging.current || !wrapperRef.current) return;
    const r = wrapperRef.current.getBoundingClientRect();
    setTooltip({ visible: true, x: e.clientX - r.left + 12, y: e.clientY - r.top - 12, gene: g, domain });
  }
  function onLeave() {
    setActiveIds([]);
    setTooltip({ visible: false });
  }

  // ── Legends ────────────────────────────────────────────────────────────────
  const legendKinds = useMemo(() => {
    const seen = new Set<string>();
    for (const g of genes) seen.add(g.gene_kind ?? "__unknown__");
    return ["biosynthetic","biosynthetic-additional","regulatory","transport","resistance","other","__unknown__"]
      .filter((k) => seen.has(k));
  }, [genes]);

  const legendDomains = useMemo(() => {
    const seen = new Set<string>();
    for (const g of genes) for (const d of g.domains) seen.add(d.type ?? "__unknown__");
    const known = Object.keys(DOMAIN_STYLES).filter((k) => seen.has(k));
    if (seen.has("__unknown__")) known.push("__unknown__");
    return known;
  }, [genes]);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (genes.length === 0) {
    return (
      <div style={{ padding: "16px", color: "#64748b", fontStyle: "italic" }}>
        No gene loci available for this BGC.
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>

      {/* Tooltip */}
      {tooltip.visible && (
        <div style={{
          position: "absolute", left: tooltip.x, top: tooltip.y, zIndex: 50,
          background: "white", border: "1px solid #cbd5e1", borderRadius: 6,
          padding: "6px 10px", fontSize: 12, lineHeight: 1.5,
          pointerEvents: "none", maxWidth: 260, boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        }}>
          <div style={{ fontFamily: "monospace", fontWeight: "bold", marginBottom: 2 }}>
            {tooltip.gene.gene ?? "(unnamed)"}
          </div>
          {tooltip.gene.product && (
            <div style={{ fontStyle: "italic", color: "#334155", marginBottom: 2 }}>
              {tooltip.gene.product}
            </div>
          )}
          {tooltip.domain ? (
            <>
              <div style={{ color: "#1e40af", fontWeight: 600, marginBottom: 1 }}>
                {domainStyle(tooltip.domain.type).label}
              </div>
              <div style={{ color: "#64748b" }}>
                {tooltip.domain.start.toLocaleString()} – {tooltip.domain.end.toLocaleString()} bp
              </div>
            </>
          ) : (
            <>
              <div style={{ color: "#64748b" }}>
                {tooltip.gene.start.toLocaleString()} – {tooltip.gene.end.toLocaleString()} bp
              </div>
              <div style={{ color: "#64748b" }}>
                {tooltip.gene.strand === 1 ? "→ forward" : "← reverse"}
              </div>
              {tooltip.gene.gene_kind && (
                <div style={{ color: "#64748b" }}>{kindStyle(tooltip.gene.gene_kind).label}</div>
              )}
              {tooltip.gene.domains.length > 0 && (
                <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>
                  {tooltip.gene.domains.length} domain{tooltip.gene.domains.length > 1 ? "s" : ""}:{" "}
                  {tooltip.gene.domains.map((d) => domainStyle(d.type).abbr).join(" – ")}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Zoom controls */}
      <div style={{
        display: "flex", alignItems: "center", gap: 4,
        justifyContent: "flex-end", marginBottom: 6,
      }}>
        {zoomedIn && (
          <span style={{ fontSize: 11, color: "#94a3b8", marginRight: 4 }}>
            {formatBp(visBp.start)} – {formatBp(visBp.end)}
          </span>
        )}
        <button style={btnStyle} onClick={zoomIn}  title="Zoom in">+</button>
        <button style={btnStyle} onClick={zoomOut} title="Zoom out">−</button>
        {zoomedIn && (
          <button
            style={{ ...btnStyle, width: "auto", padding: "0 8px", fontSize: 11 }}
            onClick={resetZoom} title="Reset zoom"
          >
            reset
          </button>
        )}
      </div>

      {/* SVG — fixed viewBox, zoom achieved by remapping bp→x */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VW} ${svgH}`}
        style={{ width: "100%", height: "auto", cursor: grabbing ? "grabbing" : "grab" }}
        onMouseDown={handleSvgMouseDown}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Glow filter applied to the highlighted gene arrow */}
          <filter id="gene-hl-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {laneGenes.map((g, i) => {
            const x1 = bpToX(g.start), x2 = bpToX(g.end);
            const y0 = trackTop + g.lane * (LANE_H + LANE_GAP), y1 = y0 + LANE_H;
            return (
              <clipPath key={i} id={`gene-clip-${i}`}>
                <path d={arrowPath(x1, x2, y0, y1, g.strand)} />
              </clipPath>
            );
          })}
        </defs>

        {/* Backbone */}
        <line x1={PAD_X} y1={trackMid} x2={VW - PAD_X} y2={trackMid}
          stroke="#dde" strokeWidth={1} />

        {/* Gene arrows + domains */}
        {laneGenes.map((g, i) => {
          const x1 = bpToX(g.start), x2 = bpToX(g.end);
          // Skip genes fully outside the visible area
          if (x2 < 0 || x1 > VW) return null;
          const y0  = trackTop + g.lane * (LANE_H + LANE_GAP), y1 = y0 + LANE_H;
          const ks  = kindStyle(g.gene_kind);
          const d   = arrowPath(x1, x2, y0, y1, g.strand);
          const has = g.domains.length > 0;

          // Highlight state driven by shared context
          const isHighlighted = activeIds.length > 0 && (
            activeIds.includes(g.gene ?? "\x00") ||
            activeIds.includes(g.locus_tag ?? "\x00")
          );
          const baseOpacity = has ? 0.7 : 0.85;
          const geneOpacity = activeIds.length === 0
            ? baseOpacity
            : isHighlighted ? 0.97 : 0.18;

          return (
            <g key={i}>
              <path
                d={d}
                fill={has ? "#e2e8f0" : ks.fill}
                stroke={isHighlighted ? "#f59e0b" : has ? "#94a3b8" : ks.stroke}
                opacity={geneOpacity}
                strokeWidth={isHighlighted ? 2 : 0.5}
                filter={isHighlighted ? "url(#gene-hl-glow)" : undefined}
                cursor="pointer"
                onMouseEnter={(e) => onEnter(e, g)}
                onMouseMove={(e)  => onMove(e, g)}
                onMouseLeave={onLeave}
              />
              {has && (
                <g clipPath={`url(#gene-clip-${i})`}>
                  {g.domains.map((dom, di) => {
                    const dx1 = bpToX(dom.start), dx2 = bpToX(dom.end);
                    if (dx2 < 0 || dx1 > VW) return null;
                    const ds  = domainStyle(dom.type);
                    const dw  = Math.max(dx2 - dx1, 1);
                    return (
                      <g key={di}>
                        <rect
                          x={dx1} y={y0} width={dw} height={LANE_H}
                          fill={ds.fill} stroke={ds.stroke} strokeWidth={0.5} opacity={0.9}
                          cursor="pointer"
                          onMouseEnter={(e) => onEnter(e, g, dom)}
                          onMouseMove={(e)  => onMove(e, g, dom)}
                          onMouseLeave={onLeave}
                        />
                        {dw >= 14 && (
                          <text
                            x={(dx1 + dx2) / 2} y={y0 + LANE_H / 2 + 3.5}
                            textAnchor="middle" fontSize={7} fontWeight="bold"
                            fill="white" pointerEvents="none"
                            style={{ userSelect: "none" }}
                          >
                            {ds.abbr}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              )}
            </g>
          );
        })}

        {/* Scale bar */}
        <line x1={PAD_X} y1={scaleY} x2={PAD_X + scaleWInSvg} y2={scaleY}
          stroke="#64748b" strokeWidth={1} />
        <line x1={PAD_X} y1={scaleY - tickH} x2={PAD_X} y2={scaleY + tickH}
          stroke="#64748b" strokeWidth={1} />
        <line x1={PAD_X + scaleWInSvg} y1={scaleY - tickH}
              x2={PAD_X + scaleWInSvg} y2={scaleY + tickH}
          stroke="#64748b" strokeWidth={1} />
        <text x={PAD_X + scaleWInSvg / 2} y={scaleY + tickH + 11}
          textAnchor="middle" fontSize={10} fill="#64748b">
          {formatBp(scaleLen)}
        </text>
        <text x={VW - PAD_X} y={scaleY + tickH + 11}
          textAnchor="end" fontSize={10} fill="#94a3b8">
          {formatBp(visSpan)} visible · {totalLength.toLocaleString()} bp total
        </text>
      </svg>

      {/* Gene kind legend */}
      {legendKinds.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px",
          marginTop: 6, fontSize: 11, color: "#475569" }}>
          {legendKinds.map((k) => {
            const ks = k === "__unknown__" ? UNKNOWN_STYLE : KIND_STYLES[k];
            return (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <svg width={14} height={10} style={{ flexShrink: 0 }}>
                  <rect x={0} y={0} width={14} height={10}
                    fill={ks.fill} stroke={ks.stroke} strokeWidth={0.5} rx={2} />
                </svg>
                <span>{ks.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Domain legend */}
      {legendDomains.length > 0 && (
        <>
          <div style={{ marginTop: 10, marginBottom: 4, fontSize: 11,
            fontWeight: 600, color: "#64748b" }}>Domains</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 14px",
            fontSize: 11, color: "#475569" }}>
            {legendDomains.map((k) => {
              const ds = k === "__unknown__" ? UNKNOWN_DOMAIN : DOMAIN_STYLES[k];
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <svg width={20} height={10} style={{ flexShrink: 0 }}>
                    <rect x={0} y={0} width={20} height={10}
                      fill={ds.fill} stroke={ds.stroke} strokeWidth={0.5} rx={2} />
                    <text x={10} y={8} textAnchor="middle" fontSize={6.5}
                      fontWeight="bold" fill="white">{ds.abbr}</text>
                  </svg>
                  <span>{ds.label}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

    </div>
  );
}
