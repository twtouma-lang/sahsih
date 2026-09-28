#!/usr/bin/env python3
"""Writes shopify/config/settings_schema.json and settings_data.json.

The flavour and label settings repeat, so they are generated here rather
than written by hand. Run after changing any default:

  python3 tools/shopify-schema.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "shopify" / "config"

FLAVOURS = [
    ("Berry", "Deep and jammy", "#ff4de0", "#ffc2f5", "#5a1a86"),
    ("Mango", "Thick and golden", "#ff9a2e", "#ffe0a8", "#9a3a05"),
    ("Pineapple", "Sharp, tropical", "#ffd52e", "#fff4b0", "#8a6a00"),
    ("Watermelon", "Light, cooling", "#ff3b6b", "#ffc0cf", "#8a0a2c"),
    ("Citrus", "Clean and bright", "#8fe23f", "#e2ffb8", "#2f6a07"),
    ("", "", "#3fb8ff", "", ""),
]

ROWS = [
    ("leaf", "MILK THISTLE", "BOTANICAL"),
    ("drop", "ELECTROLYTES", "MINERAL SALTS"),
    ("lightning", "B VITAMINS", "B1 · B6 · B12"),
]

ICONS = [
    ("leaf", "Leaf"),
    ("drop", "Drop"),
    ("lightning", "Lightning"),
    ("heart", "Heart"),
    ("sparkle", "Sparkle"),
    ("flask", "Flask"),
    ("sun", "Sun"),
    ("moon", "Moon"),
    ("shield", "Shield"),
    ("star", "Star"),
    ("fire", "Flame"),
    ("coffee", "Coffee cup"),
]


def flavour_settings():
    out = [
        {
            "type": "paragraph",
            "content": "Up to six flavours. They colour the whole site, the 3D stick and the flavour buttons. Each name must match a value of the Flavour option on your product (for example Berry). Leave a name empty to hide that flavour.",
        }
    ]
    for i, (name, note, color, light, deep) in enumerate(FLAVOURS, start=1):
        out.append({"type": "header", "content": f"Flavour {i}"})
        name_setting = {"type": "text", "id": f"flavour_{i}_name", "label": "Name"}
        note_setting = {"type": "text", "id": f"flavour_{i}_note", "label": "Short description"}
        if name:
            name_setting["default"] = name
            note_setting["default"] = note
        else:
            name_setting["info"] = "Leave empty to hide."
        out += [
            name_setting,
            note_setting,
            {"type": "color", "id": f"flavour_{i}_color", "label": "Colour", "default": color},
        ]
        light_setting = {
            "type": "color",
            "id": f"flavour_{i}_light",
            "label": "Highlight colour",
            "info": "Optional. Used for shine on the logo and the 3D label. Leave empty to work it out from the colour.",
        }
        deep_setting = {
            "type": "color",
            "id": f"flavour_{i}_deep",
            "label": "Shadow colour",
            "info": "Optional. Leave empty to work it out from the colour.",
        }
        if light:
            light_setting["default"] = light
            deep_setting["default"] = deep
        out += [
            light_setting,
            deep_setting,
            {
                "type": "image_picker",
                "id": f"flavour_{i}_stick",
                "label": "Stick photo",
                "info": "Optional. Shown only on devices that cannot show 3D. Transparent PNG, portrait.",
            },
            {
                "type": "image_picker",
                "id": f"flavour_{i}_box",
                "label": "Box photo",
                "info": "Optional. Shown on the pack buttons. Transparent PNG, portrait. Leave empty to use the variant photo.",
            },
        ]
    return out


def label_settings():
    out = [
        {"type": "checkbox", "id": "enable_3d", "label": "Show the 3D jelly stick", "default": True,
         "info": "Turn off to show product photos in its place."},
        {"type": "image_picker", "id": "label_logo", "label": "Logo printed on the stick",
         "info": "Optional. Transparent PNG, wide. Leave empty to use the Sahsih logo."},
        {"type": "header", "content": "Front of the pack"},
        {"type": "text", "id": "label_line_1", "label": "First line", "default": "HANGOVER"},
        {"type": "text", "id": "label_line_2", "label": "Second line", "default": "JELLY STICK"},
        {"type": "text", "id": "label_strap", "label": "Strapline", "default": "REPLENISH • REBALANCE • FEEL GOOD"},
    ]
    for i, (icon, title, sub) in enumerate(ROWS, start=1):
        out += [
            {"type": "header", "content": f"Ingredient row {i}"},
            {"type": "select", "id": f"label_row_{i}_icon", "label": "Icon", "default": icon,
             "options": [{"value": v, "label": l} for v, l in ICONS]},
            {"type": "text", "id": f"label_row_{i}_title", "label": "Ingredient", "default": title},
            {"type": "text", "id": f"label_row_{i}_sub", "label": "Detail", "default": sub},
        ]
    out += [
        {"type": "header", "content": "Bottom of the pack"},
        {"type": "text", "id": "label_flavour_word", "label": "Word under the flavour name", "default": "FLAVOUR"},
        {"type": "text", "id": "label_weight", "label": "Weight", "default": "NET WT. 15 g"},
        {"type": "header", "content": "Back of the pack"},
        {"type": "textarea", "id": "label_back_big", "label": "Large text", "default": "TEAR AT THE NOTCH.\nSQUEEZE. CARRY ON.",
         "info": "One line per row, up to three rows."},
        {"type": "textarea", "id": "label_back_small", "label": "Small text", "default": "DIETARY SUPPLEMENT · 15 g\nNO WATER NEEDED"},
        {"type": "textarea", "id": "label_back_fine", "label": "Fine print",
         "default": "FULL INGREDIENT PANEL AND\nALLERGEN STATEMENT TO BE\nCONFIRMED BEFORE LAUNCH."},
    ]
    return out


schema = [
    {
        "name": "theme_info",
        "theme_name": "Sahsih",
        "theme_version": "1.0.0",
        "theme_author": "Sahsih",
        "theme_documentation_url": "https://help.shopify.com/manual/online-store/themes/customizing-themes",
        "theme_support_url": "https://help.shopify.com/",
    },
    {
        "name": "Colours",
        "settings": [
            {"type": "paragraph", "content": "The highlight colour of the site comes from the selected flavour. Set flavour colours under Flavours."},
            {"type": "color", "id": "color_background", "label": "Background", "default": "#060606"},
            {"type": "color", "id": "color_text", "label": "Headings", "default": "#f5f5f5"},
            {"type": "color", "id": "color_text_body", "label": "Body text", "default": "#c8c8ce"},
            {"type": "color", "id": "color_text_muted", "label": "Small labels", "default": "#8d8d96"},
        ],
    },
    {"name": "Flavours", "settings": flavour_settings()},
    {
        "name": "Logo",
        "settings": [
            {"type": "image_picker", "id": "wordmark_image", "label": "Giant logo",
             "info": "Optional. The huge logo behind the jelly stick in the hero and footer. Leave empty to use the Sahsih bubble logo. Transparent PNG, wide."},
            {"type": "checkbox", "id": "wordmark_tint", "label": "Recolour the giant logo to the selected flavour", "default": True,
             "info": "Flavour 1 always shows the logo in its original colours."},
            {"type": "image_picker", "id": "favicon", "label": "Browser tab icon",
             "info": "Optional. Square PNG, at least 96 x 96 px. Leave empty to use the Sahsih icon."},
        ],
    },
    {"name": "3D jelly stick", "settings": label_settings()},
    {
        "name": "Motion",
        "settings": [
            {"type": "paragraph", "content": "Visitors whose device asks for reduced motion always see a still version of the site."},
            {"type": "checkbox", "id": "smooth_scroll", "label": "Smooth scrolling", "default": True},
            {"type": "checkbox", "id": "intro_animation", "label": "Opening animation on the homepage", "default": True},
            {"type": "checkbox", "id": "reveal_animations", "label": "Reveal sections as you scroll", "default": True},
            {"type": "checkbox", "id": "film_grain", "label": "Film grain", "default": True},
        ],
    },
    {
        "name": "Cart",
        "settings": [
            {"type": "select", "id": "cart_type", "label": "After adding to cart", "default": "drawer",
             "options": [
                 {"value": "drawer", "label": "Open the cart drawer"},
                 {"value": "toast", "label": "Show a short message"},
                 {"value": "page", "label": "Go to the cart page"},
             ]},
            {"type": "checkbox", "id": "cart_note", "label": "Let customers add an order note", "default": False},
        ],
    },
    {
        "name": "Social media",
        "settings": [
            {"type": "paragraph", "content": "Links appear in the footer. Leave empty to hide."},
            {"type": "text", "id": "social_instagram_link", "label": "Instagram", "placeholder": "https://instagram.com/sahsih"},
            {"type": "text", "id": "social_tiktok_link", "label": "TikTok", "placeholder": "https://tiktok.com/@sahsih"},
            {"type": "text", "id": "social_x_link", "label": "X (Twitter)", "placeholder": "https://x.com/sahsih"},
            {"type": "text", "id": "social_facebook_link", "label": "Facebook", "placeholder": "https://facebook.com/sahsih"},
            {"type": "text", "id": "social_youtube_link", "label": "YouTube", "placeholder": "https://youtube.com/@sahsih"},
        ],
    },
]

HEADER = """/*
 * ------------------------------------------------------------
 * IMPORTANT: The contents of this file are auto-generated.
 *
 * This file may be updated by the Shopify admin theme editor
 * or related systems. Please exercise caution as any changes
 * made to this file may be overwritten.
 * ------------------------------------------------------------
 */
"""


def defaults():
    out = {}
    for group in schema[1:]:
        for s in group["settings"]:
            if "id" in s and "default" in s:
                out[s["id"]] = s["default"]
    return out


if __name__ == "__main__":
    CONFIG.mkdir(parents=True, exist_ok=True)
    (CONFIG / "settings_schema.json").write_text(json.dumps(schema, indent=2, ensure_ascii=False) + "\n")
    data = {"current": "Default", "presets": {"Default": defaults()}}
    (CONFIG / "settings_data.json").write_text(HEADER + json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print("wrote", CONFIG / "settings_schema.json", "and settings_data.json")
