---
name: design-md
description: Build or extend UI that stays visually consistent with a DESIGN.md design-system file (the Google Stitch format popularised by VoltAgent's awesome-design-md). Use when asked to "follow DESIGN.md", "match our design system", "make it look like <brand>", "use the design tokens", "add a section in our style", or when generating any new page, section, or component for a site.
---

# DESIGN.md as the design source of truth

A `DESIGN.md` is a plain-text design system an agent reads before generating UI: YAML front matter with tokens (colors, typography, rounded, spacing, components) followed by markdown sections describing theme, layout, depth, do's and don'ts, responsive rules, and an agent prompt guide.

Look for **`DESIGN.md` at the repository root**. If the repo has one, it is the source of truth for every visual decision. If it does not, create one first (see "Writing or updating a DESIGN.md" below) by extracting the real values from the site's CSS, then build against it.

## Workflow

1. **Read `DESIGN.md` first.** Load the whole file before writing any markup or CSS for the site. Treat the tokens as fixed values, not suggestions.
2. **Map every visual decision to a token.** Colors, font families, sizes, radii, paddings, and shadows must come from the front matter. If a value you need is missing, add it to `DESIGN.md` (with a role name) in the same change rather than hard-coding a one-off.
3. **Reuse component recipes.** New UI should be composed from the `components:` entries (button-primary, glass-card, eyebrow-label, stat-tile, and so on). Only invent a new component when none fits, and then document it in `DESIGN.md`.
4. **Obey the Do's and Don'ts section literally.** They encode the brand's guardrails (for example: one accent element per viewport, no cards inside cards, a fixed set of font families). Do not reinterpret them.
5. **Check responsive rules.** Apply the breakpoints and collapsing strategy from section 8 before calling the work done.
6. **Verify visually.** Serve the site and take a screenshot with the `playwright-cli` skill; compare against the existing sections for spacing, type scale, and color drift.

## Using another brand's DESIGN.md

VoltAgent's collection has 70+ extracted design systems (Vercel, Linear, Apple, Nike, Starbucks, Airbnb, and more). Each lives at:

```
https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md/<site>/DESIGN.md
```

Examples: `design-md/vercel/DESIGN.md`, `design-md/linear.app/DESIGN.md`, `design-md/apple/DESIGN.md`, `design-md/starbucks/DESIGN.md`, `design-md/nike/DESIGN.md`. The index of sites is in that repo's README.

When the user asks for a page "in the style of <brand>":
1. Fetch that site's `DESIGN.md` (WebFetch or `curl` to the raw URL above).
2. Use it only as a reference for structure, density, and component patterns.
3. Keep this project's own tokens (colors, fonts) unless the user explicitly wants the other brand's look. Never ship another company's palette or typography as this brand's.

## Writing or updating a DESIGN.md

Follow the section order used by the collection so other agents can parse it:

| # | Section | What it captures |
|---|---------|-----------------|
| 1 | Visual Theme & Atmosphere | Mood, density, design philosophy |
| 2 | Color Palette & Roles | Semantic name + value + functional role |
| 3 | Typography Rules | Font families, full hierarchy |
| 4 | Component Stylings | Buttons, cards, inputs, navigation with states |
| 5 | Layout Principles | Spacing scale, grid, whitespace philosophy |
| 6 | Depth & Elevation | Shadow system, surface hierarchy |
| 7 | Do's and Don'ts | Guardrails and anti-patterns |
| 8 | Responsive Behavior | Breakpoints, touch targets, collapsing strategy |
| 9 | Agent Prompt Guide | Quick token reference, ready-to-use prompts |

Front matter keys: `version`, `name`, `description`, `colors`, `typography`, `rounded`, `spacing`, `components` (component values may reference tokens with `{colors.primary}` style placeholders). Extract values from the real CSS, not from memory.

## Pairing with the other design skills

- `design-taste-frontend` decides the art direction and layout variance for new pages. `DESIGN.md` supplies the tokens it must use.
- `image-to-code` generates reference images first; feed it the Agent Prompt Guide from `DESIGN.md` so the renders already use the right palette and type.
- `web-design-guidelines` reviews the result for accessibility and interaction quality after the visuals match.
