# Sahsih, marketing site

Single-page, scroll-driven 3D site for Sahsih, a 15 g hangover jelly stick.
One Three.js sachet revolves in the hero, leans toward the cursor, squishes
when you click it or scroll fast, and travels down the page through
Flavours, Science, When to take and Shop before landing on the footer
wordmark. Picking a flavour recolours the sachet label and the whole page.

The design system lives in `DESIGN.md`. Everything editable (flavours,
colours, prices, packs, HUD numbers, label copy) lives in `src/config.js`.

## Running it

The built scripts are committed, so the site runs from any static server
with no install:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

To change the code:

```bash
npm install          # three, gsap, lenis, esbuild (dev only)
npm run build        # src/*.js -> scripts/app.js and scripts/stage.js
npm run watch        # rebuild on save while developing
```

## Layout

```
index.html              Markup for every section, the cart drawer, the asset template
DESIGN.md               Tokens, components and rules for new UI
src/
  config.js             Flavours, colours, packs, prices, HUD values, label copy
  app.js                Lenis + ScrollTrigger, slots and poses, flavour state,
                        HUD counters, science callouts, timeline, shop, nav
  stage.js              Three.js renderer, lights, glow, spin/squeeze/wobble springs
  sachet.js             Sachet geometry, label textures, material and shader deformation
  backdrop.js           The hero's night scene (bokeh lights on a wet street)
  tint.js               The colour curve that recolours the logo per flavour
  cart.js               Cart lines, persistence, drawer, email order
scripts/                Built bundles (committed). stage.js loads after first paint.
styles/
  fonts.css             Archivo (weight and width axes) and JetBrains Mono, self-hosted
  site.css              Layout, components, layers, responsive and reduced-motion rules
assets/
  img/cut/              Transparent product renders and wordmark used by the page
  img/logo/             High-resolution logo texture and its traced outline
  img/                  Source renders, favicon, OG card
  fonts/                Variable woff2 files
tools/
  build-images.py       WebP/AVIF siblings, cutouts (--cutouts), OG card
  build-logo.py         Rebuilds the high-resolution logo from the original artwork
  build-standalone.py   One self-contained HTML file for sharing
  build-shopify*.py     Shopify theme assets, theme zip, setup kit
  build-product-photos.py  High-resolution transparent product photos
shopify/                The Shopify theme (see "Shopify theme" below)
shopify-kit/            Products CSV, photos and setup guide for store owners
src/shopify/            Theme script and theme-only styles
```

## The big logo

The giant SAHSIH in the hero and footer is the original glossy logo, not
text. `tools/build-logo.py` upscales the 659 px artwork 4x with OpenCV's
EDSR model and traces its outline with potrace; the page draws the texture
clipped by that outline, so the edges stay sharp on any screen. For every
flavour except Berry an SVG filter recolours it with the same curve the 3D
label uses (`src/tint.js`), keeping its highlights and shading. Re-run
`python3 tools/build-logo.py path/to/EDSR_x4.pb` if the logo changes, then
paste `assets/img/logo/logo-path.txt` into the `#logo-clip` path in
`index.html`.

## How the 3D works

- **One canvas.** `#stage` is a fixed, transparent WebGL canvas that sits
  above section backgrounds and the giant wordmarks and below text and
  controls, so the sachet can be in front of SAHSIH and behind the copy.
- **Slots.** Each section has an invisible `.slot` element. As you scroll,
  `getPose()` in `src/app.js` blends from slot to slot using ScrollTrigger
  progress and hands the stage a screen position, height, tilt, spin,
  face-front and glow. Move the sachet by moving or adding a slot; the
  `data-*` attributes on a slot tune its pose.
- **The model** is generated in code (`src/sachet.js`): a puffy pillow with
  crimped, serrated seals, a tear notch and a back fin seal. The label is
  drawn to a canvas per flavour using the real wordmark, Phosphor icons and
  the site fonts, then cached. The material is a clearcoated
  `MeshPhysicalMaterial` with foil seals and glossy film; squeeze, bend and
  twist happen in the vertex shader.
- **Motion.** A slow constant spin, extra spin from scroll speed, a lean
  toward the cursor, a spring-driven squish on click, fast scroll, flavour
  change, add-to-cart and the footer landing, and a bend and twist that
  follow scroll velocity.
- **Fallbacks.** Without WebGL the slots show poster renders of the current
  flavour. With `prefers-reduced-motion` there is no smooth scrolling, no
  pinning, no intro animation, and the sachet holds a still pose.

## Making changes

- **Flavours, prices, packs:** edit `src/config.js`, then `npm run build`.
  A new flavour also needs a `--f-<id>` token in `styles/site.css`, a swatch,
  a flavour row and a chip in `index.html`, and renders at
  `assets/img/cut/stick-<id>` and `box-<id>` (see `tools/build-images.py`).
- **Copy on the pack:** `CONFIG.label` in `src/config.js`.
- **Checkout:** the cart sends a pre-filled email. Replace `mailto()` in
  `src/cart.js` when a real checkout exists.
- **Social cards:** the absolute `og:image`, `twitter:image` and JSON-LD
  URLs in `index.html` assume `sahsih.com`.

## Sharing a single file

```bash
npm run build && npm run standalone
```

Writes `dist/sahsih.html` (everything inlined, about 2 MB) and
`dist/sahsih-artifact.html` (the same page as a fragment for hosts that add
their own document wrapper). `dist/` is ignored by git.

## Shopify theme

`shopify/` is the same site as a Shopify Online Store 2.0 theme, with real
products, an Ajax cart drawer and Shopify checkout. Flavours, colours, the
words on the 3D pack and every section are editable in the theme editor.
`shopify-kit/` holds the product import file, product photos and the
step-by-step guide for store owners (`START-HERE-setup-guide.html`).

```bash
npm run shopify:build     # styles/site.css + src/shopify/shopify.css -> shopify/assets/sahsih.css
                          # src/shopify/theme.js, src/stage.js -> shopify/assets/*.js
npm run shopify:check     # tools/check-shopify.py + Shopify Theme Check
npm run shopify:preview   # local render with a mock store and cart, http://127.0.0.1:9292
npm run shopify:test      # browser test against the preview (needs Playwright)
npm run shopify:zip       # dist/sahsih-shopify-theme.zip and dist/sahsih-shopify-setup-kit.zip
```

- **Theme settings** are generated: edit `tools/shopify-schema.py`, then
  `npm run shopify:schema`.
- **Flavours** come from Theme settings and are matched to the product's
  Flavour option by name. Any other option becomes a row of cards; options
  named Pack, Box or Size show box photos.
- **The Shop section** uses the products with the handles
  `sahsih-hangover-jelly-stick` and `sahsih-full-set` unless others are
  picked, so an imported store works with no set-up.
- **The cart** re-renders through Shopify's Section Rendering API
  (`sections/cart-drawer.liquid`), so prices and discounts are always
  formatted by Shopify.
- **Without JavaScript** the buy form falls back to a variant dropdown.
- `tools/check-shopify.py` catches what Theme Check does not: settings in
  JSON templates, presets and defaults that Shopify would reject on upload.

## Checking your work

Serve the site and screenshot it with the `playwright-cli` skill at
1440x900, 1280x720 and 390x844, once with reduced motion emulated, and
check the console. Headless browsers render WebGL in software, so expect
low frame rates there; that is not representative of real devices.

## Deploying

Static files, no build step on the host (the bundles are committed).
Netlify, Vercel, Cloudflare Pages or GitHub Pages all work with the
repository root as the publish directory. `netlify.toml` sets cache and
security headers.

## Content note

The copy describes a dietary supplement. Ingredient text is descriptive
only, the ingredient panel is marked "to be confirmed before launch", and
the prices are placeholders. Get claims and prices reviewed before launch.
