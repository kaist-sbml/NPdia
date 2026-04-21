import fs from "fs";
import path from "path";
import RepositoryTable, { PathwaySummary } from "@/components/RepositoryTable";

function deriveCategory(
  cls: string | null
): PathwaySummary["category"] {
  if (!cls) return "Unknown";
  const upper = cls.toUpperCase();
  if (upper.includes("NRPS") && upper.includes("PKS")) return "Hybrid";
  if (upper.includes("NRPS")) return "NRPS";
  if (upper.includes("PKS")) return "PKS";
  return "Unknown";
}

export default function RepositoryPage() {
  const filePath = path.join(
    process.cwd(),
    "data",
    "normalized",
    "biosynthesis_pathways.json"
  );
  const speciesPath = path.join(
    process.cwd(),
    "data",
    "normalized",
    "species.json"
  );
  const linksPath = path.join(
    process.cwd(),
    "data",
    "normalized",
    "mibig_links.json"
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const speciesMap: Record<string, { organism: string | null }> = JSON.parse(
    fs.readFileSync(speciesPath, "utf-8")
  );
  const linksMap: Record<string, { url: string | null }> = JSON.parse(
    fs.readFileSync(linksPath, "utf-8")
  );

  const entries: PathwaySummary[] = (
    Object.values(raw.pathways) as any[]
  )
    .map((p) => ({
      mibig_id: p.mibig_id as string,
      compound_name: p.compound_name as string,
      biosynthetic_class: (p.biosynthetic_class as string | null) ?? null,
      category: deriveCategory(p.biosynthetic_class),
      doi: (p.doi as string | null) ?? null,
      step_count: (p.steps as unknown[]).length,
      organism: speciesMap[p.mibig_id]?.organism ?? null,
      mibig_url: linksMap[p.mibig_id]?.url ?? null,
    }))
    .sort((a, b) => a.mibig_id.localeCompare(b.mibig_id));

  const meta = raw.metadata;

  return (
    <div style={{ maxWidth: "960px" }}>
      {/* Page header */}
      <div style={{ marginBottom: "32px" }}>
        <h2 className="page-heading">Repository</h2>
        <p style={{ fontSize: "15px", color: "#666", margin: 0 }}>
          {meta.total_bgcs} curated BGCs · {meta.total_steps.toLocaleString()} biosynthetic steps ·{" "}
          Source:{" "}
          <a
            href="https://mibig.secondarymetabolites.org"
            target="_blank"
            rel="noreferrer"
            style={{ color: "#6464dc", textDecoration: "none" }}
          >
            MIBiG
          </a>
        </p>
      </div>

      <RepositoryTable entries={entries} />
    </div>
  );
}
