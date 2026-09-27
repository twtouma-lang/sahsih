#!/usr/bin/env python3
"""Build the high-resolution Sahsih wordmark from the original logo artwork.

  python3 tools/build-logo.py [path/to/EDSR_x4.pb]

The source logo (assets/img/sahsih-logo.png) is 659 px wide, too small to
fill a wide screen. This script produces, from that same artwork:

  assets/img/logo/sahsih-logo-hd.webp   colour texture, 4x, edges bled outward
  assets/img/logo/sahsih-logo-hd-a.webp the same with a clean alpha channel
  assets/img/logo/logo-path.txt         the letter outline as SVG path data
                                        (viewBox printed below)

The page draws the texture clipped by the vector outline, so edges stay
razor sharp at any size while the glossy colours come from the real logo.

Upscaling uses OpenCV's EDSR x4 super-resolution model when a model file is
given (download EDSR_x4.pb from github.com/Saafke/EDSR_Tensorflow, models/),
and falls back to Lanczos otherwise.

Requires: pip install numpy scipy pillow opencv-contrib-python-headless potracer
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "img" / "sahsih-logo.png"
OUT = ROOT / "assets" / "img" / "logo"
SCALE = 4
DARK = 24  # max channel at or below this is background
MARGIN = 4  # source pixels kept around the letters


def letter_mask(rgb):
    mx = rgb.max(axis=2)
    mask = mx > DARK
    # Fill enclosed specks, keep real counters (the bowl of the a).
    lab, n = ndi.label(~mask)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
    sizes = ndi.sum(np.ones_like(lab), lab, index=np.arange(1, n + 1))
    for i, size in enumerate(sizes, start=1):
        if i not in border and size < 60:
            mask[lab == i] = True
    return mask, mx


def bleed(rgb, mask):
    """Replace edge and background pixels with the nearest interior colour,
    so a tight clip never shows the dark anti-aliased fringe."""
    interior = ndi.binary_erosion(mask, iterations=2)
    _, (iy, ix) = ndi.distance_transform_edt(~interior, return_indices=True)
    return rgb[iy, ix]


def upscale(rgb_u8, model_path):
    import cv2

    bgr = rgb_u8[:, :, ::-1].copy()
    if model_path and Path(model_path).exists():
        sr = cv2.dnn_superres.DnnSuperResImpl_create()
        sr.readModel(str(model_path))
        sr.setModel("edsr", SCALE)
        out = sr.upsample(bgr)
        print("upscaled with EDSR x4")
    else:
        h, w = bgr.shape[:2]
        out = cv2.resize(bgr, (w * SCALE, h * SCALE), interpolation=cv2.INTER_LANCZOS4)
        print("upscaled with Lanczos (no EDSR model given)")
    return out[:, :, ::-1]


def coverage(rgb, bled, mask):
    """True edge coverage: the source is the logo over black, so an edge
    pixel is (coverage x letter colour). Dividing by the bled letter colour
    recovers coverage independent of hue (pink and blue edges agree)."""
    num = rgb.astype(np.float32).sum(axis=2)
    den = np.maximum(bled.astype(np.float32).sum(axis=2), 1)
    cov = np.clip(num / den, 0, 1)
    cov[ndi.binary_erosion(mask, iterations=2)] = 1
    cov[~ndi.binary_dilation(mask, iterations=2)] = 0
    return cov


def hd_mask(cov):
    """Upscale coverage and smooth it just enough to remove pixel steps."""
    import cv2

    h, w = cov.shape
    big = cv2.resize(cov, (w * SCALE, h * SCALE), interpolation=cv2.INTER_CUBIC)
    big = cv2.GaussianBlur(big, (0, 0), 2.2)
    return np.clip(big, 0, 1)


def trace(binary):
    import potrace

    # potracer follows the print convention (dark = ink) and inverts its
    # input, so hand it the letters as False.
    bm = potrace.Bitmap(~binary)
    plist = bm.trace(turdsize=8, turnpolicy=potrace.POTRACE_TURNPOLICY_MINORITY, alphamax=1.0, opticurve=True, opttolerance=0.2)
    parts = []
    f = lambda p: f"{p.x:.1f},{p.y:.1f}"
    for curve in plist:
        parts.append(f"M{f(curve.start_point)}")
        for seg in curve.segments:
            if seg.is_corner:
                parts.append(f"L{f(seg.c)}L{f(seg.end_point)}")
            else:
                parts.append(f"C{f(seg.c1)} {f(seg.c2)} {f(seg.end_point)}")
        parts.append("Z")
    return "".join(parts)


def main():
    model = sys.argv[1] if len(sys.argv) > 1 else None
    OUT.mkdir(parents=True, exist_ok=True)
    rgb = np.asarray(Image.open(SRC).convert("RGB"))
    mask, mx = letter_mask(rgb)

    ys, xs = np.where(mask)
    x0, y0 = max(0, xs.min() - MARGIN), max(0, ys.min() - MARGIN)
    x1, y1 = min(rgb.shape[1], xs.max() + 1 + MARGIN), min(rgb.shape[0], ys.max() + 1 + MARGIN)

    bled = bleed(rgb, mask).astype(np.uint8)
    color = upscale(bled, model)
    alpha = hd_mask(coverage(rgb, bled, mask))
    X0, Y0, X1, Y1 = x0 * SCALE, y0 * SCALE, x1 * SCALE, y1 * SCALE
    color = color[Y0:Y1, X0:X1]
    alpha = alpha[Y0:Y1, X0:X1]
    H, W = alpha.shape

    Image.fromarray(color).save(OUT / "sahsih-logo-hd.webp", "WEBP", quality=88, method=6)
    # Smoothstep the soft mask into a crisp anti-aliased edge for the alpha version.
    a = np.clip((alpha - 0.42) / 0.16, 0, 1)
    a = (a * a * (3 - 2 * a) * 255).astype(np.uint8)
    rgba = np.dstack([color, a])
    Image.fromarray(rgba, "RGBA").save(OUT / "sahsih-logo-hd-a.webp", "WEBP", quality=88, method=6)

    path = trace(alpha > 0.5)
    (OUT / "logo-path.txt").write_text(path + "\n")
    for name in ("sahsih-logo-hd.webp", "sahsih-logo-hd-a.webp", "logo-path.txt"):
        print(f"{name}: {(OUT / name).stat().st_size // 1024} KB")
    print(f"viewBox 0 0 {W} {H}  (aspect {W / H:.4f})")


if __name__ == "__main__":
    main()
