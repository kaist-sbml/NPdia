"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";

const MoleculeViewer = dynamic(() => import("@/components/MoleculeViewer"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: 260,
        height: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#bbb",
        fontSize: 13,
        backgroundColor: "#fafafa",
        borderRadius: 8,
      }}
    >
      Loading…
    </div>
  ),
});

export type MibigCompound = {
  name: string;
  smiles: string;
  mass: number | null;
  formula: string | null;
};

/** Render a molecular formula with HTML subscript numbers (e.g. C₁₉H₂₂O₆). */
function ChemFormula({ formula }: { formula: string }) {
  const parts = formula.split(/(\d+)/);
  return (
    <span>
      {parts.map((p, i) =>
        /^\d+$/.test(p) ? <sub key={i}>{p}</sub> : <span key={i}>{p}</span>
      )}
    </span>
  );
}

/** Custom styled dropdown, replacing the browser-native <select>. */
function CompoundDropdown({
  compounds,
  idx,
  onChange,
}: {
  compounds: MibigCompound[];
  idx: number;
  onChange: (i: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const cur = compounds[idx];

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          padding: "8px 12px",
          border: open ? "1px solid #9898e0" : "1px solid #ccd",
          borderRadius: open ? "8px 8px 0 0" : 8,
          backgroundColor: open ? "#f5f5fb" : "#fff",
          cursor: "pointer",
          outline: "none",
          boxShadow: open ? "0 0 0 3px rgba(100,100,220,0.10)" : "none",
          transition: "border-color 0.15s, background-color 0.15s, box-shadow 0.15s",
          fontFamily: "inherit",
        }}
      >
        {/* Index badge + name */}
        <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <span
            style={{
              flexShrink: 0,
              fontSize: 10,
              fontWeight: 700,
              lineHeight: 1,
              padding: "2px 5px",
              borderRadius: 4,
              backgroundColor: "#ede9fe",
              color: "#6d28d9",
            }}
          >
            {idx + 1}/{compounds.length}
          </span>
          <span
            style={{
              fontSize: 13,
              color: "#1a1a2e",
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {cur.name}
          </span>
        </span>

        {/* Chevron */}
        <svg
          width={14}
          height={14}
          viewBox="0 0 14 14"
          fill="none"
          style={{
            flexShrink: 0,
            color: "#9898c8",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.18s",
          }}
        >
          <path d="M2 5l5 5 5-5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Option list */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 50,
            backgroundColor: "#fff",
            border: "1px solid #9898e0",
            borderTop: "none",
            borderRadius: "0 0 8px 8px",
            boxShadow: "0 8px 20px rgba(0,0,0,0.10)",
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {compounds.map((c, i) => (
            <DropdownOption
              key={i}
              label={c.name}
              index={i}
              total={compounds.length}
              selected={i === idx}
              isLast={i === compounds.length - 1}
              onSelect={() => { onChange(i); setOpen(false); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DropdownOption({
  label,
  index,
  total,
  selected,
  isLast,
  onSelect,
}: {
  label: string;
  index: number;
  total: number;
  selected: boolean;
  isLast: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 12px",
        border: "none",
        borderBottom: isLast ? "none" : "1px solid #f0f0f8",
        backgroundColor: selected ? "#f5f5fb" : hovered ? "#fafafe" : "#fff",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        transition: "background-color 0.1s",
        borderRadius: isLast ? "0 0 8px 8px" : 0,
      }}
    >
      <span
        style={{
          flexShrink: 0,
          fontSize: 10,
          fontWeight: 700,
          lineHeight: 1,
          padding: "2px 5px",
          borderRadius: 4,
          backgroundColor: selected ? "#ede9fe" : "#f3f4f6",
          color: selected ? "#6d28d9" : "#888",
        }}
      >
        {index + 1}/{total}
      </span>
      <span
        style={{
          fontSize: 13,
          color: selected ? "#6464dc" : "#1a1a2e",
          fontWeight: selected ? 600 : 400,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      {selected && (
        <svg
          width={13}
          height={13}
          viewBox="0 0 13 13"
          fill="none"
          style={{ flexShrink: 0, marginLeft: "auto", color: "#6464dc" }}
        >
          <path d="M2 6.5l3.5 3.5 5.5-6" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

export default function CompoundPanel({ compounds }: { compounds: MibigCompound[] }) {
  const [idx, setIdx] = useState(0);

  if (compounds.length === 0) return null;

  const cur = compounds[Math.min(idx, compounds.length - 1)];

  return (
    <div
      style={{
        flexShrink: 0,
        width: 284,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* ── Dropdown (only when > 1 compound) ──────────────────────────── */}
      {compounds.length > 1 && (
        <CompoundDropdown compounds={compounds} idx={idx} onChange={setIdx} />
      )}

      {/* ── Structure viewer ────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: "#fafafe",
          border: "1px solid #eef",
          borderRadius: 8,
          padding: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <MoleculeViewer smiles={cur.smiles} width={260} height={200} theme="light" />
      </div>

      {/* ── Compound name (single-compound case) ───────────────────────── */}
      {compounds.length === 1 && (
        <div
          style={{
            fontSize: 12,
            color: "#475569",
            textAlign: "center",
            fontStyle: "italic",
          }}
        >
          {cur.name}
        </div>
      )}

      {/* ── Formula + mass ──────────────────────────────────────────────── */}
      {(cur.formula || cur.mass !== null) && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "baseline",
            gap: 12,
            fontSize: 12,
            flexWrap: "wrap",
          }}
        >
          {cur.formula && (
            <span
              style={{
                fontFamily: "monospace",
                color: "#334155",
                fontWeight: 500,
              }}
            >
              <ChemFormula formula={cur.formula} />
            </span>
          )}
          {cur.mass !== null && (
            <span style={{ color: "#94a3b8" }}>
              {cur.mass.toFixed(2)} Da
            </span>
          )}
        </div>
      )}
    </div>
  );
}