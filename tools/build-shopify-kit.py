#!/usr/bin/env python3
"""Writes the Shopify setup kit: the products CSV and the kit zip.

  python3 tools/build-shopify-kit.py

shopify-kit/sahsih-products.csv creates two products when imported
(Products > Import): the jelly stick (5 flavours x 2 packs = 10 variants)
and The Full Set. Photos are linked from the public GitHub repository so
Shopify downloads them during the import; they are also in
shopify-kit/photos for manual upload. Prices are placeholders.
"""
import csv
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KIT = ROOT / "shopify-kit"
PHOTOS = "https://raw.githubusercontent.com/twtouma-lang/sahsih/claude/festive-dijkstra-rt1v7p/shopify-kit/photos/"

FLAVOURS = ["Berry", "Mango", "Pineapple", "Watermelon", "Citrus"]
PACKS = [("1 box", "24.00", "1"), ("3 boxes", "72.00", "3")]

COLUMNS = [
    "Handle", "Title", "Body (HTML)", "Vendor", "Type", "Tags", "Published",
    "Option1 Name", "Option1 Value", "Option2 Name", "Option2 Value",
    "Variant SKU", "Variant Inventory Tracker", "Variant Inventory Policy", "Variant Fulfillment Service",
    "Variant Price", "Variant Compare At Price", "Variant Requires Shipping", "Variant Taxable",
    "Image Src", "Image Position", "Image Alt Text", "Variant Image",
    "SEO Title", "SEO Description", "Status",
]

STICK_BODY = (
    "<p>A 15 g jelly stick you tear at the notch and squeeze. No water, no glass, no ceremony.</p>"
    "<p>Every stick has milk thistle, electrolytes and B vitamins (B1, B6, B12). Ten sticks per box.</p>"
    "<p>Full ingredient panel and allergen statement to be confirmed before launch.</p>"
)
SET_BODY = (
    "<p>One box of every flavour: Berry, Mango, Pineapple, Watermelon and Citrus. 50 sticks.</p>"
    "<p>Full ingredient panel and allergen statement to be confirmed before launch.</p>"
)


def row(**kw):
    return {c: kw.get(c, "") for c in COLUMNS}


def rows():
    out = []
    handle = "sahsih-hangover-jelly-stick"
    images = [f"box-{f.lower()}.webp" for f in FLAVOURS] + [f"stick-{f.lower()}.webp" for f in FLAVOURS]
    first = True
    for f in FLAVOURS:
        for pack, price, n in PACKS:
            r = row(
                Handle=handle,
                **{
                    "Option1 Value": f,
                    "Option2 Value": pack,
                    "Variant SKU": f"SAH-{f[:3].upper()}-{n}",
                    "Variant Inventory Policy": "deny",
                    "Variant Fulfillment Service": "manual",
                    "Variant Price": price,
                    "Variant Requires Shipping": "TRUE",
                    "Variant Taxable": "TRUE",
                    "Variant Image": PHOTOS + f"box-{f.lower()}.webp",
                },
            )
            if first:
                r.update({
                    "Title": "Sahsih Hangover Jelly Stick",
                    "Body (HTML)": STICK_BODY,
                    "Vendor": "Sahsih",
                    "Type": "Dietary supplement",
                    "Tags": "sahsih, jelly stick",
                    "Published": "TRUE",
                    "Option1 Name": "Flavour",
                    "Option2 Name": "Pack",
                    "SEO Title": "Sahsih Hangover Jelly Stick | Five flavours, no water",
                    "SEO Description": "A 15 g jelly stick with milk thistle, electrolytes and B vitamins. Five flavours. Tear, squeeze, carry on.",
                    "Status": "active",
                })
                first = False
            out.append(r)
    for i, img in enumerate(images, start=1):
        name = img.replace(".webp", "").split("-")
        alt = f"{name[1].capitalize()} {'box' if name[0] == 'box' else 'jelly stick'}"
        if i <= len(out):
            out[i - 1].update({"Image Src": PHOTOS + img, "Image Position": str(i), "Image Alt Text": alt})
        else:
            out.append(row(Handle=handle, **{"Image Src": PHOTOS + img, "Image Position": str(i), "Image Alt Text": alt}))

    out.append(row(
        Handle="sahsih-full-set",
        Title="The Full Set",
        Vendor="Sahsih",
        Type="Dietary supplement",
        Tags="sahsih, bundle",
        Published="TRUE",
        Status="active",
        **{
            "Body (HTML)": SET_BODY,
            "Option1 Name": "Title",
            "Option1 Value": "Default Title",
            "Variant SKU": "SAH-SET-5",
            "Variant Inventory Policy": "deny",
            "Variant Fulfillment Service": "manual",
            "Variant Price": "105.00",
            "Variant Requires Shipping": "TRUE",
            "Variant Taxable": "TRUE",
            "Image Src": PHOTOS + "all-boxes.webp",
            "Image Position": "1",
            "Image Alt Text": "All five Sahsih boxes",
            "SEO Title": "The Full Set | All five Sahsih flavours",
            "SEO Description": "One box of every Sahsih flavour. 50 jelly sticks.",
        },
    ))
    return out


def main():
    KIT.mkdir(exist_ok=True)
    with open(KIT / "sahsih-products.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=COLUMNS)
        w.writeheader()
        w.writerows(rows())
    dist = ROOT / "dist"
    dist.mkdir(exist_ok=True)
    out = dist / "sahsih-shopify-setup-kit.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(KIT.rglob("*")):
            if f.is_file():
                z.write(f, f"sahsih-setup-kit/{f.relative_to(KIT).as_posix()}")
    print(f"{out.relative_to(ROOT)} {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
