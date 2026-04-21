# -*- coding: utf-8 -*-
"""
extract_gene_loci.py

Parse CDS features from MIBiG GenBank files for the 356 BGC IDs listed in
data/normalized/biosynthesis_pathways.json and write gene locus data to
data/normalized/gene_loci.json.
"""

import json
import os
import re

# ── Paths ─────────────────────────────────────────────────────────────────────

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR   = os.path.dirname(SCRIPT_DIR)

PATHWAYS_JSON = os.path.join(ROOT_DIR, "data", "normalized", "biosynthesis_pathways.json")
GBK_DIR       = os.path.join(ROOT_DIR, "data", "raw", "mibig_gbk_4.0")
OUTPUT_JSON   = os.path.join(ROOT_DIR, "data", "normalized", "gene_loci.json")

# ── Location parsing ───────────────────────────────────────────────────────────

_NUM_RE = re.compile(r"\d+")


def parse_location(loc_str):
    """
    Return (start, end, strand) from a GenBank location string.

    Handles:
      1..1083                        → (1, 1083, +1)
      complement(2646..3836)         → (2646, 3836, -1)
      join(100..200,300..400)        → (100, 400, +1)
      complement(join(1..50,70..90)) → (1, 90, -1)
    """
    strand = -1 if loc_str.lstrip().startswith("complement") else 1
    nums   = [int(n) for n in _NUM_RE.findall(loc_str)]
    if not nums:
        return None, None, strand
    return min(nums), max(nums), strand


# ── Qualifier extraction ───────────────────────────────────────────────────────

def _extract_qualifier(block, name):
    """
    Return the first value of /name= in block, with continuation lines joined.
    Multi-line qualifier values (indented by 21 spaces in canonical GBK) are
    concatenated with a single space.
    """
    pattern = re.compile(
        r'/' + re.escape(name) + r'="(.*?)"',
        re.DOTALL,
    )
    m = pattern.search(block)
    if not m:
        return None
    raw = m.group(1)
    # Collapse line-continuation whitespace
    return re.sub(r"\s+", " ", raw).strip()


def _extract_all_qualifiers(block, name):
    """Return a list of all values for /name= in block (joined as above)."""
    pattern = re.compile(
        r'/' + re.escape(name) + r'="(.*?)"',
        re.DOTALL,
    )
    results = []
    for m in pattern.finditer(block):
        raw = m.group(1)
        results.append(re.sub(r"\s+", " ", raw).strip())
    return results


# ── Feature block parser ──────────────────────────────────────────────────────

# Matches the first line of a named feature at column 5
_FEAT_START_RE  = re.compile(r"^\s{5}(\S+)\s+(.+)$")
# Continuation lines for the location (before any qualifier): 21 spaces, not /
_LOC_CONT_RE    = re.compile(r"^\s{21}[^/]")
# Start of a qualifier
_QUAL_RE        = re.compile(r"^\s{21}/")


def parse_gbk(gbk_path):
    """
    Parse a GenBank file and return (total_length, genes_list).

    total_length: integer from the LOCUS line (bp)
    genes_list: list of dicts with keys:
        gene, start, end, strand, gene_kind, product, gene_functions, domains

    domains is a list of { type, start, end, strand } sorted N→C terminal.
    """
    with open(gbk_path, encoding="utf-8", errors="ignore") as fh:
        lines = fh.readlines()

    # ── 1. Extract total length from LOCUS line ───────────────────────────────
    total_length = None
    for line in lines:
        if line.startswith("LOCUS"):
            m = re.search(r"(\d+)\s+bp", line)
            if m:
                total_length = int(m.group(1))
            break

    # ── 2. Collect CDS and aSDomain feature blocks ────────────────────────────
    in_features = False
    feat_blocks = []          # list of (feat_type, raw_loc_str, block_text)
    cur_type    = None
    cur_loc     = None
    cur_lines   = []

    WANTED = {"CDS", "aSDomain", "aSModule"}

    for line in lines:
        if line.startswith("FEATURES"):
            in_features = True
            continue
        if line.startswith("ORIGIN") or line.startswith("//"):
            if cur_type and cur_loc:
                feat_blocks.append((cur_type, cur_loc, "".join(cur_lines)))
            cur_type    = None
            cur_loc     = None
            cur_lines   = []
            in_features = False
            continue

        if not in_features:
            continue

        m_feat = _FEAT_START_RE.match(line)
        if m_feat:
            feat_type = m_feat.group(1)
            # Save previous block before switching
            if cur_type and cur_loc:
                feat_blocks.append((cur_type, cur_loc, "".join(cur_lines)))
            if feat_type in WANTED:
                cur_type  = feat_type
                cur_loc   = m_feat.group(2).strip()
                cur_lines = []
            else:
                cur_type  = None
                cur_loc   = None
                cur_lines = []
            continue

        if cur_type is None:
            continue

        # Location continuation (multi-line loc before any qualifier)
        if _LOC_CONT_RE.match(line) and not cur_lines:
            cur_loc += line.strip()
            continue

        cur_lines.append(line)

    if cur_type and cur_loc:
        feat_blocks.append((cur_type, cur_loc, "".join(cur_lines)))

    # ── 3. Parse CDS blocks into gene entries ─────────────────────────────────
    genes = []
    for feat_type, raw_loc, block in feat_blocks:
        if feat_type != "CDS":
            continue

        start, end, strand = parse_location(raw_loc)
        if start is None:
            continue

        # Truncate at /translation= to avoid slow regex on long protein strings
        trunc_idx = block.find("/translation=")
        if trunc_idx != -1:
            block = block[:trunc_idx]

        # gene name
        gene_name = _extract_qualifier(block, "gene")
        if gene_name is None:
            gene_name = _extract_qualifier(block, "locus_tag")
        if gene_name is None:
            gene_name = _extract_qualifier(block, "protein_id")

        # gene_kind
        gene_kind = _extract_qualifier(block, "gene_kind")
        if gene_kind is None:
            gf_list = _extract_all_qualifiers(block, "gene_functions")
            if gf_list:
                gene_kind = gf_list[0].split()[0] if gf_list[0].split() else None

        # product
        product = _extract_qualifier(block, "product")

        # gene_functions (all values)
        gene_functions = _extract_all_qualifiers(block, "gene_functions")

        genes.append({
            "gene":           gene_name,
            "start":          start,
            "end":            end,
            "strand":         strand,
            "gene_kind":      gene_kind,
            "product":        product,
            "gene_functions": gene_functions,
            "domains":        [],
        })

    # ── 4. Parse aSDomain blocks and attach to parent CDS genes ──────────────
    # Index by gene name (which may be gene, locus_tag, or protein_id)
    gene_by_name: dict = {}
    for g in genes:
        if g["gene"]:
            gene_by_name[g["gene"]] = g

    for feat_type, raw_loc, block in feat_blocks:
        if feat_type != "aSDomain":
            continue

        start, end, strand = parse_location(raw_loc)
        if start is None:
            continue

        domain_type = _extract_qualifier(block, "aSDomain")
        parent      = _extract_qualifier(block, "gene")
        if parent is None:
            parent = _extract_qualifier(block, "locus_tag")
        if parent is None:
            parent = _extract_qualifier(block, "protein_id")

        if not parent or parent not in gene_by_name:
            continue

        domain_id = _extract_qualifier(block, "domain_id")

        gene_by_name[parent]["domains"].append({
            "type":      domain_type,
            "start":     start,
            "end":       end,
            "strand":    strand,
            "domain_id": domain_id,
            "module_idx": None,   # filled in step 5
        })

    # ── 5. Sort domains in N→C terminal order within each gene ───────────────
    for g in genes:
        if g["strand"] == 1:
            g["domains"].sort(key=lambda d: d["start"])
        else:
            g["domains"].sort(key=lambda d: -d["end"])

    # ── 6. Parse aSModule blocks and assign module_idx to each domain ─────────
    # Build: domain_id → module_idx (per-gene, ordered by genomic position)
    asmodule_list: list = []   # {"locus_tags": [...], "start": int, "domain_ids": [...]}

    for feat_type, raw_loc, block in feat_blocks:
        if feat_type != "aSModule":
            continue
        start, end, _ = parse_location(raw_loc)
        if start is None:
            continue
        locus_tags = _extract_all_qualifiers(block, "locus_tags")
        domain_ids = _extract_all_qualifiers(block, "domains")
        asmodule_list.append({
            "start":      start,
            "locus_tags": locus_tags,
            "domain_ids": set(domain_ids),
        })

    # For each gene, collect its aSModules, sort N→C, build domain_id → module_idx
    for g in genes:
        gname = g["gene"]
        if not gname:
            continue
        gene_modules = sorted(
            [m for m in asmodule_list if gname in m["locus_tags"]],
            key=lambda m: m["start"],
        )
        if not gene_modules:
            continue
        domain_id_to_midx: dict = {}
        for midx, mod in enumerate(gene_modules):
            for did in mod["domain_ids"]:
                domain_id_to_midx[did] = midx
        for dom in g["domains"]:
            did = dom.get("domain_id")
            if did and did in domain_id_to_midx:
                dom["module_idx"] = domain_id_to_midx[did]
        g["num_modules"] = len(gene_modules)

    return total_length, genes


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    # Load BGC IDs
    with open(PATHWAYS_JSON, encoding="utf-8", errors="ignore") as fh:
        pathways_data = json.load(fh)
    bgc_ids = list(pathways_data["pathways"].keys())
    print(f"Found {len(bgc_ids)} BGC IDs in {PATHWAYS_JSON}")

    result = {}
    missing = []
    for bgc_id in bgc_ids:
        gbk_path = os.path.join(GBK_DIR, f"{bgc_id}.gbk")
        if not os.path.isfile(gbk_path):
            missing.append(bgc_id)
            continue
        total_length, genes = parse_gbk(gbk_path)
        result[bgc_id] = {
            "total_length": total_length,
            "genes":        genes,
        }

    if missing:
        print(f"WARNING: {len(missing)} GBK file(s) not found: {missing[:5]}{'...' if len(missing) > 5 else ''}")

    with open(OUTPUT_JSON, "w", encoding="utf-8") as fh:
        json.dump(result, fh, indent=2, ensure_ascii=False)

    print(f"Wrote {len(result)} entries to {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
