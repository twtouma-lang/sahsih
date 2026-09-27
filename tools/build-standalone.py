#!/usr/bin/env python3
"""Build a single self-contained HTML file of the site.

  python3 tools/build-standalone.py            # writes dist/sahsih.html
  python3 tools/build-standalone.py out.html   # custom output path

Everything the page needs (styles, script, fonts, images) is inlined as
data URIs so the file can be emailed, opened from disk or dropped into a
preview without any other files. Images are inlined as WebP only, which
every current browser supports, so the file stays under a megabyte.

The deployed site is the folder as-is; this build is only for sharing.
"""
import base64
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MIME = {
    ".woff2": "font/woff2",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".png": "image/png",
    ".jpg": "image/jpeg",
}


def data_uri(path: Path) -> str:
    mime = MIME[path.suffix]
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode('ascii')}"


def inline_css(css_path: Path) -> str:
    css = css_path.read_text(encoding="utf-8")

    def repl(m):
        target = (css_path.parent / m.group(1)).resolve()
        return f'url("{data_uri(target)}")'

    return re.sub(r'url\("([^"]+)"\)', repl, css)


def build(out: Path) -> None:
    html = (ROOT / "index.html").read_text(encoding="utf-8")

    # Stylesheets and script.
    for href in ("styles/fonts.css", "styles/site.css"):
        tag = f'<link rel="stylesheet" href="{href}">'
        assert tag in html, tag
        html = html.replace(tag, f"<style>\n{inline_css(ROOT / href)}\n</style>")
    script_tag = '<script src="scripts/main.js" defer></script>'
    assert script_tag in html
    js = (ROOT / "scripts/main.js").read_text(encoding="utf-8")
    html = html.replace(script_tag, f"<script defer>\n{js}\n</script>")

    # Drop the preloads: nothing is fetched over the network any more.
    html = re.sub(r'\s*<link rel="preload"[^>]*>', "", html)

    # <picture>: keep the <img>, point it at the inlined WebP.
    def picture(m):
        img = m.group(2)
        src = re.search(r'src="([^"]+)\.png"', img).group(1)
        webp = ROOT / f"{src}.webp"
        img = img.replace(f'src="{src}.png"', f'src="{data_uri(webp)}"')
        return f"<picture{m.group(1)}>{img}</picture>"

    html = re.sub(r"<picture([^>]*)>.*?(<img[^>]*>)\s*</picture>", picture, html, flags=re.S)

    # Favicons.
    for rel_path in ("assets/img/favicon.png", "assets/img/apple-touch-icon.png"):
        html = html.replace(f'href="{rel_path}"', f'href="{data_uri(ROOT / rel_path)}"')

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    leftover = re.findall(r'(?:src|href)="(assets/[^"]+|styles/[^"]+|scripts/[^"]+)"', html)
    print(f"wrote {out} ({out.stat().st_size // 1024} KB)")
    if leftover:
        print("still referenced:", sorted(set(leftover)))


if __name__ == "__main__":
    build(Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "dist" / "sahsih.html")
