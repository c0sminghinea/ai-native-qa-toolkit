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
   │  (7 tools)  │          │  Test Suite     │         │  Agent        │
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
    visual-regression.ts      # AI vision analysis across desktop, tablet, and mobile
    data-consistency.ts       # Verify data integrity across marketplace pages
  tests/
    pages/
      BookingPage.ts        # Page Object Model for cal.com booking page
    booking-flow.spec.ts    # Main E2E test suite (cross-browser, self-healing)
    ai-generated.spec.ts    # Output of generate-tests tool
  visual-regression/        # Screenshots from visual regression runs
  persona-screenshots/      # Screenshots from persona engine runs
  agent-screenshots/        # Screenshots from autonomous agent runs
  coverage-report.md        # Latest coverage advisory output
  persona-report.md         # Latest persona engine report
  agent-report.md           # Latest autonomous agent report
  visual-regression-report.md  # Latest visual regression report
  data-consistency-report.md   # Latest data consistency report
  mcp-server.ts                # MCP server exposing all tools to LLM clients
  mcp-config.json              # MCP client configuration for Claude Code/Cursor
```

---

## E2E Test Suite

Cross-browser tests covering the cal.com public booking flow across Chromium,
Firefox, and WebKit — 12 tests, all passing.

### Features

- **Page Object Model** — interactions encapsulated in `BookingPage.ts`
- **Self-healing selectors** — fallback locator strategies prevent brittle tests
- **Cross-browser** — Chromium, Firefox, WebKit
- **Mobile viewport** — responsive design validated at 375×812 (iPhone X)
- **Trace Viewer** — full step-by-step traces captured for every test run

### Run tests

```bash
# All browsers
npx playwright test

# Specific file
npx playwright test tests/booking-flow.spec.ts

# Headed mode (watch the browser)
npx playwright test --headed

# Single browser
npx playwright test --project=chromium

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

## MCP Server

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

Create a `.env` file in the project root:

```env
GROQ_API_KEY=your_key_here
```

---

## Engineering Philosophy: High Performance, Zero Waste

This toolkit runs entirely on free tier APIs and open-source models:

| Component | Tool | Cost |
| --- | --- | --- |
| LLM Inference | Groq (llama-3.3-70b-versatile) | Free tier |
| Vision Analysis | Groq (llama-4-scout-17b) | Free tier |
| Browser Automation | Playwright | Open source |
| MCP Orchestration | @modelcontextprotocol/sdk | Open source |
| Test Runner | Vitest + Playwright | Open source |

The AI-first approach means zero onboarding time on new codebases — the
toolkit reads, maps, and tests any repository autonomously from day one.

---

## Key Engineering Decisions

### Self-healing selector pattern

When a primary selector breaks (e.g. a `data-testid` gets renamed), the test
automatically falls back to alternative strategies:

```typescript
const locator = await selfHealingLocator(page, [
  () => page.getByTestId('event-title'),        // primary
  () => page.locator('h1').first(),             // fallback 1
  () => page.getByText('Chat', { exact: true }) // fallback 2
]);
```

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

Built as a practical demonstration of AI-native QA engineering — an autonomous
ecosystem that generates, executes, diagnoses, and improves tests using LLM
inference at every layer of the QA workflow.

The approach: AI handles the repetitive and exploratory work; the engineer
focuses on judgment, verification, and strategy.
