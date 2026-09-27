---
version: 1.0
name: Sahsih
description: Design system for the Sahsih marketing site. Near-black, hot pink, one heavy grotesk, sharp corners, 2px hairlines. Values are extracted from styles/site.css and are the source of truth for any new page, section or component.
colors:
  background: "#060606"
  background-raised: "#0d0d0d"
  foreground: "#f3f2f2"
  foreground-2: "#d7d3d3"
  foreground-3: "#9b9797"
  foreground-4: "#7d7979"
  accent: "#ff4de0"
  accent-2: "#3f6cff"
  line: "rgba(243, 242, 242, 0.2)"
  line-soft: "rgba(243, 242, 242, 0.12)"
  flavour-berry: "#c74dff"
  flavour-mango: "#ff9a2e"
  flavour-pineapple: "#ffd52e"
  flavour-watermelon: "#ff3b6b"
  flavour-citrus: "#8fe23f"
typography:
  family: '"Archivo", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
  source: self-hosted variable font, weight axis 100 to 900, assets/fonts/*.woff2
  display: "clamp(44px, 6.4vw, 92px) / 0.92, weight 900, tracking -0.03em"
  display-sm: "clamp(38px, 5.4vw, 76px) / 0.95, weight 900, tracking -0.03em"
  headline: "clamp(32px, 4.4vw, 60px) / 1, weight 900, tracking -0.03em, max 22ch"
  headline-sm: "clamp(30px, 3.6vw, 50px) / 1, weight 900"
  section-word: "clamp(40px, 5vw, 64px) / 1, weight 900, tracking -0.04em"
  quote-lead: "clamp(24px, 2.6vw, 34px) / 1.3, weight 600, tracking -0.02em"
  h3: "24px / 1.2, weight 800, tracking -0.01em"
  lede: "17px / 1.5, colour foreground-2, max 52ch"
  body: "16px / 1.55, colour foreground-2"
  quote: "19px / 1.4, weight 600"
  note: "13px / 1.5, colour foreground-3, max 48ch"
  label: "11px, weight 800, uppercase, tracking 0.18em, colour foreground-3"
  eyebrow: "11px, weight 800, uppercase, tracking 0.24em, colour accent"
  nav: "12px, weight 700, uppercase, tracking 0.14em"
  button: "13px, weight 900, uppercase, tracking 0.12em"
  button-sm: "11px, weight 900, uppercase, tracking 0.12em"
  stat: "clamp(34px, 4vw, 54px) / 1, weight 900, tracking -0.03em, tabular-nums"
  price: "22px, weight 900, tracking -0.02em, tabular-nums"
rounded:
  all: "0"
spacing:
  base: "4px"
  gutter: "28px (20px below 720px)"
  container: "1400px"
  header-height: "66px"
  section-top: "72px (48px below 720px)"
  section-head-bottom: "32px"
  cell-padding: "40px 28px 44px"
  stack-gap: "26px hero, 16px section head, 12px inside cells"
  rule: "2px"
components:
  button-primary: "background {colors.accent}, colour {colors.background}, 2px border {colors.accent}, min-height 52px, padding 0 26px; hover: background and border {colors.foreground}, transform scale(1.04, 0.94); active: scale(0.97)"
  button-outline: "transparent, 2px border {colors.foreground}, colour {colors.foreground}; hover: background and border {colors.accent}, colour {colors.background}, same squash"
  button-dark: "background {colors.background}, colour {colors.foreground}; only on the pink CTA block; hover: background {colors.foreground}, colour {colors.background}"
  button-sm: "min-height 42px, padding 0 18px, 11px label"
  eyebrow: "one per three sections at most; the hero uses the only one on the home page"
  hairgrid: "CSS grid with 2px gaps; the grid background is {colors.line} and cells are {colors.background}, so gaps read as hairlines; 2px top and bottom border"
  stat-tile: "value in {typography.stat}, label in {typography.label}, padding 36px 24px, first cell flush left"
  bento-cell: "hairgrid cell, padding 40px 28px 44px; tinted cells use a radial-gradient of the accent at 16 to 18 percent over {colors.background}"
  frame: "5:8 media frame, image contained, 2px {colors.line} border on the image; keeps labels aligned across renders of different heights"
  flavour-card: "frame plus name plus label; a permanent 12 percent radial tint of the flavour colour at the bottom, 28 percent on hover; image lifts 6px on hover"
  timeline: "2px top hairline with 14px square nodes coloured per step; vertical with a left hairline below 720px"
  quote: "figure, curly quotes, attribution as name and city in {typography.label} plus flavour in accent"
  cart-drawer: "fixed right, 440px max, 2px {colors.foreground} left border, backdrop rgba(6,6,6,0.72); page is inert while open"
  toast: "fixed bottom left, {colors.foreground} on {colors.background} inverted block, 2.6s"
  ticker: "the single marquee; pink band, 28s linear loop, pauses on hover and via the Pause button; static wrap under reduced motion"
---

# Sahsih design system

## 1. Visual theme and atmosphere

Night-out energy on a near-black ground. The product renders carry all the colour; the interface stays black, off-white and one hot pink. The layout is brutalist in the friendly sense: sharp corners, 2px hairlines organising content, heavy grotesk type at large sizes, and a jelly-like squash on every button. Density sits around a 5 on a 10-point scale: sections breathe, but hairline grids keep things tight.

Dials for new work: DESIGN_VARIANCE 6, MOTION_INTENSITY 5, VISUAL_DENSITY 5.

## 2. Colour palette and roles

| Token | Value | Role |
| --- | --- | --- |
| background | #060606 | Page and cell ground. Near-black, never pure #000 in the UI. |
| background-raised | #0d0d0d | Reserved for surfaces that need to sit above the page. |
| foreground | #f3f2f2 | Headlines, primary text, strong rules, outline buttons. |
| foreground-2 | #d7d3d3 | Body copy and ledes. |
| foreground-3 | #9b9797 | Labels, captions, secondary footer text. 7.0:1 on background. |
| foreground-4 | #7d7979 | Legal text and copyright. 4.7:1 on background, the floor for small text. |
| accent | #ff4de0 | The one accent: primary buttons, eyebrow, ticker band, CTA block, tints, focus ring. |
| accent-2 | #3f6cff | Secondary, display use only: the "0" stat, "After", the hydration tint. 4.6:1 on background. |
| line | rgba(243,242,242,0.2) | Hairlines and image borders. |
| line-soft | rgba(243,242,242,0.12) | Rows inside a cell (panel rows, cart items). |
| flavour-* | see front matter | Card tints only, at 12 to 28 percent. Never as text. |

Contrast rules: black text on pink is 7.1:1, off-white on black is 17:1. Do not put off-white text on blue at body sizes (3.9:1).

## 3. Typography rules

One family, Archivo, self-hosted as a variable font. Weights in use: 600 (quotes), 700 (nav, panel terms), 800 (h3, labels, product names), 900 (display, headline, buttons, prices). No serif, no second family, no gradient text.

Hierarchy, top to bottom: display (hero, shop title) > cta-headline (up to 110px, pink block only) > headline (sections) > section-word (Before / During / After) > quote-lead > h3 > lede > body > quote > note > label. Headlines use `text-wrap: balance`, paragraphs `text-wrap: pretty`. Numbers that line up (stats, prices, cart) use `font-variant-numeric: tabular-nums`. Units keep a non-breaking space: `15&nbsp;g`.

Copy voice: short sentences, sentence case, full stops as the rhythm device ("Tear it. Squeeze it. Carry on."). No em-dashes anywhere. Middle dots only inside the ticker.

## 4. Component stylings

- **Buttons** are rectangles with a 2px border, uppercase 13px labels, 52px tall. Primary is pink, secondary is outlined, and the dark variant exists only on the pink CTA block. Hover inverts to off-white and squashes to `scale(1.04, 0.94)`; active is `scale(0.97)`. Labels never wrap.
- **Header** is 66px, sticky, black with a hairline below. Nav links are 12px uppercase; the current view is pink. The cart button is outlined with a count badge that turns pink when the cart has items. Below 900px the nav collapses behind a text "Menu" button into a full-width panel.
- **Hairline grids** replace cards. Any group of cells is a `.hairgrid`: grid gaps show the line colour, cells are black. Tint a cell with a radial gradient of pink or blue when it needs weight.
- **Frames** are 5:8 boxes with the render contained inside and a hairline border on the image itself.
- **Quotes** use real curly quotation marks, a name and city label, and the flavour in pink.
- **Cart drawer** slides from the right over a dark backdrop, traps focus by making the page inert, closes on Escape, backdrop click or the Close button, and returns focus to the opener.
- **Toast** is an inverted block at the bottom left announced through `aria-live="polite"`.

## 5. Layout principles

Container 1400px with 28px gutters (20px on phones). Sections start with a stacked head (headline, optional lede) and 32px below it. Every multi-column block declares its own collapse: hero and splits go single column at 900px, stats go two-up at 720px, the flavour strip becomes a horizontal scroll-snap row below 1024px, the shop grid becomes an order list below 1100px, the timeline turns vertical at 720px.

Layout families on the home page, each used once: split hero, marquee, stat strip, three-cell bento, panel split, timeline, gallery strip, quote wall, full-bleed colour block. Do not add a second three-equal-columns section or a second marquee.

## 6. Depth and elevation

There are no shadows. Depth comes from hairlines, tinted cells and the single inverted CTA block. The cart drawer and mobile menu sit above the page with a solid black ground and a 2px edge rather than a shadow. Image borders are 2px line colour, or 2px off-white when the render is the focal point of its section.

## 7. Do's and don'ts

Do:
- Use one pink accent for every interactive element; blue is for display type and tints only.
- Keep corners square everywhere, including badges and inputs.
- Use hairline grids and negative space instead of cards.
- Provide a real image for any new section; the renders in `assets/img` are the palette.
- Wrap every animation in the `prefers-reduced-motion` override, and keep motion on transform and opacity.

Don't:
- No em-dashes, no middle-dot metadata strips, no section-number eyebrows, no "01 / 03" labels.
- No cards inside cards, no rounded panels, no drop shadows, no glows.
- No more than one eyebrow per three sections.
- No new colour for a new CTA. If it needs attention it is pink; if it is secondary it is outlined.
- No inline `style` attributes: add a class and a token.

## 8. Responsive behaviour

Breakpoints: 480 (buttons go full width in the hero), 720 (gutters, section spacing, stats, timeline), 900 (hero, splits, quotes, bundle, header nav), 1024 (flavour strip), 1100 (shop grid). Touch targets are 40px minimum (nav links, quantity controls) and 52px for primary buttons. The flavour strip scroll-snaps and contains overscroll. Safe-area insets pad the footer, toast and cart drawer.

## 9. Agent prompt guide

Quick tokens: bg #060606, fg #f3f2f2, muted #d7d3d3 / #9b9797, accent #ff4de0, blue #3f6cff, line rgba(243,242,242,.2), font Archivo 900 for headlines, radius 0, rule 2px, gutter 28px, container 1400px.

Prompts that fit this system:
- "Add a section in the Sahsih style: stacked headline in `.headline`, a `.lede`, then a `.hairgrid` with N cells, one tinted pink. No eyebrow, no cards."
- "Build a product detail block: 5:8 `.frame` on the left, name in `.product__name`, `.price`, a `.btn.btn--primary` with `data-add`, hairlines only."
- "Write copy for Sahsih: short sentences, full stops, second person, dry humour, no em-dashes, no filler verbs."

Serve the site (`python3 -m http.server 8000`) and check new work at 1440, 1280x720 and 390 widths with the playwright-cli skill before calling it done.
