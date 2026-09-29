# GoalPost BTC: goalpostbtc.com

Documenting hyperbitcoinization one goalpost at a time. A plain static site (no build step) served by GitHub Pages; charts are drawn in the browser from the data files.

## Where things live

| What | File |
|---|---|
| Every milestone post (the master dataset) | `data/milestones.csv` |
| Screenshots shown in the archive | `screenshots/` (+ generated `screenshots/thumbs/`) |
| Musings | `data/musings.json` (images in `assets/musings/`) |
| Daily BTC price history | `data/btc-daily.json` (generated) |
| Pages | `index.html`, `data.html`, `archive.html`, `musings.html`, `about.html` |
| Styles / scripts | `assets/css/site.css`, `assets/js/` |

## Adding new milestone posts

1. Drop the screenshot(s) into `screenshots/`.
2. Add a row per milestone to `data/milestones.csv`:

   ```
   date,username,btc,screenshot
   2026-09-28,Glum-Story7933,0.3,Screenshot_20260928-074326.png
   ```

   - `date` is the day the post was made, as `YYYY-MM-DD`.
   - `username` without the `u/` (the site adds it); non-Reddit handles keep their `@`.
   - One screenshot can back two rows (e.g. a post and a milestone comment under it).
3. Run the tools, then commit and push:

   ```
   python3 tools/make_thumbs.py
   python3 tools/update_prices.py
   python3 tools/validate.py
   ```

`validate.py` fails on anything that would break the site (bad dates, missing screenshots, duplicate rows) and warns when a post date is far from its screenshot date. Pushing to `main` publishes to goalpostbtc.com.

## Adding a musing

Add an entry to the top of `data/musings.json`:

```json
{
  "slug": "short-url-name",
  "date": "2026-09-28",
  "title": "Title",
  "block_height": 969071,
  "preview": "Optional hand-written teaser for the homepage.",
  "paragraphs": ["First paragraph…", "Second paragraph…"],
  "images": [{ "src": "assets/musings/file.png", "caption": "Caption", "after": 0 }]
}
```

`after` is the paragraph index the image follows. `block_height`, `preview` and `images` are optional. It appears at `musings.html#<slug>`.

## Previewing locally

```
python3 -m http.server 8000
```

then open http://localhost:8000 (opening the HTML files directly won't load the data).
