#!/usr/bin/env python3
"""Sanity-check data/milestones.csv and data/musings.json before pushing.

Fails (exit 1) on anything that would break the site; warns on things worth
a second look.

Usage:  python3 tools/validate.py
"""
import csv
import json
import re
import sys
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HEADER = ["date", "username", "btc", "screenshot"]
errors, warnings = [], []

with open(ROOT / "data" / "milestones.csv", newline="") as fh:
    reader = csv.reader(fh)
    header = next(reader)
    if header != HEADER:
        errors.append(f"header should be {','.join(HEADER)} (found {','.join(header)})")
    rows = list(reader)

today = date.today()
for line, row in enumerate(rows, start=2):
    if len(row) != 4:
        errors.append(f"line {line}: expected 4 columns, found {len(row)}")
        continue
    if any(cell != cell.strip() for cell in row):
        errors.append(f"line {line}: stray spaces around a value")
    d, user, btc, shot = (c.strip() for c in row)
    try:
        when = date.fromisoformat(d)
        if when > today:
            errors.append(f"line {line}: date {d} is in the future")
    except ValueError:
        errors.append(f"line {line}: date '{d}' is not YYYY-MM-DD")
        when = None
    if not user:
        errors.append(f"line {line}: missing username")
    try:
        if float(btc) <= 0:
            errors.append(f"line {line}: BTC amount must be positive")
    except ValueError:
        errors.append(f"line {line}: BTC amount '{btc}' is not a number")
    if not (ROOT / "screenshots" / shot).is_file():
        errors.append(f"line {line}: screenshot not found: screenshots/{shot}")
    elif not (ROOT / "screenshots" / "thumbs" / (Path(shot).stem + ".jpg")).is_file():
        warnings.append(f"line {line}: no thumbnail yet for {shot} (run tools/make_thumbs.py)")
    m = re.search(r"(20\d\d)-?(\d\d)-?(\d\d)", shot)
    if m and when:
        try:
            taken = date(*map(int, m.groups()))
            gap = (taken - when).days
            if gap < 0 or gap > 3:
                warnings.append(f"line {line}: {user} dated {d} but screenshot taken {taken} ({gap:+d} days)")
        except ValueError:
            pass

dupes = [k for k, n in Counter(tuple(r) for r in rows).items() if n > 1]
for d in dupes:
    errors.append(f"duplicate row: {','.join(d)}")

musings = json.loads((ROOT / "data" / "musings.json").read_text())
for m in musings:
    for key in ("slug", "date", "title", "paragraphs"):
        if key not in m:
            errors.append(f"musing '{m.get('title', '?')}' missing '{key}'")
    for img in m.get("images", []):
        if not (ROOT / img["src"]).is_file():
            errors.append(f"musing '{m.get('title')}': image not found: {img['src']}")

for w in warnings:
    print("warning:", w)
for e in errors:
    print("ERROR:", e)
print(f"{len(rows)} milestones, {len(musings)} musings, {len(errors)} errors, {len(warnings)} warnings")
sys.exit(1 if errors else 0)
