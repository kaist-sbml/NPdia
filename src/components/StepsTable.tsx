"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import NonlinearityBadge from "@/components/NonlinearityBadge";

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

// ── Module badge helpers ──────────────────────────────────────────────────────

function moduleLabel(mod: string | null): string | null {
  if (mod === null) return null;
  if (mod === "0") return "Loading";
  if (mod === "TE") return "TE";
  return `M${mod}`;
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

export default function StepsTable({ steps }: { steps: StepRow[] }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

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
                return (
                  <tr
                    key={step.product_id}
                    onClick={() => setSelectedIndex(isSelected ? null : i)}
                    style={{
                      backgroundColor: isSelected
                        ? "#f0f0ff"
                        : i % 2 === 0
                        ? "#fff"
                        : "#fafafe",
                      borderBottom: "1px solid #eef",
                      cursor: "pointer",
                      transition: "background-color 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected)
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          "#f5f5fb";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected)
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          i % 2 === 0 ? "#fff" : "#fafafe";
                    }}
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
          Click any row to view the chemical structure
        </div>
      </div>
    </>
  );
}
