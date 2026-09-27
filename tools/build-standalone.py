#!/usr/bin/env python3
"""Build a single self-contained HTML file of the site.

  python3 tools/build-standalone.py                 # writes dist/sahsih.html
  python3 tools/build-standalone.py out.html        # custom output path
  python3 tools/build-standalone.py --artifact      # writes dist/sahsih-artifact.html

Everything the page needs (styles, script, fonts, images) is inlined as
data URIs so the file can be emailed, opened from disk or dropped into a
preview without any other files. Images are inlined as WebP only, which
every current browser supports, so the file stays under a megabyte.

The deployed site is the folder as-is; this build is only for sharing.

The --artifact variant is the same page trimmed for hosts that wrap the
content in their own document skeleton (a claude.ai artifact, for example):
no doctype, html, head or body tags, a short <title>, and the styles,
content and script in one fragment.
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
        ref = m.group(1)
        if ref.startswith("data:"):
            return m.group(0)  # already inline (the grain texture)
        target = (css_path.parent / ref).resolve()
        return f'url("{data_uri(target)}")'

    return re.sub(r'url\("([^"]+)"\)', repl, css)


def build(out: Path, artifact: bool = False) -> None:
    html = (ROOT / "index.html").read_text(encoding="utf-8")

    # Rewrite the markup first, while the document still contains only
    # markup. Inlined CSS and JS can legitimately mention "<picture>" or
    # "<img" in comments and strings, and the tag regexes must never see it.

    # <picture>: keep the <img>, point it at the inlined WebP.
    def picture(m):
        img = m.group(2)
        src = re.search(r'src="([^"]+)\.png"', img).group(1)
        webp = ROOT / f"{src}.webp"
        img = img.replace(f'src="{src}.png"', f'src="{data_uri(webp)}"')
        return f"<picture{m.group(1)}>{img}</picture>"

    html = re.sub(r"<picture(\s[^>]*)?>\s*(?:<source[^>]*>\s*)*(<img[^>]*>)\s*</picture>", picture, html)

    # Favicons.
    for rel_path in ("assets/img/favicon.png", "assets/img/apple-touch-icon.png"):
        html = html.replace(f'href="{rel_path}"', f'href="{data_uri(ROOT / rel_path)}"')

    # Drop the preloads: nothing is fetched over the network any more.
    html = re.sub(r'\s*<link rel="preload"[^>]*>', "", html)

    # Stylesheets and script, last.
    for href in ("styles/fonts.css", "styles/site.css"):
        tag = f'<link rel="stylesheet" href="{href}">'
        assert tag in html, tag
        html = html.replace(tag, f"<style>\n{inline_css(ROOT / href)}\n</style>")
    # `defer` only applies to external scripts, so an inlined copy in <head>
    # would run before the DOM exists. Move it to the end of <body> instead.
    script_tag = '<script src="scripts/main.js" defer></script>'
    assert script_tag in html
    js = (ROOT / "scripts/main.js").read_text(encoding="utf-8")
    html = html.replace(script_tag, "")
    html = html.replace("</body>", f"<script>\n{js}\n</script>\n</body>")

    if artifact:
        html = as_fragment(html)

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    leftover = re.findall(r'(?:src|href)="(assets/[^"]+|styles/[^"]+|scripts/[^"]+)"', html)
    print(f"wrote {out} ({out.stat().st_size // 1024} KB)")
    if leftover:
        print("still referenced:", sorted(set(leftover)))
    for tag, want in (("<body>", 1), ("</body>", 1), ("<style>", 2), ("</style>", 2), ("<main", 2)):
        if not artifact and html.count(tag) != want:
            raise SystemExit(f"structure check failed: {tag} x{html.count(tag)}, expected {want}")


def as_fragment(html: str) -> str:
    """Reduce a full document to title + styles + body content + script."""
    styles = "\n".join(re.findall(r"<style>.*?</style>", html, flags=re.S))
    body = re.search(r"<body>(.*)</body>", html, flags=re.S).group(1).strip()
    # The host skeleton pads the root by the phone's safe-area insets and
    # expects a sticky header to sit below the top inset; reveals must be
    # visible at rest because the host captures a still frame of the page.
    extra = (
        "<style>\n"
        ".site-header { top: env(safe-area-inset-top, 0px); }\n"
        ".js .reveal, .js .reveal-cells > * > *, .js .reveal-stagger > *,\n"
        ".js .reveal-draw .timeline__step > * { opacity: 1; transform: none; }\n"
        ".js .reveal-draw::before, .js .reveal-draw .timeline__step::before { transform: none; }\n"
        "</style>"
    )
    return f"<title>Sahsih</title>\n{styles}\n{extra}\n{body}\n"


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    artifact = "--artifact" in sys.argv
    default = ROOT / "dist" / ("sahsih-artifact.html" if artifact else "sahsih.html")
    build(Path(args[0]) if args else default, artifact=artifact)
