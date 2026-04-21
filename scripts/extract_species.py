# -*- coding: utf-8 -*-
"""
Extract species / taxonomy data from MIBiG GenBank files.

Reads every .gbk in data/raw/mibig_gbk_4.0/ and writes
data/normalized/species.json:
  {
    "BGC0000001": {
      "organism": "Micromonospora maris AB-18-032",
      "taxonomy": ["Bacteria", "Actinomycetota", ..., "Micromonospora"]
    },
    ...
  }
"""

import os
import re
import json

GBK_DIR     = "data/raw/mibig_gbk_4.0"
OUTPUT_FILE = "data/normalized/species.json"


def parse_gbk(path):
    """Return (organism, taxonomy_list) from a GenBank file header."""
    organism = None
    taxonomy = []

    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        text = f.read(4000)   # header is always within first 4 KB

    # SOURCE line  → full organism name including strain
    m = re.search(r'^SOURCE\s+(.+)', text, re.MULTILINE)
    if m:
        organism = m.group(1).strip()

    # ORGANISM block:
    #   line 1  → species name (same as SOURCE, we already have it)
    #   lines 2+ → semicolon-separated taxonomy, possibly wrapped
    tax_block = re.search(
        r'^\s{2}ORGANISM\s+.+\n((?:\s{12}.+\n)+)',
        text,
        re.MULTILINE
    )
    if tax_block:
        raw = tax_block.group(1).replace('\n', ' ')
        raw = re.sub(r'\s+', ' ', raw).strip().rstrip('.')
        taxonomy = [t.strip() for t in raw.split(';') if t.strip()]

    return organism, taxonomy


def main():
    files = sorted(f for f in os.listdir(GBK_DIR) if f.endswith('.gbk'))
    print("Extracting species from {} .gbk files...".format(len(files)))

    results = {}
    missing_source = []

    for fname in files:
        bgc_id = fname.replace('.gbk', '')
        path   = os.path.join(GBK_DIR, fname)
        organism, taxonomy = parse_gbk(path)

        if organism:
            results[bgc_id] = {"organism": organism, "taxonomy": taxonomy}
        else:
            results[bgc_id] = {"organism": None, "taxonomy": []}
            missing_source.append(bgc_id)

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print("Done. {} entries written to {}".format(len(results), OUTPUT_FILE))
    if missing_source:
        print("WARNING: no SOURCE found in {} files:".format(len(missing_source)))
        for bid in missing_source[:10]:
            print("  ", bid)


if __name__ == "__main__":
    main()
