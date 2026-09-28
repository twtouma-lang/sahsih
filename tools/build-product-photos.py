#!/usr/bin/env python3
"""High-resolution product photos for Shopify, from the site's renders.

  python3 tools/build-product-photos.py path/to/EDSR_x4.pb OUT_DIR

For every stick and box render it upscales the opaque original 4x with
OpenCV's EDSR model and applies the matching cutout's alpha (upscaled and
smoothed), giving a sharp transparent PNG around 1200 px wide. Shopify
product pages, the cart and checkout all use these.
"""
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "assets" / "img"
NAMES = [f"{kind}-{f}" for kind in ("box", "stick") for f in ("berry", "mango", "pineapple", "watermelon", "citrus")] + ["all-boxes"]


def main():
    model, out = sys.argv[1], Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    sr = cv2.dnn_superres.DnnSuperResImpl_create()
    sr.readModel(model)
    sr.setModel("edsr", 4)
    for name in NAMES:
        rgb = np.asarray(Image.open(IMG / f"{name}.png").convert("RGB"))
        big = sr.upsample(rgb[:, :, ::-1].copy())[:, :, ::-1]
        alpha = np.asarray(Image.open(IMG / "cut" / f"{name}.png").convert("RGBA"))[:, :, 3].astype(np.float32) / 255
        a = cv2.resize(alpha, (big.shape[1], big.shape[0]), interpolation=cv2.INTER_CUBIC)
        a = cv2.GaussianBlur(a, (0, 0), 1.2)
        a = np.clip((a - 0.5) / 0.3 + 0.5, 0, 1)
        rgba = np.dstack([big, (a * 255).astype(np.uint8)])
        ys, xs = np.where(rgba[:, :, 3] > 8)
        pad = 24
        crop = rgba[max(0, ys.min() - pad): ys.max() + pad, max(0, xs.min() - pad): xs.max() + pad]
        Image.fromarray(crop, "RGBA").save(out / f"{name}.png", optimize=True)
        print(f"{name}.png {crop.shape[1]}x{crop.shape[0]}", flush=True)


if __name__ == "__main__":
    main()
