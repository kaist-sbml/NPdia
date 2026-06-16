const files = [
  {
    name: "T1PKS_NRPS_pathways_v1.csv",
    description:
      "Unified flat-file export of all T1PKS and NRPS biosynthesis pathway steps, including MIBiG entry, compound name, class, enzyme, module, substrate, product (SMILES), Product_ID, R group definition, quality, and DOI.",
    size: "~1.2 MB",
    format: "CSV (.csv)",
    version: "v1",
    href: "/downloads/T1PKS_NRPS_pathways_v1.csv",
  },
  {
    name: "biosynthesis_pathways_v1.json",
    description:
      "Full biosynthesis pathway database in JSON format, structured by MIBiG entry with nested compound, enzyme, module, and step-level annotations.",
    size: "~3.5 MB",
    format: "JSON (.json)",
    version: "v1",
    href: "/downloads/biosynthesis_pathways_v1.json",
  },
  {
    name: "GenBank_Files_v1.zip",
    description:
      "GenBank files (.gbk) for 3 BGC entries re-annotated by running AntiSMASH against the host genome sequence, correcting errors in the original MIBiG annotations.",
    size: "~0.2 MB",
    format: "ZIP (.zip)",
    version: "v1",
    href: "/downloads/GenBank_Files_v1.zip",
  },
];

export default function DownloadPage() {
  return (
    <div style={{ maxWidth: "100%" }}>
      <h2 className="page-heading">Download</h2>
      <p style={{ fontSize: "16px", color: "#666", marginBottom: "36px" }}>
        Download the full curated database as structured data files.
      </p>

      {/* File cards */}
      {files.map((file) => (
        <div
          key={file.name}
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #dde",
            borderRadius: "10px",
            padding: "24px",
            marginBottom: "20px",
            boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "24px",
            flexWrap: "wrap",
          }}
        >
          {/* File info */}
          <div style={{ flex: 1, minWidth: "200px" }}>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: "14px",
                fontWeight: 600,
                color: "#1a1a2e",
                marginBottom: "8px",
                wordBreak: "break-all",
              }}
            >
              {file.name}
            </div>
            <p
              style={{
                fontSize: "14px",
                color: "#666",
                lineHeight: 1.7,
                margin: "0 0 12px 0",
              }}
            >
              {file.description}
            </p>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              <span
                style={{
                  fontSize: "12px",
                  color: "#888",
                  backgroundColor: "#f5f5fb",
                  padding: "3px 10px",
                  borderRadius: "999px",
                  border: "1px solid #dde",
                }}
              >
                {file.format}
              </span>
              <span
                style={{
                  fontSize: "12px",
                  color: "#888",
                  backgroundColor: "#f5f5fb",
                  padding: "3px 10px",
                  borderRadius: "999px",
                  border: "1px solid #dde",
                }}
              >
                {file.size}
              </span>
              <span
                style={{
                  fontSize: "12px",
                  color: "#4a6fa5",
                  backgroundColor: "#eef2fa",
                  padding: "3px 10px",
                  borderRadius: "999px",
                  border: "1px solid #c5d3ea",
                  fontWeight: 600,
                }}
              >
                {file.version}
              </span>
            </div>
          </div>

          {/* Download button */}
          <a
            href={file.href}
            download
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 22px",
              backgroundColor: "#1a1a2e",
              color: "#ffffff",
              borderRadius: "8px",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: 600,
              whiteSpace: "nowrap",
              alignSelf: "center",
            }}
          >
            ↓ Download
          </a>
        </div>
      ))}

      {/* Usage note */}
      <div
        style={{
          marginTop: "8px",
          padding: "16px 20px",
          backgroundColor: "#f5f5fb",
          border: "1px solid #dde",
          borderRadius: "8px",
          fontSize: "13px",
          color: "#666",
          lineHeight: 1.7,
        }}
      >
        <strong style={{ color: "#1a1a2e" }}>Usage note:</strong> All data in
        this database is compiled from published literature. If you use this
        dataset in your research, please cite the original publications listed
        in the Repository.
      </div>
    </div>
  );
}
