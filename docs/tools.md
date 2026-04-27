# AI Tools — Detailed Reference

The `ai-tools/` directory contains 9 user-facing AI tools plus shared runtime.
This document is the deep-dive reference. For a high-level overview see
[../README.md](../README.md).

## CLI conventions (all 9 tools)

Every tool in `ai-tools/` accepts the same standard flags and produces a
predictable result:

| Flag | Effect |
| --- | --- |
| `--help`, `-h` | Print usage and exit 0 |
| `--json` | Emit a single machine-parseable JSON line on stdout (mid-flow logs go to stderr) |
| `--quiet`, `-q` | Suppress progress prose; reports still write to disk |

Tools that have a clear pass/fail signal exit with code **1** when the signal
is negative, so they can gate CI:

| Tool | Exits 1 when |
| --- | --- |
| `coverage-advisor` | AI score ≤ 5/10 |
| `visual-regression` | Worst viewport score ≤ 5/10 |
| `data-consistency` | Any data point inconsistent across pages |
| `persona-engine` | Any persona run fails |
| `browser-agent` | Goal could not be completed (or max steps reached) |
| `locator-healer` | No verified visible replacement found |

## Observability and caching

The shared Groq client tracks every call and writes a summary to
`.cache/run-stats.json` on process exit (calls, prompt/completion tokens,
retries, cache hits, model breakdown). Two opt-in env vars expose more:

| Env var | Effect |
| --- | --- |
| `GROQ_CACHE=1` | Cache responses on disk under `.cache/groq/<hash>.json` — great for replaying dev runs without burning quota |
| `GROQ_VERBOSE=1` | Log every retry and the final per-call token count |

---

## 1. Test Generator

Give it any URL — it writes a complete Playwright test file automatically.

```bash
npx tsx ai-tools/generate-tests.ts https://cal.com/bailey/chat
```

Output: `tests/ai-generated.spec.ts` (quarantined — runs only via `npm run test:ai-generated`)

---

## 2. Failure Analyzer

Paste in an error log — it identifies root cause and gives you the exact fix.

```bash
# Demo with built-in sample error
npx tsx ai-tools/analyze-failure.ts

# Analyse a real error log
npx tsx ai-tools/analyze-failure.ts path/to/error.log
```

**Example output:**

```text
ROOT CAUSE: getByText('Chat') resolved to 2 elements due to Playwright strict
mode — both the visible <h1> and the hidden <title> tag matched.

FIX: Scope the selector to the known container:
  page.getByTestId('event-title')

PREVENTION: Always scope getByText() to a specific container when the text
appears in both visible elements and metadata tags.
```

---

## 3. Coverage Advisor

Reviews a test file, scores it out of 10, and writes the top 3 missing tests.

```bash
# Analyse main test suite
npx tsx ai-tools/coverage-advisor.ts

# Analyse any test file
npx tsx ai-tools/coverage-advisor.ts tests/examples/cal-com/booking-flow.spec.ts
```

Output: printed to terminal + saved to `runs/reports/coverage-<spec>-report.md`

---

## 4. Autonomous Browser Agent

Give it a plain English goal — it navigates the application independently,
makes decisions in real time, self-corrects when actions fail, and produces
a structured report.

```bash
# Default goal
npx tsx ai-tools/browser-agent.ts

# Custom goal and URL
npx tsx ai-tools/browser-agent.ts "Verify a user can select a time slot" https://cal.com/bailey/chat
```

**How it works:**

1. Captures page content and all interactive elements
2. Sends current state to LLM — asks "what should I do next?"
3. Executes the action (click, navigate, fill, scroll)
4. Self-corrects if the action fails using fallback strategies
5. Repeats until goal is achieved or max steps reached
6. Saves screenshots at each step + final report to `runs/reports/agent-report.md`

**Real finding from a test run:**
> The agent successfully navigated from `cal.com/bailey` to the booking
> calendar, selected March 20, and confirmed time slots were visible —
> completing the full user journey autonomously in 8 steps.

---

## 5. Synthetic Persona Engine

Generates edge case user personas using AI and runs each one through the
booking flow — testing timezone extremes, locale differences, long names,
special characters, mobile viewports, and more.

```bash
npx tsx ai-tools/persona-engine.ts
```

**Example personas generated:**

| Persona | Edge Case | Risk |
| --- | --- | --- |
| Élodie François-Savignac | UTC+14 timezone handling | HIGH |
| Dr. John "JD" Dōe Jr. | Same-day booking across UTC-12 | MEDIUM |
| verylongnamethatwill... | Extremely long display name | LOW |
| हेमंत कुमार | Non-ASCII characters in name | MEDIUM |
| Anaïs Dupont | Back/forth navigation before booking | MEDIUM |
| Sofia Jensen | Booking dates more than a year ahead | LOW |

The engine distinguishes between **technical failures** (broken functionality)
and **UX friction points** (conversion risks and usability issues) — giving
both engineering and product teams actionable output.

Output: `runs/reports/persona-report.md` + screenshots in `persona-screenshots/`

---

## 6. Visual Regression (AI Vision)

Captures screenshots across desktop, tablet, and mobile viewports and sends
each to an AI vision model for UX analysis — detecting layout issues, missing
CTAs, and conversion risks that code-based tests cannot see.

```bash
# Default URL
npx tsx ai-tools/visual-regression.ts

# Custom URL
npx tsx ai-tools/visual-regression.ts https://cal.com/bailey/chat
```

**Real findings from a test run:**

| Viewport | Score | Key Finding |
| --- | --- | --- |
| Desktop 1280×720 | 7/10 | Left sidebar partially cut off — booking details not fully visible |
| Tablet 768×1024 | 8/10 | "Book/Confirm" button not visible — user doesn't know how to proceed |
| Mobile 375×812 | 7/10 | Time slots only visible after scrolling + timezone selector cut off |

Output: `runs/reports/visual-regression-report.md` + screenshots in `visual-regression/`

---

## 7. Data Consistency Checker

Verifies that key data points — host name, event duration, meeting platform,
price — are consistent across all pages of the marketplace. Catches the class
of bug where a value shown on a search or profile page differs from what
appears at checkout or on the booking page.

```bash
npx tsx ai-tools/data-consistency.ts
```

**Why this matters for marketplaces:**

In a C2C platform, data inconsistency between pages is a trust and conversion issue:

- Price shown on search ≠ price at checkout → user feels deceived, abandons booking
- Availability on profile ≠ availability in calendar → double bookings, support tickets
- Rating on listing ≠ rating on profile → erodes trust in the platform

Output: `runs/reports/data-consistency-report.md`

---

## 8. CDP Inspector

Opens a direct Chrome DevTools Protocol (CDP) session on any page — capturing
all network requests, API calls, console warnings, and JavaScript exceptions
at the browser protocol level. Sends findings to AI for analysis.

```bash
# Default URL
npx tsx ai-tools/cdp-inspector.ts

# Custom URL
npx tsx ai-tools/cdp-inspector.ts https://cal.com/bailey/chat
```

**Real findings from a test run against cal.com:**

- 75 network requests captured on a single booking page load
- 8 API/tRPC calls identified including `slots/getSchedule`
- 2 requests intercepted via `Fetch.enable` CDP domain — `auth/session` and `slots/getSchedule`
- `slots/getSchedule` mocked with empty response to test UI resilience under no-availability condition
- Zustand deprecation warning detected — `create` should be `createWithEqualityFn`
- i18next configuration warning — internationalization may not function correctly
  across all locales (corroborated by persona engine French locale finding)

> **Why this matters:** These findings are invisible to standard Playwright tests.
> CDP exposes what's happening at the browser protocol level — enabling not just
> passive observation of network traffic, but active interception and mocking of
> API responses without touching application code.

Output: `runs/reports/cdp-report.md`

---

## 9. AI Locator Healer

Takes a broken selector or Playwright error log, snapshots the live DOM,
asks the LLM for 5 ranked replacement strategies, verifies each live in a
real browser, and reports the best working alternative.

```bash
# Demo with built-in broken selector
npm run heal-locator

# Heal a specific broken selector
npm run heal-locator -- "getByTestId('old-id')"

# Pass a full Playwright error log
npm run heal-locator -- path/to/error.log https://myapp.com
```

**How it works:**

1. Extracts the broken selector from the input (or parses it from an error log)
2. Launches a Playwright browser, navigates to the target URL
3. Captures a DOM context snapshot (IDs, roles, test IDs, headings, visible text)
4. Sends the broken selector + DOM context to the LLM for 5 ranked suggestions
5. Verifies each suggestion live — checks visibility and elementCount
6. Returns the best verified replacement and its confidence score

**Real demo output — healing `getByTestId('event-title')`:**

```text
┌─┬─────────────────────────────────────────────────┬────────┬──────────┐
│ │ Locator                                         │ Conf.  │ Verified │
├─┼─────────────────────────────────────────────────┼────────┼──────────┤
│1│ page.getByRole('heading', { name: 'Chat' })     │ 95%    │ ✅       │
│2│ page.locator('h1')                              │ 85%    │ ✅       │
│3│ page.locator('[data-testid="event-title"]')     │ 75%    │ ✅       │
│4│ page.getByText('Chat', { exact: true })         │ 65%    │ ❌       │
│5│ page.locator('.event-title')                    │ 55%    │ ❌       │
└─┴─────────────────────────────────────────────────┴────────┴──────────┘

✅ Best replacement: page.getByRole('heading', { name: 'Chat' })
```

Output: `runs/reports/locator-healer-report.md`

---

## MCP Integration

The toolkit exposes all tools as a standard MCP server, making them callable
from any MCP-compatible client — Claude Code, Cursor, or any open-source
LLM orchestrator.

### Start the server

```bash
npx tsx mcp-server.ts
```

### Available MCP Tools

| Tool | Description |
| --- | --- |
| `analyze_failure` | Analyzes a Playwright error log and returns root cause + fix |
| `advise_coverage` | Scores a test file and writes missing tests |
| `generate_tests` | Generates a full test file for any URL |
| `visual_regression` | AI vision analysis across desktop and mobile viewports |
| `data_consistency` | Checks data consistency across marketplace pages |
| `heal_locator` | Heals a broken locator and returns ranked verified replacements |

### Connect to Claude Code

Copy `mcp-config.json` to your Claude Code configuration directory and your
QA toolkit becomes available as native tools in the terminal.

### Connect to Cursor

Add the contents of `mcp-config.json` to Cursor's MCP settings under
Settings → MCP Servers.

---

## Playwright MCP Integration

Demonstrates the official `@playwright/mcp` server — the same protocol
Claude Code uses to control browsers in agentic workflows. An LLM connects
to the MCP server, receives an accessibility snapshot of the page, and
controls the browser using element reference IDs rather than CSS selectors.

```bash
npx tsx mcp-playwright-demo.ts
```

**How it works:**

1. Starts the official `@playwright/mcp` server (22 browser control tools)
2. Initializes a JSON-RPC 2.0 MCP connection
3. Calls `browser_navigate` to open the target URL
4. Calls `browser_snapshot` to capture the accessibility tree
5. Sends the snapshot to an LLM for analysis
6. LLM proposes the next action using MCP element reference IDs

**Why this matters:**

This is the difference between *writing Playwright scripts* and *using
Playwright as an MCP server*. The LLM reasons about the accessibility tree
and controls the browser dynamically.

Output: `runs/reports/playwright-mcp-report.md`
