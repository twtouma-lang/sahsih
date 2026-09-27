# Sahsih, marketing site

Static one-page site for Sahsih, a hangover jelly stick. The home view is a
scroll-driven product film (an opening card, pinned scenes that scrub with
the scroll, film grain), the shop view is a plain grid with a cart, and the
design system lives in `DESIGN.md`.

No build step, no framework, no dependencies. Open `index.html` and it works.

## Running it locally

Any static file server will do. The page uses relative paths, so opening the
file directly from disk works too, but a server is closer to production and
avoids font-loading quirks in some browsers.

```bash
python3 -m http.server 8000
# or
npx serve .
```

Then visit http://localhost:8000.

## Layout

```
index.html            All markup for both views, the cart drawer and the toast
DESIGN.md             Design tokens and rules (source of truth for new UI)
styles/
  fonts.css           @font-face rules for the self-hosted Archivo variable font
  site.css            Tokens, layout, components, motion. No inline styles.
scripts/
  main.js             Routing, cart, drawer, menu, ticker control, reveals
assets/
  img/                Product renders as PNG plus WebP and AVIF siblings, OG card
  img/cut/            Transparent cutouts of the renders and wordmark (what the page shows)
  fonts/              Archivo woff2 subsets (latin, latin-ext, vietnamese)
tools/
  build-images.py     Regenerates the WebP/AVIF siblings and the OG card
  build-standalone.py Bundles everything into one HTML file for sharing
netlify.toml          Publish directory, cache and security headers
```

## How the page is wired

Everything interactive is driven by a few `data-` attributes and one
delegated click listener in `scripts/main.js`:

| Attribute | Meaning |
| --- | --- |
| `href="#shop"`, `href="#home"` | Switches the view. The URL reflects the view, so the shop can be linked and bookmarked. |
| `href="#science"`, `href="#when"` | In-page anchors. They always live in the home view; the script switches view first if needed. |
| `data-add="berry"` | Adds one of that product to the cart (ids are keys of `CONFIG.products`). |
| `data-open-cart`, `data-close-cart` | Opens or closes the cart drawer. |
| `data-qty` + `data-delta`, `data-remove` | Quantity controls inside the drawer (rendered by the script). |
| `data-bind="cartCount"` | Element whose text is kept in sync with the item count. |
| `data-price="berry"` | Element whose text is kept in sync with that product's price. |
| `data-menu` | The mobile menu toggle. |
| `data-ticker-toggle` | Pause and play control for the ticker. |
| `class="reveal"` | Fades the block in when it enters the viewport (IntersectionObserver). |
| `class="reveal-cells"`, `reveal-draw`, `reveal-count` | Staggered cells, the self-drawing timeline, and counting stats. Same observer. |
| `data-tilt` | The hero stage tilts toward the cursor on pointer devices. |
| `data-count="15"` | A number that counts up when its `reveal-count` block enters. |

Actions are real `<button>` elements and navigation uses real `<a>` elements,
so keyboard and screen-reader behaviour comes for free.

### The cart

The cart holds line items per product with quantities, a subtotal, and it
persists in `localStorage` (key `sahsih-cart-v1`) so it survives a reload and
syncs across tabs. There is no payment backend yet: the drawer's "Order by
email" button opens a pre-filled `mailto:` to `hello@sahsih.com` with the
order lines. To connect a real checkout, replace `orderMailto()` in
`scripts/main.js` and the button it feeds (`[data-cart-order]`).

## Making changes

- **Prices and products** live in `CONFIG` at the top of `scripts/main.js`.
  The markup carries the same values as fallback text (`data-price`), and
  the JSON-LD block in `index.html` repeats the price range for search
  engines, so update those too.
- **Flavours**: each flavour is a card in the home strip and a row in the
  shop grid. Adding one means both blocks, a `CONFIG.products` entry, a
  `--tint` colour in `DESIGN.md` and `site.css`, and renders at
  `assets/img/stick-<slug>.png` and `box-<slug>.png`. Then run
  `python3 tools/build-images.py` to create the WebP and AVIF siblings.
- **Styling**: add a class and use the tokens in `:root`. `DESIGN.md`
  describes every component and the rules for new sections. No inline
  styles, no `!important` (the single exception is `[hidden]`).
- **Copy rules**: sentence case, full stops as rhythm, no em-dashes, units
  with a non-breaking space (`15&nbsp;g`).

## Images

Source renders are PNG with a studio background. The page shows transparent
cutouts of them from `assets/img/cut/`, so the sticks and boxes sit on the
black ground under their own coloured floor light and can move independently.

`tools/build-images.py` writes a WebP and an AVIF next to every PNG (about a
tenth and a fifteenth of the PNG weight) and the markup uses `<picture>` to
serve the smallest format the browser supports. It also composes
`assets/img/og.jpg`, the 1200x630 social card. Requires Pillow 11 or newer.

`tools/build-images.py --cutouts` regenerates the cutouts with BiRefNet
(`pip install rembg onnxruntime`; the model downloads on first use and each
image takes about a minute on CPU). Run it after replacing a render.

## Motion

The home page is built from scenes. Each `.scene` is a tall wrapper with a
sticky `.scene__stage`; CSS scroll-driven animations (`view-timeline`) scrub
the elements inside against the scroll position, so there is no scroll
listener and no animation library. Browsers without that support, and
anyone with reduced motion, get every scene as a plain full-height section
with everything visible. The opening card shows once per session, only when
the page opens at the top of the home view, and any input skips it.

Every animation collapses under `prefers-reduced-motion`, and the page is
complete without script: hidden starting states only apply under the `.js`
class inside a `no-preference` media query. The motion vocabulary, the scene
rules and the three clocks are in `DESIGN.md`, sections 4 and 7.

## Sharing a single file

```bash
python3 tools/build-standalone.py            # writes dist/sahsih.html
```

Inlines the styles, script, fonts and WebP images as data URIs so the page can
be emailed or opened from disk with nothing else beside it. `dist/` is ignored
by git; the deployed site is the folder itself.

## Checking your work

The project ships agent skills under `.claude/skills/` (see
`.claude/skills/SOURCES.md`). The useful loop is: serve the site, screenshot it
with `playwright-cli` at 1440, 1280x720 and 390 widths, check the console and
network for errors, then review the files against the web interface
guidelines skill. Motion must collapse under `prefers-reduced-motion`, and
every image needs `width`, `height` and an `alt`.

## Deploying

It's a folder of static files. Push it anywhere that serves them:

- **Netlify / Vercel / Cloudflare Pages**: no build command, publish directory
  `.` (`netlify.toml` sets cache and security headers).
- **GitHub Pages**: enable Pages on the branch root.

Set the absolute `og:image`, `twitter:image` and JSON-LD URLs in `index.html`
to the production origin before launch; they currently assume `sahsih.com`.

## Content note

Copy on the site describes a dietary supplement. The ingredient panel is marked
as provisional in the markup ("Full quantitative panel and allergen statement to
be confirmed before launch"), and the three reviews are placeholders. Get the
claims and the testimonials reviewed before this goes public.
