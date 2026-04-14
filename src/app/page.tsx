export default function AboutPage() {
  return (
    <div style={{ maxWidth: "760px" }}>
      {/* Hero */}
      <div style={{ marginBottom: "48px" }}>
        <h2 className="page-heading">About</h2>
        <p style={{ fontSize: "17px", lineHeight: 1.8, color: "#444" }}>
          This database is a manually curated resource for biosynthetic pathway reconstruction of actinomycete-derived modular Type I PKS and NRPS biosynthetic gene clusters (BGCs).
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

      {/* Data Summary cards */}
      <section>
        <h3 className="section-heading">Data Summary</h3>
        <div className="stats-grid">
          {[
            { label: "Total Entries", value: "—" },
            { label: "T1PKS Clusters", value: "—" },
            { label: "NRPS Clusters", value: "—" },
            { label: "Organisms", value: "—" },
          ].map(({ label, value }) => (
            <div key={label} className="stats-card">
              <div className="stats-card-value">{value}</div>
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
