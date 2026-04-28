# Changelog

All notable changes to the AI-Native QA Toolkit are recorded here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this
project loosely follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Integration test layer under [tests-unit/integration/](tests-unit/integration)
  that drives the LLM-orchestration tools end-to-end against an in-process
  static HTML fixture with `groq-client` stubbed via `vi.mock`. Lifts
  confidence on browser launch, DOM extraction, suggestion verification,
  and report persistence without flakiness or API spend. Two tools covered:
  - `locator-healer` (browser archetype): mocks `groqChat`, serves a static
    page on a random `127.0.0.1` port, asserts the JSON envelope and the
    saved markdown report. Exercises both the happy path and the
    no-visible-suggestion `process.exit(1)` branch.
  - `coverage-advisor` (file-I/O archetype): mocks `groqChatJSON` (with a
    Zod schema), reads a self-contained spec fixture, asserts the JSON
    envelope, the persisted report shape, and the score≤5 exit branch.
  - Orchestrators `healLocator` and `adviseCoverage` are now exported
    (previously private to their CLI entry points) so integration tests
    can drive them directly.
- ESLint enforcement of the **toolkit-core target-agnostic invariant**:
  `no-restricted-imports` rule scoped to `ai-tools/**` blocks any import
  from `tests/examples/**`, with a message pointing to
  [docs/architecture.md](docs/architecture.md). Backed by a programmatic
  regression test in [tests-unit/eslint-invariants.test.ts](tests-unit/eslint-invariants.test.ts)
  so the rule itself can't be silently weakened.
- Second example target pack: [tests/examples/wikipedia/](tests/examples/wikipedia)
  — a non-scheduling target with no `data-testid` scaffold, used to validate
  that the target-pack abstraction is genuinely target-shape-agnostic.
  Includes `target.ts`, `selectors.json` (intentionally empty), `qa-checks.json`
  (desktop ↔ mobile render consistency), `pages/ArticlePage.ts` POM with
  semantic locators, and a 4-test cross-browser spec. Live-validated against
  Chromium, Firefox, and WebKit.
- `CHANGELOG.md` — this file.
- `docs/tools.md` — extracted detailed reference for the 9 AI tools and MCP integrations.
- `docs/architecture.md` — extracted engineering philosophy and key engineering decisions.

### Changed

- All GitHub Actions are now SHA-pinned (`actions/checkout`, `actions/setup-node`,
  `actions/cache`, `actions/upload-artifact`, `github/codeql-action`, `gitleaks/gitleaks-action`)
  to remove the floating-tag supply-chain risk. Comment markers preserve the
  human-readable version next to each pin.
- README split into a compact overview + linked deep-dive docs (798 → ~400 lines).

### Removed

- `docs/cal-com-qa-audit.md` — stale reference document that predated the
  cal.com decoupling and no longer reflected the toolkit's architecture.

## [0.3.0] — 2026-04

### Added

- Per-tool unit tests for the previously untested AI tools: `analyze-failure`,
  `cdp-inspector`, `coverage-advisor`, `data-consistency`, `generate-tests`,
  `locator-healer`, `persona-engine`, `visual-regression`. +52 tests across
  8 new test files. Total: 130 tests across 17 files.
- Vitest coverage scope expanded to all 15 `ai-tools/` modules with thresholds
  enforced (lines 20, statements 20, functions 30, branches 75).

### Changed

- Pure helpers extracted and exported from each tool to enable unit testing
  without touching browser or LLM code paths.

## [0.2.0] — 2026-04

### Changed

- **Toolkit decoupled from cal.com.** Cal.com-specific configuration moved to
  `tests/examples/cal-com/` as a self-contained target pack
  (`target.ts`, `selectors.json`, `roles.json`, `qa-checks.json`, POM, specs).
- `ai-tools/selectors.ts` now exposes a `Partial` map loaded from an overlay
  file rather than hard-coding cal.com testids.
- `ai-tools/checks-config.ts` API: removed `defaultChecks()`, added
  `LoadChecksOptions { fallback, fallbackLabel }` for path-based fallback.
- `ai-tools/data-consistency.ts`, `discover-selectors.ts`, `persona-engine.ts`,
  `locator-healer.ts`, `browser-agent.ts`: all scheduling-specific code paths
  guarded with `if (SELECTORS.X)` so non-scheduling targets no-op cleanly.
- Architectural invariant: toolkit core (`ai-tools/`) MUST NOT import from
  `tests/examples/`.

### Added

- `tests/examples/generic/` drop-in template (homepage smoke + a11y) for any
  target.

## [0.1.x] — 2026-04 (earlier)

### Fixed

- Dependabot ERESOLVE failures by grouping `@vitest/*` packages in the
  `dev-tooling` update group.
- Firefox accessibility test timeout: replaced per-element loops over 88
  images with a single `page.evaluate()` call.
