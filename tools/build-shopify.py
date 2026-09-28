#!/usr/bin/env python3
"""Builds the Shopify theme's CSS and JavaScript from the site sources.

  python3 tools/build-shopify.py          # CSS + JS into shopify/assets
  python3 tools/build-shopify.py --zip    # also writes dist/sahsih-shopify-theme.zip

sahsih.css is styles/site.css (with the static site's fixed flavour
classes removed, since the theme gets its flavours from Theme settings)
followed by src/shopify/shopify.css. The scripts are bundled with esbuild:
src/shopify/theme.js becomes sahsih-theme.js and src/stage.js becomes
sahsih-stage.js (the 3D stick, loaded only on pages that show it).
"""
import re
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
THEME = ROOT / "shopify"
ASSETS = THEME / "assets"
THEME_DIRS = ["assets", "config", "layout", "locales", "sections", "snippets", "templates"]


def build_css():
    css = (ROOT / "styles" / "site.css").read_text()
    # Flavour colours come from Theme settings, set inline per element.
    css = re.sub(r"\n  /\* Flavour colours; the script overwrites these from CONFIG\. \*/\n(  --f-[a-z]+: #[0-9a-f]{6};\n)+", "\n", css)
    css = re.sub(r"^\.(swatch|flavour-row|chip)--[a-z]+ \{ --[a-z]+: var\(--f-[a-z]+\); \}\n", "", css, flags=re.M)
    css = css.replace("--swatch: var(--f-berry);", "--swatch: var(--accent);")
    css = css.replace("--row: var(--f-berry);", "--row: var(--accent);")
    css = css.replace("--chip: var(--f-berry);", "--chip: var(--accent);")
    # The static site's hint text; the theme uses a translated hint element.
    css = re.sub(r"^\.buy\.is-mixed [^\n]*\n", "", css, flags=re.M)
    css = css.replace(".pack--trio", ".pack--multi")
    assert "--f-" not in css, "a flavour token survived"
    header = "/* Sahsih Shopify theme. Built by tools/build-shopify.py from styles/site.css\n   and src/shopify/shopify.css; edit those files, not this one. */\n\n"
    out = header + css.rstrip() + "\n\n" + (ROOT / "src" / "shopify" / "shopify.css").read_text()
    (ASSETS / "sahsih.css").write_text(out)
    print(f"sahsih.css {len(out) // 1024} KB")


def build_js():
    esbuild = ROOT / "node_modules" / ".bin" / "esbuild"
    common = ["--bundle", "--minify", "--format=iife", "--target=es2020", "--legal-comments=eof", "--loader:.svg=text"]
    subprocess.run([str(esbuild), "src/shopify/theme.js", *common, f"--outfile={ASSETS / 'sahsih-theme.js'}"], cwd=ROOT, check=True)
    subprocess.run([str(esbuild), "src/stage.js", *common, f"--outfile={ASSETS / 'sahsih-stage.js'}"], cwd=ROOT, check=True)


def build_zip():
    dist = ROOT / "dist"
    dist.mkdir(exist_ok=True)
    out = dist / "sahsih-shopify-theme.zip"
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for d in THEME_DIRS:
            for f in sorted((THEME / d).rglob("*")):
                if f.is_file() and not f.name.startswith("."):
                    z.write(f, f.relative_to(THEME).as_posix())
    print(f"{out.relative_to(ROOT)} {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    build_css()
    build_js()
    if "--zip" in sys.argv:
        build_zip()
