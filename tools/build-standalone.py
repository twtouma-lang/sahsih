#!/usr/bin/env python3
"""Build a single self-contained HTML file of the site.

  python3 tools/build-standalone.py                 # writes dist/sahsih.html
  python3 tools/build-standalone.py out.html        # custom output path
  python3 tools/build-standalone.py --artifact      # writes dist/sahsih-artifact.html

Everything the page needs (styles, both scripts, fonts, images) is inlined so
the file can be emailed, opened from disk or dropped into a preview with
nothing beside it. Images are inlined as WebP, which every current browser
supports. Run `npm run build` first so scripts/ is current.

The deployed site is the folder as-is; this build is only for sharing.

The --artifact variant is the same page as a fragment, for hosts that wrap
the content in their own document skeleton (a claude.ai artifact, for
example): no doctype, html, head or body tags, just a title, the styles,
the content and the scripts.
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
    return f"data:{MIME[path.suffix]};base64,{base64.b64encode(path.read_bytes()).decode('ascii')}"


def inline_css(css_path: Path) -> str:
    css = css_path.read_text(encoding="utf-8")

    def repl(m):
        ref = m.group(1)
        if ref.startswith("data:"):
            return m.group(0)  # already inline (the grain texture)
        return f'url("{data_uri((css_path.parent / ref).resolve())}")'

    return re.sub(r'url\("([^"]+)"\)', repl, css)


def webp_for(src: str) -> Path:
    path = ROOT / src
    if path.suffix in (".png", ".jpg"):
        alt = path.with_suffix(".webp")
        if alt.exists():
            return alt
    return path


def script_block(js: str) -> str:
    # A literal "</script" inside a bundle would end the tag early.
    return "<script>\n" + js.replace("</script", "<\\/script") + "\n</script>"


def build(out: Path, artifact: bool = False) -> None:
    html = (ROOT / "index.html").read_text(encoding="utf-8")

    # 1. Markup first, while the document holds only markup: inlined CSS and
    #    JS can mention tags in comments and strings.
    html = re.sub(r"\s*<source [^>]*>", "", html)  # <picture> sources; the <img> remains
    html = re.sub(
        r'(src|href)="(assets/img/[^"]+\.(?:png|webp|avif|jpg))"',
        lambda m: f'{m.group(1)}="{data_uri(webp_for(m.group(2)))}"',
        html,
    )
    html = re.sub(r'\s*<link rel="preload"[^>]*>', "", html)

    # 2. Styles.
    for href in ("styles/fonts.css", "styles/site.css"):
        tag = f'<link rel="stylesheet" href="{href}">'
        assert tag in html, tag
        html = html.replace(tag, f"<style>\n{inline_css(ROOT / href)}\n</style>")

    # 3. Scripts. The page script loads the 3D stage on demand unless it is
    #    already present, so the stage goes first. Inline scripts ignore
    #    `defer`, so both move to the end of <body>.
    app_tag = '<script src="scripts/app.js" defer></script>'
    assert app_tag in html, app_tag
    html = html.replace(app_tag, "")
    stage = (ROOT / "scripts/stage.js").read_text(encoding="utf-8")
    app = (ROOT / "scripts/app.js").read_text(encoding="utf-8")
    html = html.replace("</body>", f"{script_block(stage)}\n{script_block(app)}\n</body>")

    if artifact:
        html = as_fragment(html)

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html, encoding="utf-8")
    print(f"wrote {out} ({out.stat().st_size // 1024} KB)")

    markup = re.sub(r"<script>.*?</script>", "", html, flags=re.S)  # bundles may name paths in strings
    leftover = re.findall(r'(?:src|href)="((?:assets|styles|scripts)/[^"]+)"', markup)
    if leftover:
        raise SystemExit(f"still referenced: {sorted(set(leftover))}")
    if not artifact:
        for tag, want in (("<body>", 1), ("</body>", 1), ("<main", 1), ('<canvas class="stage"', 1)):
            if html.count(tag) != want:
                raise SystemExit(f"structure check failed: {tag} x{html.count(tag)}, expected {want}")


def as_fragment(html: str) -> str:
    """Reduce a full document to title + styles + body content + scripts."""
    styles = "\n".join(re.findall(r"<style>.*?</style>", html, flags=re.S))
    body = re.search(r"<body>(.*)</body>", html, flags=re.S).group(1).strip()
    head_script = re.search(r"<script>\s*document\.documentElement[\s\S]*?</script>", html).group(0)
    return f"<title>Sahsih</title>\n{head_script}\n{styles}\n{body}\n"


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    artifact = "--artifact" in sys.argv
    default = ROOT / "dist" / ("sahsih-artifact.html" if artifact else "sahsih.html")
    build(Path(args[0]) if args else default, artifact=artifact)
