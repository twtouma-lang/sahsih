#!/usr/bin/env python3
"""Build the derived image assets for the Sahsih site.

  python3 tools/build-images.py             # WebP/AVIF siblings + OG card
  python3 tools/build-images.py --cutouts   # also regenerate assets/img/cut/

For every product PNG in assets/img (and assets/img/cut) it writes a WebP
and an AVIF sibling (the markup uses <picture> with AVIF -> WebP -> PNG
fallback), and it composes the 1200x630 Open Graph card at assets/img/og.jpg
from the real logo and hero renders. Re-run it whenever a PNG changes.

--cutouts removes the studio background from every stick and box render
and writes transparent PNGs to assets/img/cut/ (same canvas size as the
source, so the markup's width/height attributes stay valid). This needs
`pip install rembg onnxruntime`; the BiRefNet lite model (about 170 MB) is
downloaded on first use. It is slow (about a minute per image on CPU), so
it only runs when asked.

Requires Pillow >= 11 (pip install Pillow).
"""
import sys
from pathlib import Path
from PIL import Image

IMG = Path(__file__).resolve().parent.parent / "assets" / "img"
CUT = IMG / "cut"
SKIP = {"favicon.png", "apple-touch-icon.png"}
CUTOUT_SOURCES = [
    "stick-berry", "stick-mango", "stick-pineapple", "stick-watermelon", "stick-citrus",
    "box-berry", "box-mango", "box-pineapple", "box-watermelon", "box-citrus",
    "all-boxes",
]
WEBP_QUALITY = 84
AVIF_QUALITY = 62


def convert():
    total = {"png": 0, "webp": 0, "avif": 0}
    sources = sorted(IMG.glob("*.png")) + (sorted(CUT.glob("*.png")) if CUT.exists() else [])
    for png in sources:
        if png.name in SKIP:
            continue
        im = Image.open(png)
        # Cutouts keep their alpha; the studio renders are opaque.
        im = im.convert("RGBA") if im.mode == "RGBA" and im.getextrema()[3][0] < 255 else im.convert("RGB")
        webp = png.with_suffix(".webp")
        avif = png.with_suffix(".avif")
        im.save(webp, "WEBP", quality=WEBP_QUALITY, method=6)
        im.save(avif, "AVIF", quality=AVIF_QUALITY, speed=4)
        sizes = {k: p.stat().st_size for k, p in (("png", png), ("webp", webp), ("avif", avif))}
        for k, v in sizes.items():
            total[k] += v
        label = f"{png.parent.name}/{png.name}" if png.parent == CUT else png.name
        print(f"{label:28} {im.size[0]}x{im.size[1]}  png {sizes['png']//1024:4} KB  webp {sizes['webp']//1024:3} KB  avif {sizes['avif']//1024:3} KB")
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


def keep_dark_body(original: Image.Image, cut: Image.Image, threshold: int = 80) -> Image.Image:
    """Merge the model's alpha with the render's own dark body.

    The boxes are black packaging on a pastel studio ground, and a
    segmentation model reads the black faces as background. The ground is
    light and touches the image border, so flood-fill it from the edges;
    everything it cannot reach is packaging (including the white text on
    it). The model's alpha still contributes the fruit and splashes.
    """
    from PIL import ImageChops, ImageDraw, ImageFilter

    lum = original.convert("L")
    light = lum.point(lambda v: 255 if v > threshold else 0)  # candidate background
    # Flood the light region from every border pixel; what stays white is
    # light but enclosed by dark, so it belongs to the packaging.
    fill = light.copy()
    w, h = fill.size
    for x in range(w):
        for y in (0, h - 1):
            if fill.getpixel((x, y)) == 255:
                ImageDraw.floodfill(fill, (x, y), 128)
    for y in range(h):
        for x in (0, w - 1):
            if fill.getpixel((x, y)) == 255:
                ImageDraw.floodfill(fill, (x, y), 128)
    body = fill.point(lambda v: 0 if v == 128 else 255).filter(ImageFilter.GaussianBlur(0.8))
    alpha = ImageChops.lighter(cut.getchannel("A"), body)
    out = original.convert("RGBA")
    out.putalpha(alpha)
    return out


def cutouts():
    """Transparent versions of the product renders, via BiRefNet."""
    from rembg import new_session, remove  # optional dependency

    CUT.mkdir(exist_ok=True)
    session = new_session("birefnet-general-lite")
    for name in CUTOUT_SOURCES:
        src = Image.open(IMG / f"{name}.png").convert("RGBA")
        out = remove(src, session=session)
        if name.startswith("box-"):
            out = keep_dark_body(src, out)
        out.save(CUT / f"{name}.png", "PNG", optimize=True)
        print(f"cut/{name}.png {out.size[0]}x{out.size[1]}", flush=True)


def refine_boxes():
    """Re-apply keep_dark_body to existing box cutouts without rerunning the model."""
    for name in CUTOUT_SOURCES:
        if not name.startswith("box-"):
            continue
        src = Image.open(IMG / f"{name}.png").convert("RGBA")
        cut = Image.open(CUT / f"{name}.png").convert("RGBA")
        keep_dark_body(src, cut).save(CUT / f"{name}.png", "PNG", optimize=True)
        print(f"refined cut/{name}.png", flush=True)


if __name__ == "__main__":
    if "--cutouts" in sys.argv:
        cutouts()
    if "--refine-boxes" in sys.argv:
        refine_boxes()
    convert()
    og_card()
