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
npx serve .
```

Then visit http://localhost:8000.

## Layout

```
index.html            All markup for both views
styles/
  fonts.css           @font-face rules for the self-hosted Archivo files
  site.css            Base styles, keyframes, hover states
scripts/
  main.js             View switching, cart counter, keyboard support
assets/
  img/                Product photography, logo, icons
  fonts/              Archivo woff2 subsets (latin, latin-ext, vietnamese)
```

## How the page is wired

The markup is plain HTML with inline styles. Three conventions connect it to
`scripts/main.js`:

| Attribute | Meaning |
| --- | --- |
| `data-on-click="goShop"` | Runs the named action from the `actions` map |
| `data-bind="cartCount"` | Element whose text is kept in sync with state |
| `hidden` on `#view-shop` | Only one `<main>` is visible at a time |

A single delegated click listener on `document` handles every interactive
element, so adding a new button is a matter of adding the attribute and, if
it's a new behaviour, an entry in `actions`.

Clickable `<div>`s and `<span>`s get `role="button"`, `tabindex="0"` and
Enter/Space handling automatically at load.

## Making changes

- **Prices** — edit `CONFIG` at the top of `scripts/main.js`. The markup carries
  the same values as fallback text (`data-bind="boxPrice"`), so update those
  too if you want the no-JavaScript version to stay accurate.
- **Flavours** — each flavour card is written out in `index.html`, once in the
  home grid and once in the shop grid. Adding a flavour means adding a card in
  both places plus `assets/img/stick-<slug>.png` and `box-<slug>.png`.
- **Hover states** — these live as `.hv-01` … `.hv-13` classes in
  `styles/site.css`. They carry `!important` because the elements they apply to
  have inline styles that would otherwise win.

## Known trade-offs

- **Inline styles.** The markup came out of a visual editor and keeps its inline
  `style` attributes. It renders exactly as designed and is easy to tweak in
  place, but there is no design-token layer — colours like `#ff4de0` and
  `#3f6cff` are repeated throughout. Worth extracting to CSS custom properties
  if this site grows.
- **The cart is a number.** Adding to it increments a counter. There is no
  basket, no line items, no checkout. Wire `addToCart` in `scripts/main.js` to
  a real backend when there is one.
- **No routing.** Switching views does not change the URL, so the shop view
  can't be linked to or bookmarked. Add hash or History API routing if that
  matters — but note `#science` and `#when` are already in use as anchors.

## Deploying

It's a folder of static files. Push it anywhere that serves them:

- **Netlify / Vercel / Cloudflare Pages** — no build command, publish directory
  `.` (a `netlify.toml` is included).
- **GitHub Pages** — enable Pages on the branch root.

## Content note

Copy on the site describes a dietary supplement. The ingredient panel is marked
as provisional in the markup ("Full quantitative panel and allergen statement to
be confirmed before launch") — get the claims reviewed before this goes public.
