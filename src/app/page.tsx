import fs from "fs";
import path from "path";

// ── Data helpers (server-side only, runs at build time) ───────────────────────

function computeStats() {
  const root = process.cwd();

  const pathways: Record<string, {
    biosynthetic_class: string | null;
    steps: unknown[];
  }> = JSON.parse(
    fs.readFileSync(path.join(root, "data/normalized/biosynthesis_pathways.json"), "utf8")
  ).pathways;

  const species: Record<string, { organism: string | null }> = JSON.parse(
    fs.readFileSync(path.join(root, "data/normalized/species.json"), "utf8")
  );

  const loci: Record<string, { genes: { domains: unknown[] }[] }> = JSON.parse(
    fs.readFileSync(path.join(root, "data/normalized/gene_loci.json"), "utf8")
  );

  const ids = Object.keys(pathways);

  // Cluster type counts
  let pks = 0, nrps = 0, hybrid = 0;
  for (const id of ids) {
    const u = (pathways[id].biosynthetic_class ?? "").toUpperCase();
    if (u.includes("NRPS") && u.includes("PKS")) hybrid++;
    else if (u.includes("NRPS")) nrps++;
    else if (u.includes("PKS")) pks++;
  }

  // Total biosynthetic reaction steps
  let steps = 0;
  for (const id of ids) steps += pathways[id].steps.length;

  // Distinct producing organisms
  const organisms = new Set<string>();
  for (const id of ids) {
    const org = species[id]?.organism;
    if (org) organisms.add(org);
  }

  // Genes and domain annotations (only for our 356 BGCs)
  let genes = 0, domains = 0;
  for (const id of ids) {
    if (!loci[id]) continue;
    genes   += loci[id].genes.length;
    domains += loci[id].genes.reduce((s, g) => s + g.domains.length, 0);
  }

  return {
    total:     ids.length,
    pks,
    nrps,
    hybrid,
    steps,
    organisms: organisms.size,
    genes,
    domains,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AboutPage() {
  const s = computeStats();

  const primaryStats = [
    { value: s.total.toLocaleString(),     label: "BGC Entries" },
    { value: s.pks.toLocaleString(),       label: "T1PKS Clusters" },
    { value: s.nrps.toLocaleString(),      label: "NRPS Clusters" },
    { value: s.hybrid.toLocaleString(),    label: "PKS-NRPS Hybrid clusters" },
  ];

  const depthStats = [
    { value: s.steps.toLocaleString(),     label: "Biosynthetic Reactions" },
    { value: s.organisms.toLocaleString(), label: "Producing Organisms" },
    { value: s.genes.toLocaleString(),     label: "Biosynthetic Genes" },
    { value: s.domains.toLocaleString(),   label: "Domain Annotations" },
  ];

  return (
    <div style={{ maxWidth: "100%" }}>
      {/* Hero */}
      <div style={{ marginBottom: "48px" }}>
        {/* Title with logo */}
        <h2 className="page-heading" style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/image/logo.svg" alt="NPdia logo" style={{ height: "2em", width: "auto", flexShrink: 0 }} />
          <span>Domain-resolved, step-by-step chemical structures for Type I PKS and NRPS biosynthetic pathways</span>
        </h2>

        {/* Responsive: image left / text right */}
        <div className="about-layout">
          <div className="about-layout-image">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/image/Scheme.png" alt="NPdia biosynthesis pathway scheme" />
          </div>
          <div className="about-layout-text">
            <h3 className="section-heading">About</h3>
            <p style={{ fontSize: "17px", lineHeight: 1.8, color: "#444" }}>
              <strong>N</strong>RPS/<strong>P</strong>KS biosynthesis pathway encyclope<strong>dia</strong> (NPdia) is a manually curated database of Type I PKS (T1PKS) and NRPS biosynthetic pathways from Actinomycetota, providing step-by-step SMILES representations (a plain-text notation for chemical structures) of every biosynthetic intermediate from starter unit loading to final scaffold release.
            </p>
            <p style={{ fontSize: "17px", lineHeight: 1.8, color: "#444" }}>
              Actinomycetota contribute 51% of all bacterial BGCs, and T1PKS and NRPS represent 42% of Actinomycetota BGCs — yet the biochemical intermediates they produce have never been systematically represented. NPdia fills this gap by linking each enzymatic domain to its chemical outcome, making genotype–phenotype relationships explicit at domain resolution.
            </p>
            <p style={{ fontSize: "17px", lineHeight: 1.8, color: "#444" }}>
              All entries are curated from primary literature and validated using an AI-assisted pipeline integrated with BGC GenBank files. The full dataset — step-by-step SMILES, tabular reaction data, and source GenBank files — is freely downloadable for use in pathway engineering, machine learning, and drug discovery.
            </p>
          </div>
        </div>
      </div>

      {/* Key Features */}
      <section style={{ marginBottom: "40px" }}>
        <h3 className="section-heading">Key Features</h3>
        <ul style={{ paddingLeft: "20px", lineHeight: 2, color: "#555", fontSize: "17px" }}>
          <li>Step-by-step SMILES for every biosynthetic intermediate</li>
          <li>Gene-to-reaction mapping with domain-level annotation (including inactive, missing, transAT, and iterative states)</li>
          <li>Search and filter by class, organism, or compound</li>
          <li>Full dataset download for downstream analysis and reuse (e.g., machine-learning training, retrobiosynthesis prediction)</li>
        </ul>
      </section>

      {/* Data Summary */}
      <section>
        <h3 className="section-heading">Data Summary</h3>

        {/* Row 1: cluster type breakdown */}
        <div className="stats-grid" style={{ marginBottom: "clamp(10px, 1.5vw, 16px)" }}>
          {primaryStats.map(({ label, value }) => (
            <div key={label} className="stats-card">
              <div className="stats-card-value">{value}</div>
              <div style={{ fontSize: "13px", color: "#888", marginTop: "6px" }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Row 2: annotation depth */}
        <div className="stats-grid">
          {depthStats.map(({ label, value }) => (
            <div key={label} className="stats-card">
              <div className="stats-card-value" style={{ fontSize: "clamp(20px, 2vw, 26px)" }}>
                {value}
              </div>
              <div style={{ fontSize: "13px", color: "#888", marginTop: "6px" }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}