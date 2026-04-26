# Contributing

Thanks for considering a contribution. This project ships a real testing toolkit, so the bar is "would I run this in CI tomorrow?"

## Local setup

```bash
git clone <your fork>
cd qa-playwright
npm ci
npx playwright install --with-deps
cp .env.example .env   # add GROQ_API_KEY if you'll exercise AI tools
```

## The merge bar

Every PR must clear, locally and in CI:

```bash
npm run typecheck            # strict TS
npm run lint                 # eslint flat config
npm run format:check         # prettier
npm run check:secrets        # repo-wide regex scan
npm run check:docs           # README drift checker
npm run test:unit:coverage   # vitest + coverage gate
npx playwright test          # e2e (chromium/firefox/webkit)
```

The full pipeline runs on every push — see [.github/workflows/playwright.yml](.github/workflows/playwright.yml).

## Workflow

1. **Branch** off `main` with a short, intent-bearing name (`fix/locator-healer-flake`, `feat/coverage-advisor-json`).
2. **Commit** in small, reviewable units. Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`) is preferred.
3. **Test** — add or extend a unit test in [tests-unit/](tests-unit/) for any logic change. New AI tools must have at least smoke coverage of their CLI surface.
4. **Document** — if you add an `npm run` script or a new tool entry point, update [README.md](README.md). The drift checker will fail the PR otherwise.
5. **PR** — fill in the template, link related issues, and let CI run. Don't bypass `husky` hooks (`--no-verify`) on shared branches.

## Coverage policy

Unit-test coverage is gated in [vitest.config.ts](vitest.config.ts). Floors are set just below the current actuals so the gate fails on regressions. **You may raise floors, never lower them.** When you add tests for a new module, include it under `coverage.include` in the same PR.

## Test layout

The `tests/` tree is organised by intent:

- `tests/toolkit/` — verifies the toolkit itself (CLI/MCP smoke). Runs offline.
- `tests/examples/generic/` — target-agnostic specs (homepage smoke, a11y basics) you can keep verbatim against any site.
- `tests/examples/cal-com/` — the bundled live-target demo. Re-point at your own app by editing [ai-tools/selectors.ts](ai-tools/selectors.ts) or running `npm run discover` against your URL, then mirror the spec under `tests/examples/<your-app>/`.
- `tests/ai-generated.spec.ts` (gitignored) — quarantined output of `generate-tests`. Runs only in the `ai-quarantine` Playwright project on its own nightly cadence ([.github/workflows/ai-quarantine.yml](.github/workflows/ai-quarantine.yml)). **Do not** add `RUN_AI_GENERATED=1` to the main e2e job.

New page objects must source selector strings from `SELECTORS` (in [ai-tools/selectors.ts](ai-tools/selectors.ts)) rather than hardcoding `data-testid` literals — that's what makes `selectors.json` overrides work.

## Secrets

Never commit secrets. Three layers protect the repo:

- A regex scanner in pre-commit ([scripts/check-secrets.ts](scripts/check-secrets.ts)).
- Optional gitleaks scan in pre-commit if installed locally (`brew install gitleaks`).
- gitleaks-action in CI on every push.

If you find a leak in history, see [SECURITY.md](SECURITY.md).

## Reporting bugs

Open a GitHub issue with:

- exact `npm run …` command,
- relevant excerpt from `runs/<timestamp>.json` (telemetry),
- the generated `runs/reports/*.md` if applicable.

## Code style

- TypeScript strict mode is non-negotiable.
- Prefer composition over inheritance; tools share helpers via [ai-tools/tool-utils.ts](ai-tools/tool-utils.ts).
- One CLI entry point per tool, JSON output behind `--json`.
- New target apps go through [ai-tools/selectors.ts](ai-tools/selectors.ts), not scattered string literals.
