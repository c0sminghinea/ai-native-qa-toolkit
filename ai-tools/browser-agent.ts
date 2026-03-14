import * as dotenv from 'dotenv';
import Groq from 'groq-sdk';
import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

interface AgentAction {
  action: 'click' | 'fill' | 'navigate' | 'scroll' | 'done' | 'fail';
  selector?: string;
  value?: string;
  url?: string;
  reason: string;
  finding?: string;
}

async function decideNextAction(
  goal: string,
  pageContent: string,
  currentUrl: string,
  history: string[]
): Promise<AgentAction> {
  const result = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: `You are an autonomous QA agent controlling a browser to test a web application.
You receive the current page's text content and URL, and must decide the next action.
Always respond with a valid JSON object only — no markdown, no explanation.`
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
}`
      }
    ]
  });

  const raw = result.choices[0].message.content!.trim();
  try {
    return JSON.parse(raw);
  } catch {
    // If JSON parsing fails, extract JSON from the response
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error(`Could not parse AI response: ${raw}`);
  }
}

async function runAgent(goal: string, startUrl: string, maxSteps = 8) {
  console.log(`\n🤖 Autonomous QA Agent`);
  console.log(`📋 Goal: ${goal}`);
  console.log(`🌐 Starting at: ${startUrl}\n`);

  const browser = await chromium.launch({ headless: false }); // headless: false so you can watch
  const page = await browser.newPage();
  await page.goto(startUrl);

  const history: string[] = [];
  const screenshotsDir = path.join(process.cwd(), 'agent-screenshots');
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir);

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
    .slice(0, 30)
    .join('\n');

  return `INTERACTIVE ELEMENTS:\n${interactive}\n\nPAGE TEXT:\n${document.body.innerText.substring(0, 1000)}`;
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
        case 'navigate':
          await page.goto(action.url!);
          break;

        case 'click':
            // Extract clean text from AI selector like BUTTON[text='14 Today']
            const textMatch = action.selector!.match(/text=['"](.*?)['"]/) || 
                              action.selector!.match(/BUTTON\[text=['"]?(.*?)['"]?\]/);            const cleanText = textMatch ? textMatch[1] : action.selector!;
            const testIdMatch = action.selector!.match(/data-testid=['"](.*?)['"]/);
            const hrefMatch = action.selector!.match(/href=['"](.*?)['"]/);
            try {
                if (hrefMatch) {
                    // Navigate directly instead of clicking the link
                    await page.goto(hrefMatch[1]);
                } else if (testIdMatch) {
                    await page.getByTestId(testIdMatch[1]).and(page.locator(':not([disabled])')).first().click({ timeout: 3000 });
                } else {
                    await page.getByRole('button', { name: cleanText, exact: false })
                    .first().click({ timeout: 3000 });
                }
                } catch {
                    try {
                        await page.getByText(cleanText, { exact: false }).first().click({ timeout: 3000 });
                    } catch {
                        await page.locator(action.selector!).first().click({ timeout: 3000 });
                    }
                }
            await page.waitForTimeout(1500);
            break;

        case 'fill':
          await page.locator(action.selector!).first().fill(action.value!);
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
  await generateReport(goal, history, 'Max steps reached without completing goal', screenshotsDir, false);
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

  const reportPath = path.join(process.cwd(), 'agent-report.md');
  fs.writeFileSync(reportPath, report);
  console.log(`\n📄 Report saved to: agent-report.md`);
}

// Run the agent
const goal = process.argv[2] || 'Verify that a user can navigate from the profile page to the booking calendar and see available time slots';
const startUrl = process.argv[3] || 'https://cal.com/bailey';

runAgent(goal, startUrl).catch(console.error);