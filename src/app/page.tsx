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
    { value: s.hybrid.toLocaleString(),    label: "PKS-NRPS hybrid Clusters" },
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
        <h2 className="page-heading">About</h2>
        <p style={{ fontSize: "17px", lineHeight: 1.8, color: "#444" }}>
          <strong>N</strong>RPS/<strong>P</strong>KS biosynthesis pathway encyclope<strong>dia</strong> (NPdia) is a manually curated resource for biosynthetic pathway reconstruction of actinomycete-derived modular Type I PKS and NRPS biosynthetic gene clusters (BGCs).
          This website provides a curated database of natural product
          biosynthesis pathways, with a focus on{" "}
          <strong>Type I Polyketide Synthase (T1PKS)</strong> and{" "}
          <strong>Non-Ribosomal Peptide Synthetase (NRPS)</strong> gene
          clusters.
        </p>
      </div>

      {/* Project Overview */}
      <section style={{ marginBottom: "40px" }}>
        <h3 className="section-heading">Project Overview</h3>
        <p style={{ lineHeight: 1.8, color: "#555" }}>
          The database aggregates biosynthetic pathway information from
          published literature and the MIBiG repository. Each entry is manually
          curated and linked to its original publication, providing reliable
          references for researchers studying secondary metabolite biosynthesis.
        </p>
      </section>

      {/* Key Features */}
      <section style={{ marginBottom: "40px" }}>
        <h3 className="section-heading">Key Features</h3>
        <ul style={{ paddingLeft: "20px", lineHeight: 2, color: "#555" }}>
          <li>Browse curated T1PKS and NRPS biosynthesis pathway entries</li>
          <li>View detailed compound, organism, and module information</li>
          <li>Filter and search repository entries</li>
          <li>Downloadable the full dataset for machine learning</li>
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