#!/usr/bin/env python3
"""Create small JPEG thumbnails for the screenshot archive gallery.

Writes screenshots/thumbs/<name>.jpg for every screenshot that doesn't have
one yet (or whose source is newer). Full-size originals are only loaded when
a visitor opens one.

Usage:  python3 tools/make_thumbs.py        (requires Pillow: pip3 install Pillow)
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "screenshots"
DST = SRC / "thumbs"
WIDTH = 480
MAX_HEIGHT = 900  # tall phone screenshots are cropped from the top for the grid


def thumb_path(src):
    return DST / (src.stem + ".jpg")


def main():
    DST.mkdir(exist_ok=True)
    made = 0
    for src in sorted(SRC.glob("*.png")):
        out = thumb_path(src)
        if out.exists() and out.stat().st_mtime >= src.stat().st_mtime:
            continue
        with Image.open(src) as img:
            img = img.convert("RGB")
            scale = WIDTH / img.width
            img = img.resize((WIDTH, max(1, round(img.height * scale))), Image.LANCZOS)
            if img.height > MAX_HEIGHT:
                img = img.crop((0, 0, WIDTH, MAX_HEIGHT))
            img.save(out, "JPEG", quality=78, optimize=True, progressive=True)
        made += 1
    print(f"Created {made} thumbnails in {DST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
