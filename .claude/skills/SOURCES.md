# Skill sources

Project skills under `.claude/skills/` are auto-discovered by Claude Code (and other agents that read `SKILL.md` files). Most are vendored verbatim from upstream so they can be refreshed with a single `curl`; the ones written for this repo are marked as such.

| Folder | Install name | Origin | License | Vendored on |
|---|---|---|---|---|
| `design-taste-frontend/` | `design-taste-frontend` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) `skills/taste-skill/SKILL.md` (v2, the default at [tasteskill.dev](https://www.tasteskill.dev/)) | MIT | 2026-09-27 |
| `web-design-guidelines/` | `web-design-guidelines` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) `skills/web-design-guidelines/SKILL.md`; `references/web-interface-guidelines.md` is a snapshot of [vercel-labs/web-interface-guidelines](https://github.com/vercel-labs/web-interface-guidelines) `command.md` | MIT | 2026-09-27 |
| `image-to-code/` | `image-to-code` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) `skills/image-to-code-skill/SKILL.md` | MIT | 2026-09-27 |
| `design-md/` | `design-md` | Written for this repo. Method and section layout follow [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) and the Google Stitch DESIGN.md spec. Expects a `DESIGN.md` at the repo root and explains how to create one if missing. | MIT (this repo) | 2026-09-27 |
| `playwright-cli/` | `playwright-cli` | [microsoft/playwright-cli](https://github.com/microsoft/playwright-cli) `skills/playwright-cli/` (identical to the copy shipped inside `@playwright/cli@0.1.21`) | Apache-2.0 | 2026-09-27 |

## Refreshing

```bash
cd .claude/skills
RAW=https://raw.githubusercontent.com
curl -sSL $RAW/Leonxlnx/taste-skill/main/skills/taste-skill/SKILL.md            -o design-taste-frontend/SKILL.md
curl -sSL $RAW/Leonxlnx/taste-skill/main/skills/image-to-code-skill/SKILL.md    -o image-to-code/SKILL.md
curl -sSL $RAW/vercel-labs/agent-skills/main/skills/web-design-guidelines/SKILL.md -o web-design-guidelines/SKILL.md
curl -sSL $RAW/vercel-labs/web-interface-guidelines/main/command.md            -o web-design-guidelines/references/web-interface-guidelines.md
curl -sSL $RAW/microsoft/playwright-cli/main/skills/playwright-cli/SKILL.md     -o playwright-cli/SKILL.md
for r in element-attributes playwright-tests pr-attachments request-mocking running-code session-management storage-state test-generation tracing video-recording; do
  curl -sSL $RAW/microsoft/playwright-cli/main/skills/playwright-cli/references/$r.md -o playwright-cli/references/$r.md
done
```

After refreshing `web-design-guidelines/SKILL.md`, re-append the "Local fallback" note at the bottom of that file (it is the only local edit to an upstream file).

The same skills can also be installed globally with the upstream CLIs:

```bash
npx skills add https://github.com/Leonxlnx/taste-skill --skill design-taste-frontend
npx skills add https://github.com/Leonxlnx/taste-skill --skill image-to-code
npx skills add https://github.com/vercel-labs/agent-skills --skill web-design-guidelines
npx playwright-cli install --skills
```
