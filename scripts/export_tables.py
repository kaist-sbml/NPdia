# -*- coding: utf-8 -*-
"""
export_tables.py

Flatten the multi-sheet curation workbook into the publication tables:

  data/processed/T1PKS_NRPS_pathways.csv
  data/processed/T1PKS_NRPS_pathways.xlsx

The CSV is written with a UTF-8 BOM and QUOTE_NONNUMERIC so Excel opens it
without re-interpreting Product_ID values such as "1-1" as dates. The XLSX
carries an explicit Text ("@") number format on the same column.
"""

import csv
import os
import re
from datetime import datetime

import openpyxl
from openpyxl.utils import get_column_letter

from convert_to_json import (
    DATA_SHEETS,
    EXCLUDED_BGCS,
    KOREAN_RE,
    capitalize_compound_name,
    extract_bgc_number,
    fix_datetime_product_id,
    fix_datetime_substrate,
    normalize_bgc_id,
    safe_str,
)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)

INPUT_FILE = os.path.join(
    ROOT_DIR, "data", "raw",
    "T1PKS, NRPS biosynthesis pathway collection_260907.xlsx",
)
OUT_DIR = os.path.join(ROOT_DIR, "data", "processed")
CSV_PATH = os.path.join(OUT_DIR, "T1PKS_NRPS_pathways.csv")
XLSX_PATH = os.path.join(OUT_DIR, "T1PKS_NRPS_pathways.xlsx")

HEADERS = [
    "MIBiG entry", "Compound name", "Class", "Order",
    "Enzyme", "Module", "Nonlinearity", "Substrate",
    "Product", "Product_ID", "Quality", "DOI", "R_group",
]

# Column 13 (index 12) holds the R group definition; columns 14+ are free-form
# Korean curation notes and are intentionally dropped.
N_COLS = 13
PRODUCT_ID_IDX = 9
SUBSTRATE_IDX = 7


def clean(val):
    """Stringify a cell, blanking any value carrying Korean curation notes."""
    s = safe_str(val)
    if s is None:
        return ""
    if KOREAN_RE.search(s):
        return ""
    return s


def collect_rows():
    wb = openpyxl.load_workbook(INPUT_FILE, read_only=True, data_only=True)

    out = []
    excluded_rows = 0

    for sheet_name in DATA_SHEETS:
        if sheet_name not in wb.sheetnames:
            continue
        ws = wb[sheet_name]

        current_bgc = None
        current_number = None

        for row in ws.iter_rows(min_row=2, values_only=True):
            row = list(row[:N_COLS]) + [None] * max(0, N_COLS - len(row))

            first = safe_str(row[0])
            if first and first.startswith("BGC"):
                current_bgc = normalize_bgc_id(first)
                current_number = extract_bgc_number(current_bgc)

            if current_bgc is None:
                continue

            # Excel turns Product_ID / Substrate values like 1-1 into datetimes
            if current_number:
                row[PRODUCT_ID_IDX] = fix_datetime_product_id(row[PRODUCT_ID_IDX], current_number)
                row[SUBSTRATE_IDX] = fix_datetime_substrate(row[SUBSTRATE_IDX], current_number)

            values = [clean(v) for v in row]

            # Skip rows that carry no content of their own
            if not any(values[1:]):
                continue

            if current_bgc in EXCLUDED_BGCS:
                excluded_rows += 1
                continue

            values[0] = current_bgc                                  # forward-fill
            values[1] = capitalize_compound_name(values[1]) or ""    # first row only
            out.append(values)

    wb.close()
    print(f"Collected {len(out)} rows ({excluded_rows} dropped for excluded BGCs)")
    return out


def write_csv(rows):
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(CSV_PATH, "w", encoding="utf-8-sig", newline="") as fh:
        w = csv.writer(fh, quoting=csv.QUOTE_NONNUMERIC)
        w.writerow(HEADERS)
        w.writerows(rows)
    print(f"Wrote {CSV_PATH}")


def write_xlsx(rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Pathways"
    ws.append(HEADERS)
    for r in rows:
        ws.append(r)

    # Force Product_ID to Text so Excel never re-parses "1-1" as a date
    col = get_column_letter(PRODUCT_ID_IDX + 1)
    for cell in ws[col][1:]:
        cell.number_format = "@"

    ws.freeze_panes = "A2"
    wb.save(XLSX_PATH)
    print(f"Wrote {XLSX_PATH}")


if __name__ == "__main__":
    rows = collect_rows()
    write_csv(rows)
    write_xlsx(rows)
