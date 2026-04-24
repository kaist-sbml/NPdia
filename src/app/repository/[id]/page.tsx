import fs from "fs";
import path from "path";
import Link from "next/link";
import { notFound } from "next/navigation";
import PathwayDAG from "@/components/PathwayDAG";
import StepsTable from "@/components/StepsTable";
import GeneLociMap from "@/components/GeneLociMap";
import { GeneHighlightProvider } from "@/components/GeneHighlightContext";

// ── Types ─────────────────────────────────────────────────────────────────────

type Substrate = {
  raw: string;
  precursor_refs: string[] | null;
  molecules: string[] | null;
};

type Step = {
  order: string;
  enzyme: string;
  module: string | null;
  nonlinearity: string | null;
  substrate: Substrate;
  product_smiles: string;
  product_id: string;
};

type Pathway = {
  mibig_id: string;
  compound_name: string;
  biosynthetic_class: string | null;
  doi: string | null;
  quality: string | null;
  source_sheet: string | null;
  steps: Step[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function deriveCategory(cls: string | null) {
  if (!cls) return "Unknown";
  const u = cls.toUpperCase();
  if (u.includes("NRPS") && u.includes("PKS")) return "Hybrid";
  if (u.includes("NRPS")) return "NRPS";
  if (u.includes("PKS")) return "PKS";
  return "Unknown";
}

const categoryStyle: Record<string, { bg: string; color: string }> = {
  PKS: { bg: "#e8f0fe", color: "#1a56db" },
  NRPS: { bg: "#fce8f4", color: "#9d174d" },
  Hybrid: { bg: "#ede9fe", color: "#6d28d9" },
  Unknown: { bg: "#f3f4f6", color: "#6b7280" },
};

function readPathways(): Record<string, Pathway> {
  const filePath = path.join(
    process.cwd(),
    "data",
    "normalized",
    "biosynthesis_pathways.json"
  );
  return JSON.parse(fs.readFileSync(filePath, "utf-8")).pathways;
}

function readMibigLinks(): Record<string, { version: number | null; url: string | null }> {
  const filePath = path.join(
    process.cwd(),
    "data",
    "normalized",
    "mibig_links.json"
  );
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function readSpecies(): Record<string, { organism: string | null; taxonomy: string[] }> {
  const filePath = path.join(
    process.cwd(),
    "data",
    "normalized",
    "species.json"
  );
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

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

function readGeneLoci(id: string): { total_length: number; genes: GeneLocus[] } | null {
  const filePath = path.join(
    process.cwd(),
    "data",
    "normalized",
    "gene_loci.json"
  );
  const all = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return all[id] ?? null;
}

// ── Static params (pre-render all 163 entries) ────────────────────────────────

export function generateStaticParams() {
  const pathways = readPathways();
  return Object.keys(pathways).map((id) => ({ id }));
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function EntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pathways = readPathways();
  const entry = pathways[id];

  if (!entry) notFound();

  const mibigLinks = readMibigLinks();
  const mibigUrl = mibigLinks[id]?.url ?? null;

  const speciesData = readSpecies();
  const species = speciesData[id] ?? { organism: null, taxonomy: [] };

  const loci = readGeneLoci(id);

  const category = deriveCategory(entry.biosynthetic_class);
  const catStyle = categoryStyle[category];

  return (
    <div style={{ maxWidth: "100%" }}>
      {/* Back link */}
      <Link
        href="/repository"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "13.5px",
          color: "#6464dc",
          textDecoration: "none",
          marginBottom: "24px",
        }}
      >
        ← Back to Repository
      </Link>

      {/* ── Header card ─────────────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: "#fff",
          border: "1px solid #dde",
          borderRadius: "12px",
          padding: "28px 32px",
          marginBottom: "28px",
          boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
        }}
      >
        {/* Badges row */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            marginBottom: "12px",
          }}
        >
          <span
            style={{
              fontFamily: "monospace",
              fontSize: "13px",
              fontWeight: 600,
              padding: "3px 10px",
              borderRadius: "6px",
              backgroundColor: "#f5f5fb",
              color: "#6464dc",
              border: "1px solid #dde",
            }}
          >
            {entry.mibig_id}
          </span>
          <span
            style={{
              fontSize: "12.5px",
              fontWeight: 600,
              padding: "3px 10px",
              borderRadius: "6px",
              backgroundColor: catStyle.bg,
              color: catStyle.color,
            }}
          >
            {category}
          </span>
        </div>

        {/* Compound name */}
        <h2 className="compound-title">{entry.compound_name}</h2>

        {/* Metadata grid */}
        <dl className="meta-grid">
          <dt style={{ color: "#888", fontWeight: 500 }}>Producing organism</dt>
          <dd style={{ margin: 0 }}>
            {species.organism ? (
              <span style={{ color: "#333", fontStyle: "italic" }}>{species.organism}</span>
            ) : (
              <span style={{ color: "#ccc" }}>—</span>
            )}
          </dd>

          <dt style={{ color: "#888", fontWeight: 500 }}>Taxonomy</dt>
          <dd style={{ margin: 0 }}>
            {species.taxonomy.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
                {species.taxonomy.map((t, i) => (
                  <span key={i} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{
                      fontSize: "11.5px",
                      padding: "2px 7px",
                      borderRadius: "4px",
                      backgroundColor: i === species.taxonomy.length - 1 ? "#f0fdf4" : "#f5f5fb",
                      color: i === species.taxonomy.length - 1 ? "#166534" : "#555",
                      border: `1px solid ${i === species.taxonomy.length - 1 ? "#bbf7d0" : "#e5e5f0"}`,
                    }}>{t}</span>
                    {i < species.taxonomy.length - 1 && (
                      <span style={{ color: "#ccc", fontSize: "11px" }}>›</span>
                    )}
                  </span>
                ))}
              </div>
            ) : (
              <span style={{ color: "#ccc" }}>—</span>
            )}
          </dd>

          <dt style={{ color: "#888", fontWeight: 500 }}>Biosynthetic class</dt>
          <dd style={{ margin: 0, color: "#333" }}>
            {entry.biosynthetic_class ?? "—"}
          </dd>

          <dt style={{ color: "#888", fontWeight: 500 }}>Total steps</dt>
          <dd style={{ margin: 0, color: "#333" }}>{entry.steps.length}</dd>

          <dt style={{ color: "#888", fontWeight: 500 }}>DOI</dt>
          <dd style={{ margin: 0 }}>
            {entry.doi ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {entry.doi.split(";").map((d) => d.trim()).filter(Boolean).map((d) => (
                  <a
                    key={d}
                    href={`https://doi.org/${d}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: "#6464dc",
                      textDecoration: "none",
                      fontFamily: "monospace",
                      fontSize: "13px",
                    }}
                  >
                    {d}
                  </a>
                ))}
              </div>
            ) : (
              <span style={{ color: "#ccc" }}>—</span>
            )}
          </dd>

          <dt style={{ color: "#888", fontWeight: 500 }}>MIBiG entry</dt>
          <dd style={{ margin: 0 }}>
            {mibigUrl ? (
              <a
                href={mibigUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#6464dc", textDecoration: "none", fontSize: "13px" }}
              >
                View on MIBiG ↗
              </a>
            ) : (
              <span style={{ color: "#ccc" }}>—</span>
            )}
          </dd>
        </dl>
      </div>

      {/* ── Gene Locus Map + Pathway Graph + Steps Table ────────────────────── */}
      {/* GeneHighlightProvider shares hover state between GeneLociMap and       */}
      {/* StepsTable so hovering either highlights the matching element in both. */}
      <GeneHighlightProvider>

        {/* Gene Locus Map */}
        {loci && (
          <>
            <h3 className="section-heading" style={{ marginBottom: "14px" }}>
              Gene Cluster Map
              <span style={{ marginLeft: "10px", fontSize: "13px", fontWeight: 400, color: "#888" }}>
                {loci.genes.length} genes · {loci.total_length.toLocaleString()} bp
              </span>
            </h3>
            <div
              style={{
                backgroundColor: "#fff",
                border: "1px solid #dde",
                borderRadius: "10px",
                padding: "16px 20px",
                marginBottom: "28px",
                boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
              }}
            >
              <GeneLociMap totalLength={loci.total_length} genes={loci.genes} />
            </div>
          </>
        )}

        {/* Pathway Graph */}
        <h3 className="section-heading" style={{ marginBottom: "14px" }}>
          Pathway Graph
        </h3>
        <div style={{ marginBottom: "36px" }}>
          <PathwayDAG steps={entry.steps} genes={loci?.genes} />
        </div>

        {/* Biosynthetic Reactions */}
        <h3 className="section-heading" style={{ marginBottom: "14px" }}>
          Biosynthetic Reactions
          <span
            style={{ marginLeft: "10px", fontSize: "13px", fontWeight: 400, color: "#888" }}
          >
            {entry.steps.length} steps
          </span>
        </h3>
        <StepsTable steps={entry.steps} genes={loci?.genes} />

      </GeneHighlightProvider>
    </div>
  );
}
