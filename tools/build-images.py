#!/usr/bin/env python3
"""Build the derived image assets for the Sahsih site.

  python3 tools/build-images.py

For every product PNG in assets/img it writes a WebP and an AVIF sibling
(the markup uses <picture> with AVIF -> WebP -> PNG fallback), and it
composes the 1200x630 Open Graph card at assets/img/og.jpg from the real
logo and hero renders. Re-run it whenever a PNG changes.

Requires Pillow >= 11 (pip install Pillow). All source PNGs are opaque, so
they are flattened to RGB before encoding.
"""
from pathlib import Path
from PIL import Image

IMG = Path(__file__).resolve().parent.parent / "assets" / "img"
SKIP = {"favicon.png", "apple-touch-icon.png"}
WEBP_QUALITY = 84
AVIF_QUALITY = 62


def convert():
    total = {"png": 0, "webp": 0, "avif": 0}
    for png in sorted(IMG.glob("*.png")):
        if png.name in SKIP:
            continue
        im = Image.open(png).convert("RGB")
        webp = png.with_suffix(".webp")
        avif = png.with_suffix(".avif")
        im.save(webp, "WEBP", quality=WEBP_QUALITY, method=6)
        im.save(avif, "AVIF", quality=AVIF_QUALITY, speed=4)
        sizes = {k: p.stat().st_size for k, p in (("png", png), ("webp", webp), ("avif", avif))}
        for k, v in sizes.items():
            total[k] += v
        print(f"{png.name:24} {im.size[0]}x{im.size[1]}  png {sizes['png']//1024:4} KB  webp {sizes['webp']//1024:3} KB  avif {sizes['avif']//1024:3} KB")
    print("total".ljust(24), " " * 10, *(f"{k} {v//1024} KB " for k, v in total.items()))


def og_card():
    """1200x630 card: wordmark on top, the five sticks below, on the brand black."""
    W, H = 1200, 630
    card = Image.new("RGB", (W, H), "#000000")
    logo = Image.open(IMG / "sahsih-logo.png").convert("RGB")
    sticks = Image.open(IMG / "hero-sticks.png").convert("RGB")

    lw = 380
    logo = logo.resize((lw, round(logo.height * lw / logo.width)), Image.LANCZOS)
    sw = 1080
    sticks = sticks.resize((sw, round(sticks.height * sw / sticks.width)), Image.LANCZOS)

    top_pad = 22
    card.paste(logo, ((W - lw) // 2, top_pad))
    y = top_pad + logo.height + 14
    card.paste(sticks, ((W - sw) // 2, y))
    out = IMG / "og.jpg"
    card.save(out, "JPEG", quality=86, optimize=True, progressive=True)
    print(f"og.jpg {W}x{H}  {out.stat().st_size//1024} KB")


if __name__ == "__main__":
    convert()
    og_card()
