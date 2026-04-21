"use client";

import { useMemo, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

type GeneDomain = {
  type: string | null;
  start: number;
  end: number;
  strand: number;
};

type Gene = {
  gene: string | null;
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

const VW        = 1000; // SVG viewBox logical width
const LANE_H    = 20;   // gene arrow height (taller to fit domain labels)
const LANE_GAP  = 6;    // gap between lanes
const TRACK_PAD = 12;   // padding above and below gene track area
const SCALE_H   = 26;   // height reserved for scale bar below track
const PAD_X     = 4;    // left/right padding within viewBox
const ARROW_TIP = 10;   // max arrow tip length

// ── Gene kind color palette ────────────────────────────────────────────────────

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

function kindStyle(geneKind: string | null): KindStyle {
  if (geneKind && KIND_STYLES[geneKind]) return KIND_STYLES[geneKind];
  return UNKNOWN_STYLE;
}

// ── Domain color palette ───────────────────────────────────────────────────────

type DomainStyle = { fill: string; stroke: string; abbr: string; label: string };

const DOMAIN_STYLES: Record<string, DomainStyle> = {
  "PKS_KS":             { fill: "#1e3a8a", stroke: "#1e40af", abbr: "KS",  label: "Ketosynthase (KS)" },
  "PKS_AT":             { fill: "#1d4ed8", stroke: "#2563eb", abbr: "AT",  label: "Acyltransferase (AT)" },
  "PKS_DH":             { fill: "#0369a1", stroke: "#0284c7", abbr: "DH",  label: "Dehydratase (DH)" },
  "PKS_ER":             { fill: "#0891b2", stroke: "#06b6d4", abbr: "ER",  label: "Enoylreductase (ER)" },
  "PKS_KR":             { fill: "#0e7490", stroke: "#0891b2", abbr: "KR",  label: "Ketoreductase (KR)" },
  "ACP":                { fill: "#059669", stroke: "#047857", abbr: "ACP", label: "Acyl carrier protein (ACP)" },
  "PKS_PP":             { fill: "#059669", stroke: "#047857", abbr: "PP",  label: "Phosphopantetheine (PP)" },
  "Condensation":       { fill: "#9d174d", stroke: "#be185d", abbr: "C",   label: "Condensation (C)" },
  "AMP-binding":        { fill: "#be185d", stroke: "#db2777", abbr: "A",   label: "Adenylation (A)" },
  "PCP":                { fill: "#c026d3", stroke: "#a21caf", abbr: "PCP", label: "Peptidyl carrier protein (PCP)" },
  "PP-binding":         { fill: "#7c3aed", stroke: "#6d28d9", abbr: "PP",  label: "PP-binding" },
  "Thioesterase":       { fill: "#d97706", stroke: "#b45309", abbr: "TE",  label: "Thioesterase (TE)" },
  "Epimerization":      { fill: "#dc2626", stroke: "#b91c1c", abbr: "E",   label: "Epimerization (E)" },
  "PKS_Docking_Nterm":  { fill: "#6b7280", stroke: "#4b5563", abbr: "Dn",  label: "Docking N-term" },
  "PKS_Docking_Cterm":  { fill: "#9ca3af", stroke: "#6b7280", abbr: "Dc",  label: "Docking C-term" },
  "FkbH":               { fill: "#16a34a", stroke: "#15803d", abbr: "Fk",  label: "FkbH-like" },
  "NRPS-COM_Nterm":     { fill: "#6b7280", stroke: "#4b5563", abbr: "Cn",  label: "COM N-term" },
  "NRPS-COM_Cterm":     { fill: "#9ca3af", stroke: "#6b7280", abbr: "Cc",  label: "COM C-term" },
  "Heterocyclization":  { fill: "#0f766e", stroke: "#0d9488", abbr: "Cy",  label: "Heterocyclization (Cy)" },
};

const UNKNOWN_DOMAIN: DomainStyle = { fill: "#cbd5e1", stroke: "#94a3b8", abbr: "?", label: "Unknown domain" };

function domainStyle(type: string | null): DomainStyle {
  if (type && DOMAIN_STYLES[type]) return DOMAIN_STYLES[type];
  return UNKNOWN_DOMAIN;
}

// ── Scale bar helpers ──────────────────────────────────────────────────────────

const NICE_STEPS = [100, 200, 500, 1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000];

function pickScaleLength(totalLength: number): number {
  const target = totalLength / 5;
  let best = NICE_STEPS[0];
  let bestDist = Math.abs(NICE_STEPS[0] - target);
  for (const s of NICE_STEPS) {
    const d = Math.abs(s - target);
    if (d < bestDist) { bestDist = d; best = s; }
  }
  return best;
}

function formatBp(bp: number): string {
  if (bp >= 1000) return `${bp / 1000} kb`;
  return `${bp} bp`;
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

// ── Arrow path builder ─────────────────────────────────────────────────────────

function arrowPath(
  x1: number, x2: number,
  y0: number, y1: number,
  strand: number,
): string {
  const width = x2 - x1;
  const mid   = y0 + (y1 - y0) / 2;

  if (width < 2) {
    return `M ${x1} ${y0} L ${x2} ${y0} L ${x2} ${y1} L ${x1} ${y1} Z`;
  }

  const tip = Math.min(ARROW_TIP, width * 0.6);

  if (strand >= 0) {
    return [
      `M ${x1} ${y0}`,
      `L ${x2 - tip} ${y0}`,
      `L ${x2} ${mid}`,
      `L ${x2 - tip} ${y1}`,
      `L ${x1} ${y1}`,
      "Z",
    ].join(" ");
  } else {
    return [
      `M ${x2} ${y0}`,
      `L ${x1 + tip} ${y0}`,
      `L ${x1} ${mid}`,
      `L ${x1 + tip} ${y1}`,
      `L ${x2} ${y1}`,
      "Z",
    ].join(" ");
  }
}

// ── Tooltip ────────────────────────────────────────────────────────────────────

type TooltipState =
  | { visible: true; x: number; y: number; gene: Gene; domain?: GeneDomain }
  | { visible: false };

// ── Main component ─────────────────────────────────────────────────────────────

export default function GeneLociMap({ totalLength, genes }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false });

  const laneGenes = useMemo(() => assignLanes(genes), [genes]);
  const numLanes  = useMemo(
    () => (laneGenes.length === 0 ? 1 : Math.max(...laneGenes.map((g) => g.lane)) + 1),
    [laneGenes],
  );

  const trackTop = TRACK_PAD;
  const trackH   = numLanes * (LANE_H + LANE_GAP) - LANE_GAP;
  const trackMid = trackTop + trackH / 2;
  const svgH     = TRACK_PAD + trackH + TRACK_PAD + SCALE_H;

  const drawW = VW - 2 * PAD_X;
  function bpToX(bp: number): number {
    return PAD_X + ((bp - 1) / Math.max(totalLength - 1, 1)) * drawW;
  }

  const scaleLen = pickScaleLength(totalLength);
  const scaleW   = (scaleLen / totalLength) * drawW;
  const scaleY   = trackTop + trackH + TRACK_PAD;
  const scaleX1  = PAD_X;
  const scaleX2  = scaleX1 + scaleW;
  const tickH    = 4;

  // Gene kind legend (only present kinds)
  const legendKinds = useMemo(() => {
    const seen = new Set<string>();
    for (const g of genes) seen.add(g.gene_kind ?? "__unknown__");
    const order = [
      "biosynthetic", "biosynthetic-additional",
      "regulatory", "transport", "resistance", "other", "__unknown__",
    ];
    return order.filter((k) => seen.has(k));
  }, [genes]);

  // Domain legend (only present domain types, ordered by palette)
  const legendDomains = useMemo(() => {
    const seen = new Set<string>();
    for (const g of genes) {
      for (const d of g.domains) {
        seen.add(d.type ?? "__unknown__");
      }
    }
    const order = Object.keys(DOMAIN_STYLES);
    const present = order.filter((k) => seen.has(k));
    if (seen.has("__unknown__")) present.push("__unknown__");
    return present;
  }, [genes]);

  function handleMouseMove(e: React.MouseEvent, g: Gene, domain?: GeneDomain) {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    setTooltip({
      visible: true,
      x: e.clientX - rect.left + 10,
      y: e.clientY - rect.top - 10,
      gene: g,
      domain,
    });
  }

  function handleMouseLeave() {
    setTooltip({ visible: false });
  }

  if (genes.length === 0) {
    return (
      <div style={{ padding: "16px", color: "#64748b", fontStyle: "italic" }}>
        No gene loci available for this BGC.
      </div>
    );
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          style={{
            position:      "absolute",
            left:          tooltip.x,
            top:           tooltip.y,
            zIndex:        50,
            background:    "white",
            border:        "1px solid #cbd5e1",
            borderRadius:  6,
            padding:       "6px 10px",
            fontSize:      12,
            lineHeight:    1.5,
            pointerEvents: "none",
            maxWidth:      260,
            boxShadow:     "0 2px 8px rgba(0,0,0,0.12)",
          }}
        >
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
                <div style={{ color: "#64748b" }}>
                  {kindStyle(tooltip.gene.gene_kind).label}
                </div>
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

      {/* SVG */}
      <svg
        viewBox={`0 0 ${VW} ${svgH}`}
        style={{ width: "100%", height: "auto" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* One clipPath per gene arrow */}
          {laneGenes.map((g, i) => {
            const x1 = bpToX(g.start);
            const x2 = bpToX(g.end);
            const y0 = trackTop + g.lane * (LANE_H + LANE_GAP);
            const y1 = y0 + LANE_H;
            return (
              <clipPath key={i} id={`gene-clip-${i}`}>
                <path d={arrowPath(x1, x2, y0, y1, g.strand)} />
              </clipPath>
            );
          })}
        </defs>

        {/* Backbone */}
        <line
          x1={PAD_X} y1={trackMid}
          x2={VW - PAD_X} y2={trackMid}
          stroke="#dde" strokeWidth={1}
        />

        {/* Gene arrows + domain blocks */}
        {laneGenes.map((g, i) => {
          const x1  = bpToX(g.start);
          const x2  = bpToX(g.end);
          const y0  = trackTop + g.lane * (LANE_H + LANE_GAP);
          const y1  = y0 + LANE_H;
          const ks  = kindStyle(g.gene_kind);
          const d   = arrowPath(x1, x2, y0, y1, g.strand);
          const hasDomains = g.domains.length > 0;

          return (
            <g key={i}>
              {/* Arrow shell — dimmed fill if domains are present */}
              <path
                d={d}
                fill={hasDomains ? "#e2e8f0" : ks.fill}
                stroke={hasDomains ? "#94a3b8" : ks.stroke}
                opacity={hasDomains ? 0.7 : 0.85}
                strokeWidth={0.5}
                cursor="pointer"
                onMouseEnter={(e) => handleMouseMove(e, g)}
                onMouseMove={(e) => handleMouseMove(e, g)}
                onMouseLeave={handleMouseLeave}
              />

              {/* Domain blocks clipped to arrow shape */}
              {hasDomains && (
                <g clipPath={`url(#gene-clip-${i})`}>
                  {g.domains.map((dom, di) => {
                    const dx1 = bpToX(dom.start);
                    const dx2 = bpToX(dom.end);
                    const ds  = domainStyle(dom.type);
                    const dw  = Math.max(dx2 - dx1, 1);
                    // Show abbreviation label if rect is wide enough
                    const showLabel = dw >= 14;
                    return (
                      <g key={di}>
                        <rect
                          x={dx1} y={y0}
                          width={dw} height={LANE_H}
                          fill={ds.fill}
                          stroke={ds.stroke}
                          strokeWidth={0.5}
                          opacity={0.9}
                          cursor="pointer"
                          onMouseEnter={(e) => handleMouseMove(e, g, dom)}
                          onMouseMove={(e) => handleMouseMove(e, g, dom)}
                          onMouseLeave={handleMouseLeave}
                        />
                        {showLabel && (
                          <text
                            x={(dx1 + dx2) / 2}
                            y={y0 + LANE_H / 2 + 3.5}
                            textAnchor="middle"
                            fontSize={7}
                            fontWeight="bold"
                            fill="white"
                            pointerEvents="none"
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
        <line
          x1={scaleX1} y1={scaleY}
          x2={scaleX2} y2={scaleY}
          stroke="#64748b" strokeWidth={1}
        />
        <line
          x1={scaleX1} y1={scaleY - tickH}
          x2={scaleX1} y2={scaleY + tickH}
          stroke="#64748b" strokeWidth={1}
        />
        <line
          x1={scaleX2} y1={scaleY - tickH}
          x2={scaleX2} y2={scaleY + tickH}
          stroke="#64748b" strokeWidth={1}
        />
        <text
          x={(scaleX1 + scaleX2) / 2}
          y={scaleY + tickH + 11}
          textAnchor="middle"
          fontSize={10}
          fill="#64748b"
        >
          {formatBp(scaleLen)}
        </text>
        <text
          x={VW - PAD_X}
          y={scaleY + tickH + 11}
          textAnchor="end"
          fontSize={10}
          fill="#94a3b8"
        >
          {totalLength.toLocaleString()} bp
        </text>
      </svg>

      {/* Gene kind legend */}
      {legendKinds.length > 0 && (
        <div
          style={{
            display:   "flex",
            flexWrap:  "wrap",
            gap:       "6px 14px",
            marginTop: 6,
            fontSize:  11,
            color:     "#475569",
          }}
        >
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
          <div style={{ marginTop: 10, marginBottom: 4, fontSize: 11, fontWeight: 600, color: "#64748b" }}>
            Domains
          </div>
          <div
            style={{
              display:  "flex",
              flexWrap: "wrap",
              gap:      "5px 14px",
              fontSize: 11,
              color:    "#475569",
            }}
          >
            {legendDomains.map((k) => {
              const ds = k === "__unknown__" ? UNKNOWN_DOMAIN : DOMAIN_STYLES[k];
              return (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <svg width={20} height={10} style={{ flexShrink: 0 }}>
                    <rect x={0} y={0} width={20} height={10}
                      fill={ds.fill} stroke={ds.stroke} strokeWidth={0.5} rx={2} />
                    <text x={10} y={8} textAnchor="middle" fontSize={6.5}
                      fontWeight="bold" fill="white">
                      {ds.abbr}
                    </text>
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
