# -*- coding: utf-8 -*-
"""
Find valid MIBiG repository links for all BGC IDs in biosynthesis_pathways.json.

URL format: https://mibig.secondarymetabolites.org/repository/BGC0000024.5/index.html#r1c1
The version suffix (.5) is unknown per BGC, so we probe versions 1-15.

Output: data/normalized/mibig_links.json
  {
    "BGC0000024": { "version": 5, "url": "https://...BGC0000024.5/index.html#r1c1" },
    "BGC0000001": { "version": null, "url": null },   # not found
    ...
  }
"""

import json
import sys
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

INPUT_JSON  = "data/normalized/biosynthesis_pathways.json"
OUTPUT_JSON = "data/normalized/mibig_links.json"

BASE_URL    = "https://mibig.secondarymetabolites.org/repository"
MAX_VERSION = 15   # probe .1 through .15
MAX_WORKERS = 20   # concurrent threads
TIMEOUT     = 10   # seconds per request

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": "mibig-link-finder/1.0"})


def find_version(bgc_id):
    """
    Return (bgc_id, version_int, full_url) for the first valid version,
    or (bgc_id, None, None) if none of 1..MAX_VERSION respond with 200.
    """
    for v in range(1, MAX_VERSION + 1):
        url = "{}/{}.{}/index.html".format(BASE_URL, bgc_id, v)
        try:
            resp = SESSION.head(url, timeout=TIMEOUT, allow_redirects=True)
            if resp.status_code == 200:
                return bgc_id, v, url + "#r1c1"
        except requests.RequestException:
            continue
    return bgc_id, None, None


def main():
    with open(INPUT_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    bgc_ids = sorted(data["pathways"].keys())
    total   = len(bgc_ids)
    print("Probing {} BGC entries (versions 1-{})...".format(total, MAX_VERSION))

    results   = {}
    completed = 0
    found     = 0

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(find_version, bgc_id): bgc_id for bgc_id in bgc_ids}

        for future in as_completed(futures):
            bgc_id, version, url = future.result()
            completed += 1

            if url:
                found += 1
                results[bgc_id] = {"version": version, "url": url}
                sys.stdout.write("[{}/{}] {} -> {}\n".format(completed, total, bgc_id, url))
            else:
                results[bgc_id] = {"version": None, "url": None}
                sys.stdout.write("[{}/{}] {} -> NOT FOUND\n".format(completed, total, bgc_id))

            sys.stdout.flush()

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print("\nDone: {}/{} links found.".format(found, total))
    print("Saved to {}".format(OUTPUT_JSON))


if __name__ == "__main__":
    main()
