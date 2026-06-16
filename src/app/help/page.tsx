export const metadata = {
  title: "Help | NPdia",
  description: "NPdia documentation, column descriptions, and SMILES notation guide",
};

const S = {
  page: {
    width: "100%",
  } as React.CSSProperties,


  subtitle: {
    fontSize: "15px",
    color: "#888",
    marginTop: 0,
    marginBottom: "36px",
  } as React.CSSProperties,

  hr: {
    border: "none",
    borderTop: "1px solid #dde",
    margin: "36px 0",
  } as React.CSSProperties,

  h2: {
    fontSize: "20px",
    fontWeight: 700,
    color: "#1a1a2e",
    marginTop: "36px",
    marginBottom: "16px",
    paddingBottom: "8px",
    borderBottom: "2px solid #eef",
  } as React.CSSProperties,

  h3: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#1a1a2e",
    marginTop: "24px",
    marginBottom: "8px",
  } as React.CSSProperties,

  p: {
    fontSize: "17px",
    color: "#444",
    lineHeight: 1.8,
    marginTop: 0,
    marginBottom: "12px",
  } as React.CSSProperties,

  li: {
    fontSize: "17px",
    color: "#444",
    lineHeight: 1.8,
    marginBottom: "4px",
  } as React.CSSProperties,

  code: {
    fontFamily: "monospace",
    fontSize: "13px",
    backgroundColor: "#f0f0f8",
    color: "#5c35a0",
    padding: "1px 5px",
    borderRadius: "4px",
    border: "1px solid #e0e0f0",
  } as React.CSSProperties,

  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: "13.5px",
    marginTop: "12px",
    marginBottom: "16px",
  } as React.CSSProperties,

  th: {
    backgroundColor: "#f5f5fb",
    padding: "9px 14px",
    textAlign: "left" as const,
    fontWeight: 600,
    color: "#444",
    borderBottom: "2px solid #dde",
    whiteSpace: "nowrap" as const,
  } as React.CSSProperties,

  td: {
    padding: "9px 14px",
    color: "#444",
    borderBottom: "1px solid #eef",
    lineHeight: 1.6,
    verticalAlign: "top" as const,
  } as React.CSSProperties,

  note: {
    backgroundColor: "#f5f5fb",
    border: "1px solid #dde",
    borderRadius: "8px",
    padding: "14px 18px",
    fontSize: "13.5px",
    color: "#555",
    lineHeight: 1.7,
    marginTop: "8px",
  } as React.CSSProperties,
};

function Code({ children }: { children: React.ReactNode }) {
  return <code style={S.code}>{children}</code>;
}

export default function HelpPage() {
  return (
    <div style={S.page}>

      {/* ── Title ─────────────────────────────────────────────────────── */}
      <h1 className="page-heading">NPdia Help &amp; Documentation</h1>
      <p style={S.subtitle}>Reference guide for understanding and using the database</p>

      {/* ── Overview ──────────────────────────────────────────────────── */}
      <h2 style={S.h2}>Overview</h2>
      <p style={S.p}>
        NPdia is a manually curated database of Type I PKS (T1PKS) and NRPS biosynthetic pathways
        from actinomycetes. Each entry represents a complete biosynthetic pathway reconstructed from
        published literature, with every intermediate captured as a SMILES string.
      </p>

      <hr style={S.hr} />

      {/* ── Repository Table ──────────────────────────────────────────── */}
      <h2 style={S.h2}>Column Descriptions</h2>

      <h3 style={S.h3}>MIBiG ID</h3>
      <p style={S.p}>
        The biosynthetic gene cluster (BGC) identifier from the MIBiG repository. Clicking the ID
        links directly to the corresponding MIBiG entry.
      </p>

      <h3 style={S.h3}>Compound</h3>
      <p style={S.p}>
        The name of the natural product(s) produced by the BGC, along with the producing organism.
      </p>

      <h3 style={S.h3}>Biosynthetic Class</h3>
      <p style={S.p}>
        The enzyme class responsible for biosynthesis: T1PKS, NRPS, or Hybrid (PKS-NRPS).
      </p>

      <h3 style={S.h3}>Steps</h3>
      <p style={S.p}>
        The total number of biosynthetic steps curated for the pathway, from starter unit loading
        to the final scaffold product.
      </p>

      <hr style={S.hr} />

      {/* ── Pathway Table ─────────────────────────────────────────────── */}
      <h2 style={S.h2}>Pathway Table Columns</h2>

      <h3 style={S.h3}>Order</h3>
      <p style={S.p}>
        The sequential step number within the biosynthetic pathway. Steps are numbered starting
        from 1.
      </p>

      <h3 style={S.h3}>Enzyme</h3>
      <p style={S.p}>
        The gene or protein responsible for catalysing the reaction at this step, as annotated in
        the corresponding MIBiG GenBank file.
      </p>

      <h3 style={S.h3}>Module</h3>
      <p style={S.p}>The module number within the assembly line.</p>
      <ul style={{ paddingLeft: "20px", margin: "0 0 12px 0" }}>
        <li style={S.li}><strong>0</strong> — Loading module (starter unit is loaded onto the first ACP/T domain)</li>
        <li style={S.li}><strong>1, 2, 3, …</strong> — Elongation modules in order</li>
        <li style={S.li}><strong>TE</strong> — Thioesterase domain (product release)</li>
      </ul>

      <h3 style={S.h3}>Nonlinearity</h3>
      <p style={S.p}>
        Describes any deviation from standard linear module activity. This field is left blank for
        standard elongation steps. Possible annotations include:
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Annotation</th>
              <th style={S.th}>Description</th>
            </tr>
          </thead>
          <tbody>
            {[
              {
                ann: "Inactive: [domain]",
                desc: "The specified domain (e.g. KR, DH, ER) is present in the gene sequence but non-functional at this step",
              },
              {
                ann: "Missing: [domain]",
                desc: "The specified domain is absent from the gene sequence but its chemical transformation is observed in the product, suggesting activity in trans or by an uncharacterised enzyme",
              },
              {
                ann: "transAT: [gene, substrate]",
                desc: "The AT domain is provided in trans by a separate enzyme rather than being part of the module itself",
              },
              {
                ann: "Iteration: [domains, substrate]",
                desc: "The module is used iteratively; the domains and substrate used in each iteration are listed",
              },
              {
                ann: "ModuleSkip",
                desc: "This module is skipped in the biosynthesis of this particular product",
              },
            ].map((row, i) => (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#fafafe" }}>
                <td style={{ ...S.td, whiteSpace: "nowrap" }}>
                  <Code>{row.ann}</Code>
                </td>
                <td style={S.td}>{row.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={S.h3}>Substrate</h3>
      <p style={S.p}>
        The compound(s) required to produce the intermediate shown in the Product column of the
        same row.
      </p>
      <ul style={{ paddingLeft: "20px", margin: "0 0 12px 0" }}>
        <li style={S.li}>
          If multiple compounds are listed separated by <strong><Code>;</Code></strong>, all are
          required (AND logic). For example, <Code>1-3;Malonyl-CoA</Code> means the product of
          step 1-3 is extended by Malonyl-CoA.
        </li>
        <li style={S.li}>
          If compounds are listed separated by <strong><Code>/</Code></strong> within parentheses,
          either may be used (OR logic), and the variable position is represented as an R-group
          (<Code>[R]</Code>) in the SMILES.
        </li>
        <li style={S.li}>
          A <Code>?</Code> indicates that the substrate identity is unknown from the available
          literature.
        </li>
      </ul>

      <h3 style={S.h3}>Product (SMILES)</h3>
      <p style={S.p}>
        The SMILES string representing the biosynthetic intermediate produced at this step. See
        the <a href="#smiles" style={{ color: "#6464dc" }}>SMILES Notation</a> section below for
        details.
      </p>

      <h3 style={S.h3}>Product_ID</h3>
      <p style={S.p}>
        A unique identifier for the intermediate produced at this step, in the format{" "}
        <Code>[BGC_number]-[step_number]</Code> (e.g. <Code>55-3</Code>). These IDs are used in
        the Substrate column of subsequent steps to indicate which intermediate is carried forward,
        enabling tracing of the full biosynthetic trajectory.
      </p>

      <hr style={S.hr} />

      {/* ── SMILES Notation ───────────────────────────────────────────── */}
      <h2 id="smiles" style={S.h2}>SMILES Notation</h2>
      <p style={S.p}>
        All SMILES strings in NPdia were generated by manually tracing each biosynthetic step from
        the primary literature and drawing the corresponding intermediate structure in ChemDraw,
        followed by conversion to SMILES format.
      </p>

      <h3 style={S.h3}>Key conventions</h3>
      <ul style={{ paddingLeft: "20px", margin: "0 0 12px 0" }}>
        <li style={{ ...S.li, marginBottom: "10px" }}>
          <strong>Thioester terminus:</strong> The growing PKS chain is anchored to an acyl carrier
          protein (ACP) domain via a thioester bond during biosynthesis. In NPdia, the
          thioester-ACP linkage (<Code>–C(=O)–S–ACP</Code>) is represented as a free hydroxyl
          group (<Code>–C(=O)–OH</Code>) for simplicity and compatibility with standard
          cheminformatics tools.
        </li>
        <li style={{ ...S.li, marginBottom: "10px" }}>
          <strong>R-groups:</strong> When a substrate step involves an OR branch (see Substrate
          above), the variable attachment point is denoted using standard R-group notation (e.g.{" "}
          <Code>[R]</Code>, <Code>[R1]</Code>, <Code>[R2]</Code>). These can be replaced with the
          appropriate substructure depending on which branch is followed.
        </li>
        <li style={{ ...S.li, marginBottom: "10px" }}>
          <strong>Stereochemistry:</strong> Where stereochemistry is specified in the source
          literature, it is encoded in the SMILES using standard <Code>@</Code> and{" "}
          <Code>@@</Code> notation.
        </li>
        <li style={{ ...S.li, marginBottom: "10px" }}>
          <strong>Incomplete structures:</strong> For steps where the full intermediate structure is
          not reported in the literature, the SMILES may be partial or absent. These entries are
          left blank rather than inferred.
        </li>
      </ul>

      <hr style={S.hr} />

      {/* ── Downloading Data ──────────────────────────────────────────── */}
      <h2 style={S.h2}>Downloading Data</h2>
      <p style={S.p}>
        The full NPdia dataset is available for download from the{" "}
        <a href="/download" style={{ color: "#6464dc" }}>Download</a> page in Excel format (.xlsx).
      </p>
      <p style={S.p}>
        The downloaded file contains all pathway entries with the following columns: MIBiG ID,
        Compound, Class, Order, Enzyme, Module, Nonlinearity, Substrate, Product (SMILES),
        Product_ID, and associated metadata.
      </p>

      <h3 style={S.h3}>Potential use cases</h3>
      <ul style={{ paddingLeft: "20px", margin: "0 0 12px 0" }}>
        <li style={{ ...S.li, marginBottom: "10px" }}>
          <strong>Machine learning:</strong> The curated intermediate SMILES can be used to train
          or benchmark models for biosynthesis prediction, retrosynthesis, or domain function
          annotation.
        </li>
        <li style={{ ...S.li, marginBottom: "10px" }}>
          <strong>Pathway engineering:</strong> Step-by-step intermediates enable identification of
          branch points for combinatorial biosynthesis and rational pathway modification.
        </li>
        <li style={{ ...S.li, marginBottom: "10px" }}>
          <strong>Cheminformatics:</strong> The dataset is compatible with standard toolkits such
          as RDKit and CDK for substructure analysis, similarity searching, and reaction mapping.
        </li>
        <li style={{ ...S.li, marginBottom: "10px" }}>
          <strong>Cross-referencing:</strong> Product_IDs and MIBiG IDs allow direct integration
          with MIBiG and other BGC databases.
        </li>
      </ul>

      <hr style={S.hr} />

      {/* ── Contact ───────────────────────────────────────────────────── */}
      <h2 style={S.h2}>Contact</h2>
      <p style={S.p}>
        For questions, error reports, or suggestions for new entries, please contact:
      </p>
      <div style={S.note}>
        <em style={{ color: "#aaa" }}>[Contact email or GitHub Issues link — to be filled in]</em>
      </div>

    </div>
  );
}