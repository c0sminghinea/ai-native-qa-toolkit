import { groqChat, MODELS } from './groq-client';
import { handleToolError, isSafeSelector, saveReport, parseAIJson, DEFAULT_TARGET_URL } from './tool-utils';
import { chromium, type Page, type Locator } from '@playwright/test';
import * as fs from 'fs';

// ─── Types ───────────────────────────────────────────────────────────────────

type LocatorMethod =
  | 'getByTestId'
  | 'getByRole'
  | 'getByText'
  | 'getByLabel'
  | 'getByPlaceholder'
  | 'locator';

interface SelectorSuggestion {
  method: LocatorMethod;
  args: (string | Record<string, unknown>)[];
  description: string;
  confidence: 'high' | 'medium' | 'low';
  playwrightCode: string;
}

interface HealingOutput {
  targetDescription: string;
  suggestions: SelectorSuggestion[];
}

interface VerifiedSuggestion {
  suggestion: SelectorSuggestion;
  count: number;
  visible: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Accepts either a broken-selector string or a path to a Playwright error log.
 * When given an error log, extracts the locator expression from the log output.
 */
function extractBrokenSelector(input: string): string {
  if (fs.existsSync(input)) {
    const content = fs.readFileSync(input, 'utf-8').substring(0, 8000);
    // Playwright error format: "  Locator: page.getByTestId('foo')" or "Locator: getByText('bar')"
    const locatorLine = content.match(/Locator:\s*(.+)/);
    if (locatorLine) return locatorLine[1].trim();
    // Fallback: first line containing a known locator method
    const methodLine = content.match(/(getByTestId|getByRole|getByText|getByLabel|locator)\([^)]+\)/);
    if (methodLine) return methodLine[0].trim();
    return content.substring(0, 300);
  }
  return input;
}

/**
 * Builds a live Playwright Locator from a structured AI suggestion.
 * Returns null if the method is unknown or the selector is unsafe.
 */
function buildLocator(page: Page, suggestion: SelectorSuggestion): Locator | null {
  const [first, second] = suggestion.args;
  try {
    switch (suggestion.method) {
      case 'getByTestId':
        return page.getByTestId(first as string);

      case 'getByRole':
        return page.getByRole(
          first as Parameters<Page['getByRole']>[0],
          second as Parameters<Page['getByRole']>[1]
        );

      case 'getByText':
        return page.getByText(
          first as string,
          second as Parameters<Page['getByText']>[1]
        );

      case 'getByLabel':
        return page.getByLabel(
          first as string,
          second as Parameters<Page['getByLabel']>[1]
        );

      case 'getByPlaceholder':
        return page.getByPlaceholder(
          first as string,
          second as Parameters<Page['getByPlaceholder']>[1]
        );

      case 'locator': {
        const selector = first as string;
        if (!isSafeSelector(selector)) {
          console.log(`⚠️  Unsafe CSS selector rejected: ${selector}`);
          return null;
        }
        return page.locator(selector);
      }

      default:
        return null;
    }
  } catch {
    return null;
  }
}

/** Snapshots testids, headings, buttons, and form elements from the live DOM. */
async function extractDomContext(page: Page): Promise<string> {
  return page.evaluate(() => {
    const testIds = Array.from(document.querySelectorAll('[data-testid]'))
      .filter(el => (el as HTMLElement).offsetParent !== null)
      .map(el => `  testid="${el.getAttribute('data-testid')}" <${el.tagName.toLowerCase()}> "${((el as HTMLElement).innerText || '').trim().substring(0, 60)}"`)
      .slice(0, 25);

    const headings = Array.from(document.querySelectorAll('h1,h2,h3'))
      .map(el => `  <${el.tagName.toLowerCase()}> "${((el as HTMLElement).innerText || '').trim().substring(0, 60)}"`);

    const buttons = Array.from(document.querySelectorAll('button:not([disabled])'))
      .filter(el => (el as HTMLElement).offsetParent !== null)
      .map(el => {
        const testId = el.getAttribute('data-testid');
        const text = ((el as HTMLElement).innerText || '').trim().substring(0, 50);
        return `  [button]${testId ? ` testid="${testId}"` : ''} text="${text}"`;
      })
      .filter(b => !b.endsWith('text=""'))
      .slice(0, 15);

    const labels = Array.from(document.querySelectorAll('label'))
      .map(el => `  [label] "${((el as HTMLElement).innerText || '').trim().substring(0, 50)}"`)
      .slice(0, 10);

    const inputs = Array.from(document.querySelectorAll('input,textarea,select'))
      .map(el => {
        const inp = el as HTMLInputElement;
        return `  [${el.tagName.toLowerCase()}] type="${inp.type}" placeholder="${inp.placeholder}" aria-label="${el.getAttribute('aria-label') || ''}"`;
      })
      .slice(0, 10);

    const formElements = [...labels, ...inputs];
    return [
      'DATA-TESTID ELEMENTS:',
      ...(testIds.length ? testIds : ['  (none found)']),
      '',
      'HEADINGS:',
      ...(headings.length ? headings : ['  (none found)']),
      '',
      'BUTTONS:',
      ...(buttons.length ? buttons : ['  (none found)']),
      '',
      'FORM ELEMENTS:',
      ...(formElements.length ? formElements : ['  (none found)']),
    ].join('\n');
  });
}

// ─── Core ─────────────────────────────────────────────────────────────────────

async function healLocator(brokenSelector: string, url: string): Promise<void> {
  console.log('\n🔧 AI Locator Healer');
  console.log('=====================\n');
  console.log(`🔍 Broken selector : ${brokenSelector}`);
  console.log(`🌐 Target URL      : ${url}\n`);

  if (!url.startsWith('http')) {
    throw new Error(`Invalid URL: "${url}" — must start with http or https`);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await (await browser.newContext()).newPage();

    console.log('📡 Loading page...');
    await page.goto(url, { timeout: 15000 }).catch(() => {
      throw new Error(`Could not load URL: ${url} — check it is publicly accessible`);
    });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    console.log('🗂️  Extracting DOM context...');
    const domContext = await extractDomContext(page);

    console.log('🤖 Asking AI for healing suggestions...\n');
    const result = await groqChat({
      model: MODELS.text,
      messages: [
        {
          role: 'system',
          content: `You are an expert Playwright automation engineer specialising in robust locator strategies.
Suggest replacement Playwright locators for a broken one.
Locator preference order: getByTestId > getByRole > getByLabel > getByText > locator (CSS).
Return ONLY valid JSON — no markdown, no explanation.`,
        },
        {
          role: 'user',
          content: `A Playwright locator has stopped working. Suggest 5 replacement locators.

BROKEN LOCATOR: ${brokenSelector}

CURRENT DOM:
${domContext}

Return a JSON object in exactly this format:
{
  "targetDescription": "one sentence describing which element this locator targets",
  "suggestions": [
    {
      "method": "getByTestId" | "getByRole" | "getByText" | "getByLabel" | "getByPlaceholder" | "locator",
      "args": ["firstArg", { "optionalOptions": true }],
      "description": "why this selector works and why it is reliable",
      "confidence": "high" | "medium" | "low",
      "playwrightCode": "page.getByTestId('example')"
    }
  ]
}

Rules:
- Only suggest selectors for elements that EXIST in the DOM above
- args must be plain strings or simple option objects (no regex literals in JSON)
- Rank suggestions from most to least confident`,
        },
      ],
    });

    const output = parseAIJson<HealingOutput>(result.choices[0].message.content!);
    console.log(`🎯 Target: ${output.targetDescription}\n`);
    console.log('🧪 Verifying suggestions against live page...\n');

    const verifiedResults: VerifiedSuggestion[] = [];

    for (const suggestion of output.suggestions) {
      const locator = buildLocator(page, suggestion);
      const count = locator ? await locator.count().catch(() => 0) : 0;
      const visible = count > 0
        ? await locator!.first().isVisible({ timeout: 2000 }).catch(() => false)
        : false;

      verifiedResults.push({ suggestion, count, visible });

      const icon = visible ? '✅' : count > 0 ? '⚠️ ' : '❌';
      console.log(`${icon} [${suggestion.confidence.toUpperCase()}] ${suggestion.playwrightCode}`);
      console.log(`   ${suggestion.description}`);
      if (visible) {
        console.log(`   → ${count} element(s) found — first is visible`);
      } else if (count > 0) {
        console.log(`   → ${count} element(s) found — but not visible`);
      } else {
        console.log(`   → No elements matched`);
      }
      console.log();
    }

    const workingCount = verifiedResults.filter(r => r.visible).length;
    console.log(`✅ ${workingCount}/${verifiedResults.length} suggestions verified as visible`);

    const best = verifiedResults.find(r => r.visible);
    if (best) {
      console.log(`\n💡 Best replacement:\n   ${best.suggestion.playwrightCode}`);
    } else {
      console.log('\n⚠️  No verified replacement found — the element may not be present on this page state.');
    }

    const report = [
      '# AI Locator Healer Report',
      '',
      `**Broken Locator:** \`${brokenSelector}\`  `,
      `**URL:** ${url}  `,
      `**Date:** ${new Date().toISOString().split('T')[0]}  `,
      `**Tool:** Groq (${MODELS.text})`,
      '',
      '## Target Element',
      '',
      output.targetDescription,
      '',
      '## Suggestions',
      '',
      '| Status | Confidence | Playwright Code | Verified Visible |',
      '|---|---|---|---|',
      ...verifiedResults.map(r => {
        const status = r.visible ? '✅ Visible' : r.count > 0 ? '⚠️ Found (hidden)' : '❌ Not found';
        return `| ${status} | ${r.suggestion.confidence} | \`${r.suggestion.playwrightCode}\` | ${r.visible ? 'Yes' : 'No'} |`;
      }),
      '',
      '## Detailed Analysis',
      '',
      ...verifiedResults.flatMap(r => [
        `### \`${r.suggestion.playwrightCode}\``,
        '',
        `- **Method:** \`${r.suggestion.method}\``,
        `- **Confidence:** ${r.suggestion.confidence}`,
        `- **Elements matched:** ${r.count}`,
        `- **Visible:** ${r.visible ? 'Yes' : 'No'}`,
        `- **Rationale:** ${r.suggestion.description}`,
        '',
      ]),
      '---',
      '*Generated by AI-Native QA Toolkit — Locator Healer*',
    ].join('\n');

    saveReport('locator-healer-report.md', report);

  } finally {
    await browser.close();
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

const rawInput = process.argv[2] || "getByTestId('event-title')";
const url = process.argv[3] || DEFAULT_TARGET_URL;

let brokenSelector: string;
try {
  brokenSelector = extractBrokenSelector(rawInput);
} catch (err) {
  handleToolError(err, { 'no such file': 'Pass a valid error log path or a selector string as the first argument' });
}

healLocator(brokenSelector!, url).catch(err =>
  handleToolError(err, {
    'API key': 'Add GROQ_API_KEY=your_key to your .env file',
    'URL': 'Usage: npx tsx ai-tools/locator-healer.ts "brokenSelector" https://example.com',
    'load': 'Check the URL is publicly accessible',
  })
);
