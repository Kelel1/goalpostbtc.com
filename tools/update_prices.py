#!/usr/bin/env python3
"""Refresh data/btc-daily.json with daily BTC/USD closes from Coinbase.

Covers the first milestone date through yesterday (UTC). The site uses this
file for the price overlay and for each post's BTC price on its date; any
days newer than the file are topped up live from Kraken in the browser.

Usage:  python3 tools/update_prices.py
"""
import csv
import json
import time
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MILESTONES = ROOT / "data" / "milestones.csv"
OUT = ROOT / "data" / "btc-daily.json"
URL = "https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=86400&start={}&end={}"
CHUNK = 290  # Coinbase returns at most 300 candles per request


def first_milestone_date():
    with open(MILESTONES, newline="") as fh:
        return min(date.fromisoformat(r["date"]) for r in csv.DictReader(fh))


def fetch(start, end):
    req = urllib.request.Request(URL.format(start.isoformat(), end.isoformat()),
                                 headers={"User-Agent": "goalpostbtc-price-updater"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def main():
    start = first_milestone_date() - timedelta(days=7)
    end = datetime.now(timezone.utc).date() - timedelta(days=1)
    closes = {}
    cursor = start
    while cursor <= end:
        chunk_end = min(cursor + timedelta(days=CHUNK), end)
        for t, _low, _high, _open, close, _vol in fetch(cursor, chunk_end):
            day = datetime.fromtimestamp(t, timezone.utc).date().isoformat()
            closes[day] = round(close, 2)
        cursor = chunk_end + timedelta(days=1)
        time.sleep(0.4)

    days = sorted(closes)
    OUT.write_text(json.dumps({"source": "Coinbase BTC-USD daily close (UTC)",
                               "updated": datetime.now(timezone.utc).date().isoformat(),
                               "closes": {d: closes[d] for d in days}},
                              separators=(",", ":")) + "\n")
    print(f"Wrote {len(days)} days ({days[0]} to {days[-1]}) to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
