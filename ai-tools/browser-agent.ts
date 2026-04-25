import { groqChat, MODELS } from './groq-client';
import { ensureDir, isSafeSelector, parseAIJson, saveReport, DEFAULT_BASE_URL } from './tool-utils';
import { chromium } from '@playwright/test';
import * as path from 'path';
import { z } from 'zod';

const AgentActionSchema = z.object({
  action: z.enum(['click', 'fill', 'navigate', 'scroll', 'done', 'fail']),
  selector: z.string().optional(),
  value: z.string().optional(),
  url: z.string().optional(),
  reason: z.string(),
  finding: z.string().optional(),
});

type AgentAction = z.infer<typeof AgentActionSchema>;

async function decideNextAction(
  goal: string,
  pageContent: string,
  currentUrl: string,
  history: string[]
): Promise<AgentAction> {
  const result = await groqChat({
    model: MODELS.text,
    messages: [
      {
        role: 'system',
        content: `You are an autonomous QA agent controlling a browser to test a web application.
You receive the current page's text content and URL, and must decide the next action.
Always respond with a valid JSON object only — no markdown, no explanation.

CRITICAL RULES:
- If you can see time slots (e.g. "11:00pm", "3:00pm", "10:15am") in PAGE TEXT or INTERACTIVE ELEMENTS, the goal is achieved — respond with action "done".
- If the last 3 history entries all took the same action for the same reason, you are in a loop — respond with action "done" or "fail".
- Prefer month_view over week_view when trying to select a date; week_view rarely exposes individual date buttons.
- Use action "done" as soon as the goal is verifiably met — do not keep clicking unnecessarily.`,
      },
      {
        role: 'user',
        content: `GOAL: ${goal}

CURRENT URL: ${currentUrl}

ACTIONS TAKEN SO FAR:
${history.length > 0 ? history.join('\n') : 'None yet'}

PAGE CONTENT (truncated):
${pageContent.substring(0, 2000)}

Decide the next action. Respond with ONLY a JSON object in this exact format:
{
  "action": "click" | "fill" | "navigate" | "scroll" | "done" | "fail",
  "selector": "CSS selector or text to interact with (if applicable)",
  "value": "text to type (if action is fill)",
  "url": "URL to navigate to (if action is navigate)",
  "reason": "why you are taking this action",
  "finding": "only if action is done or fail — what you found"
}`,
      },
    ],
  });

  const raw = parseAIJson<unknown>(result.choices[0].message.content!);
  try {
    return AgentActionSchema.parse(raw);
  } catch {
    throw new Error('AI returned an unrecognised action shape — retrying may fix it');
  }
}

/**
 * Attempts to click an element using a cascade of Playwright strategies.
 * Tries role, text, testid, button text, and raw CSS selector in order.
 */
async function tryClick(
  page: import('@playwright/test').Page,
  selector: string,
  cleanText: string,
  allowedHost: string
): Promise<void> {
  const testIdMatch = selector.match(/data-testid=['"](.*?)['"]/);
  const hrefMatch = selector.match(/href=['"](.*?)['"]/);

  if (hrefMatch) {
    try {
      const hrefUrl = new URL(hrefMatch[1], page.url());
      if (hrefUrl.hostname !== allowedHost) {
        console.log(
          `⚠️  SSRF: href navigation to ${hrefUrl.hostname} blocked (only ${allowedHost} allowed)`
        );
        return;
      }
    } catch {
      console.log(`⚠️  Invalid href value: ${hrefMatch[1]}, skipping`);
      return;
    }
    await page.goto(hrefMatch[1]);
    return;
  }
  if (testIdMatch) {
    await page
      .getByTestId(testIdMatch[1])
      .and(page.locator(':not([disabled])'))
      .first()
      .click({ timeout: 3000 });
    return;
  }

  const strategies: (() => Promise<void>)[] = [
    () =>
      page.getByRole('button', { name: cleanText, exact: false }).first().click({ timeout: 3000 }),
    () => page.getByText(cleanText, { exact: false }).first().click({ timeout: 3000 }),
    () =>
      page
        .getByTestId('day')
        .filter({ hasText: new RegExp(`^${cleanText}`) })
        .first()
        .click({ timeout: 3000 }),
    () =>
      page
        .locator('button', { hasText: new RegExp(`^${cleanText}$`) })
        .first()
        .click({ timeout: 3000 }),
    () => {
      if (!isSafeSelector(selector)) {
        console.log(`⚠️  Unsafe selector rejected: ${selector}`);
        return Promise.resolve();
      }
      return page.locator(selector).first().click({ timeout: 3000 });
    },
  ];

  for (const strategy of strategies) {
    try {
      await strategy();
      return;
    } catch {
      // try next strategy
    }
  }
}

async function runAgent(goal: string, startUrl: string, maxSteps = 8) {
  console.log(`\n🤖 Autonomous QA Agent`);
  console.log(`📋 Goal: ${goal}`);
  console.log(`🌐 Starting at: ${startUrl}\n`);

  const browser = await chromium.launch({ headless: process.env.CI ? true : !process.env.PWDEBUG });
  const page = await browser.newPage();
  await page.goto(startUrl);

  const history: string[] = [];
  const screenshotsDir = path.join(process.cwd(), 'agent-screenshots');
  ensureDir(screenshotsDir);

  for (let step = 1; step <= maxSteps; step++) {
    console.log(`\n--- Step ${step}/${maxSteps} ---`);

    // Capture current page state
    const currentUrl = page.url();
    const pageContent = await page.evaluate(() => {
      const interactive = Array.from(document.querySelectorAll('a, button, [role="button"]'))
        .map(el => {
          const text = (el as HTMLElement).innerText?.trim();
          const href = (el as HTMLAnchorElement).href;
          const testId = el.getAttribute('data-testid');
          return `[${el.tagName}] text="${text}" ${href ? `href="${href}"` : ''} ${testId ? `data-testid="${testId}"` : ''}`;
        })
        .filter(s => s.includes('text="') && !s.includes('text=""') && !s.includes('disabled'))
        .slice(0, 50)
        .join('\n');

      // Explicitly surface time slot buttons so the AI recognises completion
      const timeSlots = Array.from(document.querySelectorAll('[data-testid="time"]'))
        .map(el => (el as HTMLElement).innerText?.trim())
        .filter(Boolean)
        .slice(0, 10);

      const timeSlotsSection =
        timeSlots.length > 0 ? `\n\nTIME SLOTS VISIBLE: ${timeSlots.join(', ')}` : '';

      return `INTERACTIVE ELEMENTS:\n${interactive}\n\nPAGE TEXT:\n${document.body.innerText.substring(0, 1000)}${timeSlotsSection}`;
    });
    const screenshotPath = path.join(screenshotsDir, `step-${step}.png`);
    await page.screenshot({ path: screenshotPath });

    console.log(`📍 URL: ${currentUrl}`);

    // Ask AI what to do next
    let action: AgentAction;
    try {
      action = await decideNextAction(goal, pageContent, currentUrl, history);
    } catch (err) {
      console.error('❌ AI decision failed:', err);
      break;
    }

    console.log(`🧠 AI Decision: ${action.action} — ${action.reason}`);
    history.push(`Step ${step}: ${action.action} — ${action.reason}`);

    // Execute the action
    try {
      switch (action.action) {
        case 'navigate': {
          if (!action.url) {
            console.log('⚠️  navigate action missing url, skipping');
            break;
          }
          // Resolve relative URLs (e.g. /bailey/chat) against startUrl
          const resolvedNavUrl = (() => {
            try {
              return new URL(action.url!);
            } catch {
              try {
                return new URL(action.url!, startUrl);
              } catch {
                return null;
              }
            }
          })();
          if (!resolvedNavUrl) {
            console.log(`⚠️  Invalid navigate URL: ${action.url}, skipping`);
            break;
          }
          const allowedHost = new URL(startUrl).hostname;
          if (resolvedNavUrl.hostname !== allowedHost) {
            console.log(
              `⚠️  SSRF: navigate to ${resolvedNavUrl.hostname} blocked (only ${allowedHost} allowed)`
            );
            break;
          }
          await page.goto(resolvedNavUrl.toString());
          break;
        }

        case 'click': {
          // Extract clean text from AI selector like BUTTON[text='14 Today'] or BUTTON[text='25']
          const textMatch =
            action.selector!.match(/text=['"](.*?)['"]/) ||
            action.selector!.match(/BUTTON\[text=['"]?(.*?)['"]?\]/);
          const cleanText = textMatch ? textMatch[1] : action.selector!;
          await tryClick(page, action.selector!, cleanText, new URL(startUrl).hostname);
          await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
          break;
        }

        case 'fill':
          if (isSafeSelector(action.selector)) {
            await page.locator(action.selector).first().fill(action.value!);
          } else {
            console.log(`⚠️  Unsafe selector rejected for fill: ${action.selector}`);
          }
          break;

        case 'scroll':
          await page.evaluate(() => window.scrollBy(0, 400));
          break;

        case 'done':
          console.log(`\n✅ Goal achieved!`);
          console.log(`📝 Finding: ${action.finding}`);
          await generateReport(goal, history, action.finding!, screenshotsDir, true);
          await browser.close();
          return;

        case 'fail':
          console.log(`\n❌ Goal could not be completed`);
          console.log(`📝 Finding: ${action.finding}`);
          await generateReport(goal, history, action.finding!, screenshotsDir, false);
          await browser.close();
          return;
      }
    } catch (err) {
      console.log(`⚠️  Action failed: ${err}`);
      history.push(`Step ${step}: Action failed — ${err}`);
    }
  }

  console.log('\n⏱️  Max steps reached');
  await generateReport(
    goal,
    history,
    'Max steps reached without completing goal',
    screenshotsDir,
    false
  );
  await browser.close();
}

async function generateReport(
  goal: string,
  history: string[],
  finding: string,
  screenshotsDir: string,
  success: boolean
) {
  const report = `# Autonomous QA Agent Report

**Goal:** ${goal}  
**Result:** ${success ? '✅ Passed' : '❌ Failed'}  
**Finding:** ${finding}

## Steps Taken
${history.map((h, i) => `${i + 1}. ${h}`).join('\n')}

## Screenshots
Screenshots saved to: ${screenshotsDir}

---
*Generated by AI-Native QA Toolkit*
`;

  saveReport('agent-report.md', report);
}

if (require.main === module) {
  const goal =
    process.argv[2] ||
    'Verify that a user can navigate from the profile page to the booking calendar and see available time slots';
  const startUrl = process.argv[3] || `${DEFAULT_BASE_URL}/bailey`;
  runAgent(goal, startUrl).catch(console.error);
}
