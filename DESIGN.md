---
version: 2.0
name: Sahsih
description: Design system for the Sahsih site. A scroll-driven 3D product launch on near-black, one revolving jelly-stick sachet as the hero object, a flavour-driven accent colour, condensed and expanded Archivo at poster scale, mono HUD labels, film grain. Values come from styles/site.css and src/config.js.
colors:
  background: "#060606"
  background-2: "#0b0b0e"
  foreground: "#f5f5f5"
  foreground-2: "#c8c8ce"
  foreground-3: "#8d8d96"
  ink: "#060606"
  accent: "var(--accent), set from the current flavour; defaults to #ff4de0"
  blue: "#3f6cff (rim light on the sachet only)"
  line: "rgba(245, 245, 245, 0.12)"
  line-2: "rgba(245, 245, 245, 0.22)"
  hud-line: "accent at 70 percent"
  glass: "rgba(6, 6, 6, 0.5) with 8px backdrop blur"
  flavour-berry: "#ff4de0"
  flavour-mango: "#ff9a2e"
  flavour-pineapple: "#ffd52e"
  flavour-watermelon: "#ff3b6b"
  flavour-citrus: "#8fe23f"
typography:
  display-family: '"Archivo" variable, weight 100 to 900, width 62 to 125 percent, self-hosted'
  mono-family: '"JetBrains Mono" variable, weight 100 to 800, self-hosted'
  wordmark: "Archivo 900 at 125% width, uppercase, font-size = (page width minus gutters) / 5.06 so SAHSIH spans the page, line-height 0.78"
  hero-title: "Archivo 900 at 62% width, clamp(72px, 10.4vw, 188px), line-height 0.84, uppercase, cut off by the fold"
  h-cond: "Archivo 900 at 62% width, clamp(52px, 7.6vw, 132px), line-height 0.86, uppercase"
  flavour-name: "Archivo 900 at 62% width, clamp(44px, 5.2vw, 88px)"
  callout-title: "Archivo 900 at 62% width, 32px"
  button: "Archivo 800 at 112% width, 13px, uppercase, tracking 0.08em"
  body: "Archivo 400, 16 to 17px, line-height 1.5, foreground-2"
  label: "JetBrains Mono 600, 10 to 12px, uppercase, tracking 0.14 to 0.2em"
  tag: "JetBrains Mono 600, 11px, accent, wrapped in [ ] brackets in foreground-3"
  hud-value: "Archivo 900 at 62% width, 34px, tabular numbers"
rounded:
  default: "0"
  exceptions: "flavour dots and chips are circles; nothing else is rounded"
spacing:
  gutter: "clamp(20px, 3vw, 44px)"
  container: "1440px"
  bar-height: "68px (58px below 900px) plus the top safe-area inset"
  section-y: "clamp(96px, 14vh, 168px)"
  skew: "-12deg"
components:
  stage: "one fixed full-viewport WebGL canvas (z 2) above backgrounds and wordmarks, below text and controls; transparent; pointer-events none"
  sachet: "parametric pillow 1 x 3.2 units, 0.2 half-thickness, crimped 0.27-unit end seals, serrated ends, tear notch top left, fin seal on the back; MeshPhysicalMaterial with clearcoat 1, foil seals (metalness 0.82) and glossy printed film (metalness 0.14); label drawn to a canvas per flavour"
  slot: "an invisible box per section that the sachet flies to; data-tilt, data-spin, data-face, data-glow and data-fill tune the pose; holds a poster image for no-WebGL"
  button-skew: "accent fill, ink text, skewX(-12deg) with the label counter-skewed, 52px tall; hover goes to foreground and lifts 2px"
  button-ghost: "same skew, 1px foreground border, translucent black fill; hover turns the border and text accent"
  hud-panel: "glass fill, 1px hud-line border, 8px accent corner brackets top-left and bottom-right, mono label left, condensed value right"
  swatch: "24px circle in the flavour colour with a matching glow; pressed state adds a black gap and a flavour ring; 44px hit area"
  flavour-row: "chip, giant condensed name, mono note, Shop link on the right; hover or focus paints a flavour gradient from the left, shifts the name 14px and swaps the sachet"
  callout: "hud-panel with a mono index line, condensed title and body; a 1.5px accent polyline runs from the panel to the matching row on the 3D label"
  timeline: "1px rail with an accent fill that grows with scroll, diamond nodes that light up, three steps"
  pack-card: "1px line-2 border, box render, condensed name, mono detail, price; checked state is accent border, 10 percent accent fill and a corner bracket"
  cart-drawer: "right drawer, 460px max, accent left border; page is inert while open; Escape, backdrop or the close button closes it and focus returns"
  toast: "skewed accent block, mono uppercase, bottom left, 2.6s"
  grain: "fixed SVG fractal noise at 7 percent, screen blend, stepped drift; hidden from reduced motion by the global override"
---

# Sahsih design system

## 1. Visual theme and atmosphere

An energy-drink launch at 2am. Near-black ground, one product dominating the screen, loud type, technical HUD details, film grain. The 3D sachet is the hero object on every screen: it revolves, leans toward the cursor, squishes when squeezed, and travels down the page to sit beside each section's content. The accent colour is whichever flavour is selected, so the whole page is pink for Berry, orange for Mango, and so on.

Dials: DESIGN_VARIANCE 8, MOTION_INTENSITY 9, VISUAL_DENSITY 4.

## 2. Colour palette and roles

The UI uses black, off-white and one accent. The accent is a CSS custom property (`--accent`) registered with `@property` so gradients and glows can interpolate when the flavour changes. It is set from `src/config.js`; never hard-code a flavour colour in CSS except in the `--f-<flavour>` tokens the script overwrites.

| Token | Value | Role |
| --- | --- | --- |
| background | #060606 | Page ground |
| foreground | #f5f5f5 | Headlines, primary text |
| foreground-2 | #c8c8ce | Body copy |
| foreground-3 | #8d8d96 | Labels, notes |
| accent | current flavour | Buttons, tags, HUD borders, wordmarks, timeline, focus rings, selection |
| ink | #060606 | Text on accent fills |
| blue | #3f6cff | Kicker light on the sachet only; never UI |

Black text on every flavour accent passes AA (lowest is Berry at 7.1:1). Off-white on black is 18:1.

## 3. Typography rules

One family, Archivo, used at two ends of its width axis: 125% for the SAHSIH wordmark, 62% for every headline. JetBrains Mono sets small uppercase labels, HUD text and tags. No third family. Headlines are uppercase, weight 900, tight leading (0.84 to 0.9). Body copy is sentence case at 16 to 17px. Numbers that change (HUD, prices, cart) use tabular figures.

Copy voice: short, dry, a bit cheeky. Full stops as rhythm. No em-dashes. Health copy names and describes ingredients; it never claims an effect. The ingredient panel stays marked "to be confirmed before launch".

## 4. Component stylings

- **Stage and slots.** The page never positions the sachet directly. Each section has a `.slot` element; the script blends between slots as you scroll and hands the stage a pose (screen centre, height, tilt, spin, face-front, glow). To put the sachet somewhere new, add a slot.
- **Buttons** are skewed parallelograms with square corners and counter-skewed labels. Primary is an accent fill; secondary is outlined. Labels never wrap.
- **HUD panels and callouts** are glass rectangles with thin accent borders and two corner brackets. Use them for facts, not for paragraphs.
- **Flavour controls** (dots, rows, chips) always change the one global flavour. There is no per-section flavour.
- **Cart** holds line items per pack and flavour, persists locally, and sends the order as an email until checkout exists.

## 5. Layout principles

Container 1440px with fluid gutters. The hero is exactly one viewport: wordmark across the middle, sachet in front, HUD and flavour dots on the right, headline cut by the fold bottom left, intro and CTAs bottom right. Science and When-to-take are pinned scenes on desktop (150% and 170% of a viewport of scroll). Flavours and Shop are two-column with a sticky slot column. The footer ends on a full-width SAHSIH wordmark the sachet lands on.

Layer order is fixed: section backgrounds and wordmarks (0 to 1), the WebGL canvas (2), text and controls (3), header (50), cart and toast (95+), grain (90). Sections must not create their own stacking contexts, or content could not sit on both sides of the canvas.

## 6. Depth and elevation

Depth comes from the 3D object, its coloured glow, the pink and blue rim lights, the out-of-focus night scene in the hero and backdrop blur on glass panels. UI elements have no drop shadows; only product renders and the sachet cast shadows or glow.

## 7. Do's and don'ts

Do:
- Keep the sachet the single hero object. Other imagery (box renders, the night scene) supports it.
- Route every colour through `--accent` or a `--f-<flavour>` token.
- Put every scroll-linked animation in GSAP ScrollTrigger inside the `gsap.matchMedia` block, and give it a reduced-motion branch.
- Clear GSAP inline styles after reveals (`clearProps`) and never put a CSS transition on a property a `from()` tween animates.
- Keep flavours, prices, packs, HUD numbers and label copy in `src/config.js`.

Don't:
- No rounded cards, no drop-shadowed UI, no gradient text, no emoji.
- No scroll event listeners; ScrollTrigger and Lenis only.
- No medical claims in copy.
- No second 3D object; the stage renders one sachet.

## 8. Responsive behaviour

Below 900px the hero stacks (sachet over the wordmark, HUD as a row of three, dots as a row, headline, intro), the nav collapses behind a Menu button, scenes stop pinning, callouts stack under the sachet, the timeline turns vertical with a sticky sachet beside it, and the shop goes single column. The WebGL stage drops antialiasing, uses a lighter mesh and caps the pixel ratio at 1.5. Touch targets are 44px minimum.

Reduced motion: no smooth scrolling, no pins, no intro animation, counters show final values, the sachet holds a still three-quarter pose and follows the page without spin or wobble.

## 9. Agent prompt guide

Quick tokens: bg #060606, fg #f5f5f5, accent var(--accent) (flavour), mono labels in JetBrains Mono uppercase, headlines Archivo 900 at 62% width uppercase, wordmark Archivo 900 at 125% width, skew -12deg, radius 0, gutter clamp(20px, 3vw, 44px).

Prompts that fit:
- "Add a section where the sachet sits on the left: a `.slot` in a sticky `.slot-col`, a `.tag`, an `.h-cond` headline, then HUD panels. Register the slot in the matchMedia block in page order."
- "Add a flavour: an entry in `CONFIG.flavours`, a `--f-<id>` token, a swatch, a flavour row and a chip, plus `assets/img/cut/stick-<id>` and `box-<id>` renders."

Check new work at 1440x900, 1280x720 and 390x844, once with reduced motion, with the playwright-cli skill. Run `npm run build` after editing anything in `src/`.
