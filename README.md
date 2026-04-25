# AI-Native QA Toolkit

An autonomous, AI-powered QA ecosystem built on top of Playwright. Goes beyond static
test scripts — uses LLM inference to generate tests, diagnose failures, audit coverage,
browse autonomously, stress-test with synthetic personas, and analyze visual UX across viewports.

Built against the cal.com open-source scheduling platform as a real-world target.

---

## Architecture

```text
                        ┌─────────────────────────┐
                        │   AI-Native QA Toolkit  │
                        └────────────┬────────────┘
                                     │
          ┌──────────────────────────┼──────────────────────────┐
          │                          │                          │
   ┌──────▼──────┐          ┌────────▼────────┐         ┌───────▼───────┐
   │  AI Tools   │          │  Playwright E2E │         │  Autonomous   │
   │  (9 tools)  │          │  Test Suite     │         │  Agent        │
   └──────┬──────┘          └────────┬────────┘         └───────┬───────┘
          │                          │                          │
   ┌──────▼──────────────────────────▼──────────────────────────▼───────┐
   │                         Groq LLM API                               │
   │              (llama-3.3-70b-versatile + llama-4-scout vision)      │
   └────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```text
qa-playwright/
  ai-tools/
    generate-tests.ts       # Generate Playwright tests from any URL
    analyze-failure.ts      # Diagnose test failures and get exact fixes
    coverage-advisor.ts     # Score coverage and generate missing tests
    browser-agent.ts        # Autonomous agent that navigates and tests independently
    persona-engine.ts       # Synthetic persona engine for edge case testing
    visual-regression.ts    # AI vision analysis across desktop, tablet, and mobile
    data-consistency.ts     # Verify data integrity across marketplace pages
    cdp-inspector.ts        # Browser protocol debugging via CDP session
    locator-healer.ts       # AI-powered broken locator healing
    groq-client.ts          # Shared Groq client (LLM + vision) with retry backoff
    tool-utils.ts           # Shared utilities: sleep, saveReport, parseAIJson, constants
  docs/
    cal-com-qa-audit.md     # Full QA audit of cal.com codebase
  tests/
    pages/
      BookingPage.ts        # Page Object Model for cal.com booking page
    booking-flow.spec.ts    # Main E2E test suite (cross-browser)
    ai-generated.spec.ts    # Output of generate-tests tool
  visual-regression/        # Screenshots from visual regression runs
  persona-screenshots/      # Screenshots from persona engine runs
  agent-screenshots/        # Screenshots from autonomous agent runs
  # Generated reports (*-report.md) are gitignored — created by each tool run
  .env.example                 # Environment variable template
  .github/workflows/playwright.yml  # CI — runs tests on every push/PR
  eslint.config.mjs            # ESLint flat config with TypeScript rules
  mcp-server.ts                # MCP server exposing all tools to LLM clients
  mcp-config.json              # MCP client configuration for Claude Code/Cursor
  mcp-playwright-demo.ts       # Official @playwright/mcp server demo — LLM-controlled browser
  cli.ts                       # Unified CLI — run all tools with: npx tsx cli.ts <command>
```

---

## E2E Test Suite

Cross-browser tests covering the cal.com public booking flow across Chromium,
Firefox, and WebKit — 24 tests (8 per browser × 3 browsers), all passing.

### Features

- **Page Object Model** — interactions encapsulated in `BookingPage.ts`
- **Resilient locators** — `.or()` chaining prevents brittle tests across browser engines
- **Cross-browser** — Chromium, Firefox, WebKit
- **Mobile viewport** — responsive design validated at 375×812 (iPhone X)
- **Trace Viewer** — traces captured on first retry and retained on failure

### Run tests

```bash
# All browsers
npx playwright test

# Single browser
npm run test:chromium
npm run test:firefox
npm run test:webkit

# AI-generated tests only (Chromium)
npm run test:ai-generated

# Specific file
npx playwright test tests/booking-flow.spec.ts

# Headed mode (watch the browser)
npx playwright test --headed

# Open trace viewer after run
npx playwright show-report
```

---

## AI Tools

### 1. Test Generator

Give it any URL — it writes a complete Playwright test file automatically.

```bash
npx tsx ai-tools/generate-tests.ts https://cal.com/bailey/chat
```

Output: `tests/ai-generated.spec.ts`

---

### 2. Failure Analyzer

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

### 3. Coverage Advisor

Reviews a test file, scores it out of 10, and writes the top 3 missing tests.

```bash
# Analyse main test suite
npx tsx ai-tools/coverage-advisor.ts

# Analyse any test file
npx tsx ai-tools/coverage-advisor.ts tests/ai-generated.spec.ts
```

Output: printed to terminal + saved to `coverage-report.md`

---

### 4. Autonomous Browser Agent

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
6. Saves screenshots at each step + final report to `agent-report.md`

**Real finding from a test run:**
> The agent successfully navigated from `cal.com/bailey` to the booking
> calendar, selected March 20, and confirmed time slots were visible —
> completing the full user journey autonomously in 8 steps.

---

### 5. Synthetic Persona Engine

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

**Real UX findings from a test run:**

> **Conversion risk:** Time slot buttons were below the fold during back/forth
> navigation testing — user must scroll to complete booking.
> **Timezone confusion:** UTC+14 persona saw timezone displayed as Pacific/Apia
> instead of Pacific/Kiritimati — could cause incorrect meeting scheduling.
> **Navigation gap:** No way to jump to a future date — users scheduling more
> than a year ahead must click through months one by one.
> **Missing CTA clarity:** No visible "Book Now" button on certain viewports —
> user may not know how to proceed after selecting a time slot.

The engine distinguishes between **technical failures** (broken functionality)
and **UX friction points** (conversion risks and usability issues) — giving
both engineering and product teams actionable output.

Output: `persona-report.md` + screenshots in `persona-screenshots/`

---

### 6. Visual Regression (AI Vision)

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

Output: `visual-regression-report.md` + screenshots in `visual-regression/`

---

### 7. Data Consistency Checker

Verifies that key data points — host name, event duration, meeting platform,
price — are consistent across all pages of the marketplace. Catches the class
of bug where a value shown on a search or profile page differs from what
appears at checkout or on the booking page.

```bash
npx tsx ai-tools/data-consistency.ts
```

**Real findings from a test run against cal.com:**

| Data Point | Profile Page | Event Page | Status |
| --- | --- | --- | --- |
| Host name | NOT FOUND | NOT FOUND | ❌ Needs prompt tuning |
| Event duration | `15m \| 30m` | `15m` | ❌ Inconsistent |
| Meeting platform | NOT FOUND | `Google Meet` | ✅ Consistent |

> **Key finding:** Event duration appears as `15m | 30m` on the profile page
> (multiple events listed) but as `15m` on the specific event page — a
> legitimate difference, but one that would flag a real bug if the values
> were contradictory rather than contextual.

**Why this matters for marketplaces:**

In a C2C platform, data inconsistency between pages is a trust and conversion issue:

- Price shown on search ≠ price at checkout → user feels deceived, abandons booking
- Availability on profile ≠ availability in calendar → double bookings, support tickets
- Rating on listing ≠ rating on profile → erodes trust in the platform

Output: `data-consistency-report.md`

---

### 8. CDP Inspector

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
- `markdownToSafeHTML` client-side import warning — potential security concern

> **Why this matters:** These findings are invisible to standard Playwright tests.
> CDP exposes what's happening at the browser protocol level — enabling not just
> passive observation of network traffic, but active interception and mocking of
> API responses without touching application code. This is how you test edge cases
> like "what happens when the slots API returns empty?" in a real browser context.

Output: `cdp-report.md`

---

### 9. AI Locator Healer

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

**Why this matters:**

When a `data-testid` gets renamed or removed during a UI refactor, finding
replacement selectors by hand means opening DevTools, inspecting the DOM, and
trial-and-erroring. The healer automates this in seconds — it snapshots the
live DOM, reasons about the element's semantic role, and verifies the candidate
works before reporting it.

Output: `locator-healer-report.md`

---

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
QA toolkit becomes available as native tools in the terminal:

```text
> analyze this playwright error: [paste error]
> generate tests for https://example.com
> check visual regression on https://example.com
> check data consistency on https://example.com
```

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

**Real session output:**

> The MCP server exposed 22 tools including `browser_navigate`,
> `browser_snapshot`, `browser_click`, `browser_fill_form`, and
> `browser_evaluate`. After navigating to cal.com/bailey/chat and capturing
> the accessibility snapshot, the AI identified the "View next month" button
> by its MCP reference ID (`ref=e49`) and proposed clicking it to verify
> calendar navigation — without any hardcoded selectors.

**Why this matters:**

This is the difference between *writing Playwright scripts* and *using
Playwright as an MCP server*. The LLM reasons about the accessibility tree
and controls the browser dynamically — the same architecture Holidog likely
uses with their internal AI-based QA tooling.

Output: `playwright-mcp-report.md`

---

## CLI

All tools are accessible through a single unified command:

```bash
npx tsx cli.ts <command> [options]
```

| Command | What it does |
| --- | --- |
| `generate <url>` | Generate Playwright tests from a URL |
| `analyze` | Analyze a test failure and get a fix |
| `coverage` | Score test coverage and get missing tests |
| `visual <url>` | AI vision analysis across viewports |
| `agent <goal> <url>` | Autonomous browser agent |
| `personas` | Synthetic persona engine |
| `consistency` | Data consistency checker |
| `cdp <url>` | CDP browser protocol inspector |
| `heal [selector] [url]` | Heal a broken locator with AI suggestions |
| `mcp <url>` | Playwright MCP server demo |
| `test` | Run the full Playwright test suite |
| `report` | Open the Playwright trace viewer |

```bash
# Examples
npx tsx cli.ts generate https://cal.com/bailey/chat
npx tsx cli.ts visual https://cal.com/bailey/chat
npx tsx cli.ts agent "verify booking flow" https://cal.com/bailey/chat
npx tsx cli.ts heal "getByTestId('old-id')" https://cal.com/bailey/chat
npx tsx cli.ts test
```

## Setup

### Prerequisites

- Node.js v18+
- A Groq API key — free at [console.groq.com](https://console.groq.com)

### Install

```bash
npm install
npx playwright install
```

### Configure

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

```env
GROQ_API_KEY=your_key_here       # Required — get it free from console.groq.com
BASE_URL=https://cal.com         # Optional — target base URL (default: https://cal.com)
HOST_NAME=Bailey Pumfleet        # Optional — expected host name in assertions
BOOKING_PATH=/bailey/chat        # Optional — booking page path (default: /bailey/chat)
```

---

## CI

A GitHub Actions workflow runs the full test suite on every push and pull request:

```yaml
# .github/workflows/playwright.yml
# Triggers: push/PR to main and develop
# Steps: install deps → install browsers → run tests → upload report
```

Test reports and traces are uploaded as artifacts under the `playwright-report` artifact name.

---

## Engineering Philosophy: High Performance, Zero Waste

This toolkit runs entirely on free tier APIs and open-source models:

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

## Key Engineering Decisions

### Resilient locator pattern

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
[AI Locator Healer](#9-ai-locator-healer) snapshots the live DOM and returns
5 ranked verified replacements in seconds.

### Strict mode violation fix

`getByText()` matches both visible elements and hidden `<title>` tags in cal.com,
causing Playwright strict mode failures. Fix: always scope to a container.

```typescript
// ❌ Fails — matches <h1> and <title>
page.getByText('Chat')

// ✅ Works — scoped to visible container
page.getByTestId('event-title')
```

### Autonomous agent DOM extraction

Static `innerText` gives the agent no actionable information. The agent extracts
all interactive elements with their text, href, and data-testid attributes:

```typescript
const interactive = Array.from(
  document.querySelectorAll('a, button, [role="button"]')
).map(el => `[${el.tagName}] text="${el.innerText}" href="${el.href}" 
  data-testid="${el.getAttribute('data-testid')}"`);
```

### Playwright Trace Viewer integration

Every test run captures a full trace — timeline, screenshots at each step,
network requests, and console logs. A CTO can open the trace viewer and see
exactly what the agent was doing at every millisecond:

```bash
npx playwright show-report
```

---

## About

This project is built as a practical demonstration of AI-native QA engineering - an autonomous
ecosystem that generates, executes, diagnoses, and improves tests using LLM
inference at every layer of the QA workflow.

The approach: AI handles the repetitive and exploratory work; the engineer
focuses on judgment, verification, and strategy.

A full QA audit of the cal.com codebase is available in [`docs/cal-com-qa-audit.md`](docs/cal-com-qa-audit.md) —
demonstrating autonomous codebase exploration, risk analysis, and test strategy proposal.
