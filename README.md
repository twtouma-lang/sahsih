# Sahsih — marketing site

Static one-page site for Sahsih, a hangover jelly stick. Two views (home and
shop), five flavours, a cart counter that counts.

No build step, no framework, no dependencies. Open `index.html` and it works.

## Running it locally

Any static file server will do. The page uses relative paths, so opening the
file directly from disk works too — but a server is closer to production and
avoids font-loading quirks in some browsers.

```bash
python3 -m http.server 8000
# or
npm start
```

Then visit http://localhost:8000.

## Layout

```
index.html            All markup for both views
styles/
  fonts.css           @font-face rules for the self-hosted Archivo files
  site.css            Tokens, layout, components, motion
scripts/
  main.js             Routing, cart, reveals, header, compact menu
assets/
  img/                Product photography, logo, icons
  fonts/              Archivo woff2 subsets (latin, latin-ext, vietnamese)
```

## The design system

Everything visual comes from the token block at the top of `styles/site.css`.
Nothing in the markup carries a hard-coded colour, size or duration.

| Token group | What it fixes |
| --- | --- |
| Colour | `--ink`, `--paper`, `--pink`, `--blue`, `--rule` … |
| Space | `--s-1` … `--s-10`, a single 4px scale |
| Layout | `--wrap`, `--gutter`, `--cell-x`, `--cell-y`, `--rule-w` |
| Type | one size per role, and exactly three tracking values |
| Motion | four durations, three easing curves, one stagger step |

Two structural ideas carry the rest:

**Bands.** A ruled grid is a `.band` whose `gap` *is* the rule: the grid paints
`--rule` behind opaque cells, so every divider is exactly `--rule-w` and stays
that way however the grid wraps. Every `.cell` therefore carries the same
padding on all four sides — no first-child or last-child special cases. The
band is pulled out by one cell inset so cell content lines up with the section
text above it while the rules sit just outside.

Column counts are explicit at every breakpoint (`.cols-2/3/4/6`) rather than
`auto-fit`, so a row never ends with a stretched orphan. The grids of five
products carry a sixth tile — a way through to the shop, or to the bundle —
which is what lets them divide evenly into 6, 3 and 2.

**Plates.** The product shots ship at five different aspect ratios. `.plate`
gives each one an identically proportioned box (the ratio lives on the image
box, via `--ratio`) and `object-fit: contain` centres the artwork inside it, so
tiles in a row are the same height and their borders line up.

## How the page is wired

The markup is semantic HTML with class names. Four conventions connect it to
`scripts/main.js`:

| Attribute | Meaning |
| --- | --- |
| `data-on-click="goShop"` | Runs the named action from the `actions` map |
| `data-bind="cartCount"` | Element whose text is kept in sync with state |
| `data-nav="shop"` | Nav item marked `aria-current` for that view |
| `hidden` on `#view-shop` | Only one `<main>` is visible at a time |

A single delegated click listener on `document` handles every interactive
element, so adding a new button is a matter of adding the attribute and, if
it's a new behaviour, an entry in `actions`.

Every animated state is a class change, so all timings and curves stay in
`site.css` and none are duplicated in JavaScript.

## Routing

`#shop` opens the shop view and is linkable and bookmarkable. `#science`,
`#when` and `#set` are anchors: the router works out which view owns the target
element, switches to it, then scrolls. Browser back and forward work.

## Making changes

- **Prices** — edit `CONFIG` at the top of `scripts/main.js`. The markup carries
  the same values as fallback text (`data-bind="boxPrice"`), so update those
  too if you want the no-JavaScript version to stay accurate.
- **Flavours** — each flavour appears twice: a tile in the home grid and a card
  in the shop grid. Adding one means adding both, plus
  `assets/img/stick-<slug>.png` and `box-<slug>.png`. Keep the grids at a
  multiple of two and three — the sixth tile exists for that reason.
- **Anything visual** — change the token, not the rule that uses it.

## Accessibility and motion

- Skip link, visible focus ring on every control, real `<button>` elements.
- The compact menu is `inert` while closed and closes on `Escape`.
- Adding to the cart is announced through a polite live-region toast.
- `prefers-reduced-motion: reduce` turns off every animation, transition and
  smooth scroll, and reveals all content immediately.
- The page is fully readable with JavaScript disabled — reveals are gated on a
  `js` class set in the document head.

## Known trade-offs

- **The cart is a number.** Adding to it increments a counter. There is no
  basket, no line items, no checkout. Wire `addToCart` in `scripts/main.js` to
  a real backend when there is one.
- **Images are large PNGs.** They are the bulk of the page weight. Serving
  WebP or AVIF alongside them via `<picture>` is the obvious next win.
- **`sahsih-site.zip`** is the original upload, kept as a snapshot. It does not
  track changes made since, so treat the working files as the source of truth.

## Deploying

It's a folder of static files. Push it anywhere that serves them:

- **Netlify / Vercel / Cloudflare Pages** — no build command, publish directory
  `.` (a `netlify.toml` is included).
- **GitHub Pages** — enable Pages on the branch root.

## Content note

Copy on the site describes a dietary supplement. The ingredient panel is marked
as provisional in the markup ("Full quantitative panel and allergen statement to
be confirmed before launch") — get the claims reviewed before this goes public.
