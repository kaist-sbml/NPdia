"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

export type PathwaySummary = {
  mibig_id: string;
  compound_name: string | null;
  biosynthetic_class: string | null;
  category: "PKS" | "NRPS" | "Hybrid" | "Unknown";
  doi: string | null;
  step_count: number;
  organism: string | null;
  mibig_url: string | null;
};

type FilterCategory = "All" | "PKS" | "NRPS" | "Hybrid";
type SortKey = "mibig_id" | "compound_name";
type SortDir = "asc" | "desc";

const categoryStyle: Record<
  PathwaySummary["category"],
  { bg: string; color: string }
> = {
  PKS: { bg: "#e8f0fe", color: "#1a56db" },
  NRPS: { bg: "#fce8f4", color: "#9d174d" },
  Hybrid: { bg: "#ede9fe", color: "#6d28d9" },
  Unknown: { bg: "#f3f4f6", color: "#6b7280" },
};

export default function RepositoryTable({
  entries,
}: {
  entries: PathwaySummary[];
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterCategory>("All");
  const [sortKey, setSortKey] = useState<SortKey>("mibig_id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = entries.filter((e) => {
      const matchSearch =
        !q ||
        e.mibig_id.toLowerCase().includes(q) ||
        (e.compound_name ?? "").toLowerCase().includes(q) ||
        (e.biosynthetic_class ?? "").toLowerCase().includes(q) ||
        (e.organism ?? "").toLowerCase().includes(q);
      const matchFilter = filter === "All" || e.category === filter;
      return matchSearch && matchFilter;
    });
    result.sort((a, b) => {
      const av = sortKey === "mibig_id" ? a.mibig_id : (a.compound_name ?? "");
      const bv = sortKey === "mibig_id" ? b.mibig_id : (b.compound_name ?? "");
      const cmp = av.localeCompare(bv);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [entries, search, filter, sortKey, sortDir]);

  const counts: Record<FilterCategory, number> = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = entries.filter(
      (e) =>
        !q ||
        e.mibig_id.toLowerCase().includes(q) ||
        (e.compound_name ?? "").toLowerCase().includes(q) ||
        (e.biosynthetic_class ?? "").toLowerCase().includes(q) ||
        (e.organism ?? "").toLowerCase().includes(q)
    );
    return {
      All: base.length,
      PKS: base.filter((e) => e.category === "PKS").length,
      NRPS: base.filter((e) => e.category === "NRPS").length,
      Hybrid: base.filter((e) => e.category === "Hybrid").length,
    };
  }, [entries, search]);

  return (
    <div>
      {/* Search + Filter bar */}
      <div className="repo-toolbar">
        {/* Search input */}
        <input
          type="text"
          placeholder="Search by ID, compound, class, or organism…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="repo-search"
        />

        {/* Filter tabs */}
        <div className="repo-filters">
          {(["All", "PKS", "NRPS", "Hybrid"] as FilterCategory[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: "7px 16px",
                borderRadius: "8px",
                border: "1px solid",
                fontSize: "13px",
                fontWeight: filter === f ? 600 : 400,
                cursor: "pointer",
                borderColor: filter === f ? "#6464dc" : "#ccd",
                backgroundColor: filter === f ? "#6464dc" : "#fff",
                color: filter === f ? "#fff" : "#555",
                transition: "all 0.12s",
              }}
            >
              {f}
              <span
                style={{
                  marginLeft: "6px",
                  fontSize: "11px",
                  opacity: 0.8,
                }}
              >
                {counts[f]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Result count */}
      <p
        style={{
          fontSize: "13px",
          color: "#888",
          marginBottom: "12px",
          marginTop: 0,
        }}
      >
        Showing {filtered.length} of {entries.length} entries
      </p>

      {/* Table */}
      <div
        style={{
          backgroundColor: "#fff",
          border: "1px solid #dde",
          borderRadius: "10px",
          overflow: "hidden",
          boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ overflowX: "auto", fontSize: "13.5px", width: "100%" }}>
          <table
            style={{
              width: "100%",
              minWidth: "750px",
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: "#f5f5fb" }}>
                {(
                  [
                    { label: "MIBiG ID",          key: "mibig_id",      minWidth: 120 },
                    { label: "Compound",           key: "compound_name", minWidth: 220 },
                    { label: "Biosynthetic Class", key: null,            minWidth: 160 },
                    { label: "Steps",              key: null,            minWidth: 70  },
                    { label: "DOI",                key: null,            minWidth: 180 },
                  ] as { label: string; key: SortKey | null; minWidth: number }[]
                ).map(({ label, key, minWidth }) => (
                  <th
                    key={label}
                    onClick={key ? () => handleSort(key) : undefined}
                    style={{
                      padding: "11px 14px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: key ? "#1a1a2e" : "#444",
                      borderBottom: "2px solid #dde",
                      whiteSpace: "nowrap",
                      fontSize: "12.5px",
                      letterSpacing: "0.3px",
                      cursor: key ? "pointer" : "default",
                      userSelect: "none",
                      minWidth,
                    }}
                  >
                    {label}
                    {key && (
                      <span style={{ marginLeft: "5px", opacity: sortKey === key ? 1 : 0.3 }}>
                        {sortKey === key && sortDir === "desc" ? "↓" : "↑"}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      padding: "40px",
                      textAlign: "center",
                      color: "#aaa",
                      fontSize: "14px",
                    }}
                  >
                    No entries match your search.
                  </td>
                </tr>
              ) : (
                filtered.map((row, i) => (
                  <tr
                    key={row.mibig_id}
                    style={{
                      backgroundColor: i % 2 === 0 ? "#fff" : "#fafafe",
                      borderBottom: "1px solid #eef",
                    }}
                  >
                    {/* MIBiG ID */}
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      <span style={{
                        fontFamily: "monospace",
                        fontWeight: 600,
                        color: "#6464dc",
                        fontSize: "13px",
                      }}>
                        {row.mibig_id}
                      </span>
                    </td>

                    {/* Compound + Organism */}
                    <td style={{ padding: "10px 14px" }}>
                      <Link
                        href={`/repository/${row.mibig_id}`}
                        style={{
                          color: "#1a1a2e",
                          fontWeight: 500,
                          textDecoration: "none",
                          display: "block",
                        }}
                      >
                        {row.compound_name}
                      </Link>
                      {row.organism && (
                        <span style={{
                          display: "block",
                          fontSize: "12px",
                          color: "#888",
                          fontStyle: "italic",
                          marginTop: "2px",
                        }}>
                          {row.organism}
                        </span>
                      )}
                    </td>

                    {/* Class */}
                    <td style={{ padding: "10px 14px" }}>
                      <div
                        style={{ display: "flex", alignItems: "center", gap: "8px" }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 9px",
                            borderRadius: "999px",
                            fontSize: "11.5px",
                            fontWeight: 600,
                            backgroundColor:
                              categoryStyle[row.category].bg,
                            color: categoryStyle[row.category].color,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.category}
                        </span>
                        {row.biosynthetic_class && (
                          <span
                            style={{
                              fontSize: "12px",
                              color: "#888",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {row.biosynthetic_class}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Steps */}
                    <td
                      style={{
                        padding: "10px 14px",
                        textAlign: "center",
                        color: "#555",
                        fontVariantNumeric: "tabular-nums",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {row.step_count}
                    </td>

                    {/* DOI */}
                    <td style={{ padding: "10px 14px" }}>
                      {row.doi ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {row.doi.split(";").map((d) => d.trim()).filter(Boolean).map((d) => (
                            <a
                              key={d}
                              href={`https://doi.org/${d}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                color: "#6464dc",
                                textDecoration: "none",
                                fontSize: "12.5px",
                                fontFamily: "monospace",
                              }}
                            >
                              {d}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: "#ccc", fontSize: "12px" }}>
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
