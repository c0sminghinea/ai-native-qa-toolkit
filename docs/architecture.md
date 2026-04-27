# Architecture & Engineering Decisions

Companion to [../README.md](../README.md). This document covers the
engineering philosophy behind the toolkit and the rationale for key technical
choices.

## High Performance, Zero Waste

The toolkit runs entirely on free tier APIs and open-source models:

| Component | Tool | Cost |
| --- | --- | --- |
| LLM Inference | Groq (llama-3.3-70b-versatile) | Free tier |
| Vision Analysis | Groq (llama-4-scout-17b) | Free tier |
| Browser Automation | Playwright | Open source |
| MCP Orchestration | @modelcontextprotocol/sdk | Open source |
| Test Runner | Playwright | Open source |
| Playwright MCP | @playwright/mcp | Open source |

The AI-first approach means zero onboarding time on new codebases — the
toolkit reads, maps, and tests any repository autonomously from day one.

---

## Architectural Invariants

These invariants are enforced via review and CI:

1. **Toolkit core is target-agnostic.** Modules under `ai-tools/` MUST NOT
   import from `tests/examples/`. Target-specific configuration is loaded at
   runtime from path-based fallback files.
2. **Pure helpers are exported and tested.** Every tool extracts its prompt
   builders, parsers, classifiers, and validators into pure functions covered
   by `tests-unit/`. Browser and LLM tails stay uncovered by design.
3. **Coverage is honest.** Vitest scope is `ai-tools/**` only; thresholds are
   set just below current actuals to prevent regression without inflating
   the signal with glue code.

---

## Resilient Locator Pattern

Locators chain multiple strategies with `.or()` so tests survive minor UI
refactors without touching a single line of test code:

```typescript
// BookingPage.ts — POM getter with primary + fallback strategies
get firstAvailableDay() {
  return this.page
    .locator('td[data-testid*="day-"][aria-disabled="false"]')
    .or(this.page.locator('button[data-testid*="day-"]:not([disabled])'))
    .first();
}
```

For broken selectors that can't be fixed by inspection alone, the
[AI Locator Healer](tools.md#9-ai-locator-healer) snapshots the live DOM and
returns 5 ranked verified replacements in seconds.

## Strict Mode Violation Fix

`getByText()` matches both visible elements and hidden `<title>` tags, causing
Playwright strict mode failures. Fix: always scope to a container.

```typescript
// ❌ Fails — matches <h1> and <title>
page.getByText('Chat')

// ✅ Works — scoped to visible container
page.getByTestId('event-title')
```

## Autonomous Agent DOM Extraction

Static `innerText` gives the agent no actionable information. The agent extracts
all interactive elements with their text, href, and data-testid attributes:

```typescript
const interactive = Array.from(
  document.querySelectorAll('a, button, [role="button"]')
).map(el => `[${el.tagName}] text="${el.innerText}" href="${el.href}"
  data-testid="${el.getAttribute('data-testid')}"`);
```

## Playwright Trace Viewer Integration

Every test run captures a full trace — timeline, screenshots at each step,
network requests, and console logs:

```bash
npx playwright show-report
```
