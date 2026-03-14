import * as dotenv from 'dotenv';
import Groq from 'groq-sdk';
import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function explorePage(url: string) {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  await page.goto(url, { timeout: 15000 });
  await page.waitForTimeout(2000);

  const data = await page.evaluate(() => {
    const testIds = Array.from(document.querySelectorAll('[data-testid]'))
      .filter(el => (el as HTMLElement).offsetParent !== null)
      .map(el => ({
        testId: el.getAttribute('data-testid'),
        tag: el.tagName,
        text: ((el as HTMLElement).innerText || '').trim().substring(0, 50)
      }));

    const buttons = Array.from(
      document.querySelectorAll('button:not([disabled])')
    )
      .map(el => ({
        text: ((el as HTMLElement).innerText || '').trim().substring(0, 50),
        testId: el.getAttribute('data-testid')
      }))
      .filter(b => b.text);

    const headings = Array.from(document.querySelectorAll('h1,h2,h3')).map(
      el => ({
        tag: el.tagName,
        text: ((el as HTMLElement).innerText || '').trim().substring(0, 50)
      })
    );

    const links = Array.from(document.querySelectorAll('a[href]'))
      .map(el => ({
        text: ((el as HTMLElement).innerText || '').trim().substring(0, 50),
        href: (el as HTMLAnchorElement).href
      }))
      .filter(l => l.text)
      .slice(0, 10);

    return { testIds, buttons, headings, links };
  });

  const title = await page.title();
  const finalUrl = page.url();
  await browser.close();
  return { url: finalUrl, title, ...data };
}

async function generateTests(url: string) {
  console.log('Exploring: ' + url);
  const p = await explorePage(url);
  console.log(
    'Found: ' +
      p.testIds.length +
      ' testids, ' +
      p.buttons.length +
      ' buttons, ' +
      p.headings.length +
      ' headings'
  );

  const lines = [
    'Generate a Playwright TypeScript test file for: ' + p.url,
    'Title: ' + p.title,
    '',
    'DATA-TESTID ELEMENTS:',
    ...p.testIds.map(
      e => '- data-testid="' + e.testId + '" ' + e.tag + ' "' + e.text + '"'
    ),
    '',
    'BUTTONS:',
    ...p.buttons.map(
      b =>
        '- "' +
        b.text +
        '"' +
        (b.testId ? ' [data-testid="' + b.testId + '"]' : '')
    ),
    '',
    'HEADINGS:',
    ...p.headings.map(h => '- ' + h.tag + ': "' + h.text + '"'),
    '',
    'LINKS:',
    ...p.links.map(l => '- "' + l.text + '" ' + l.href),
    '',
    'Rules:',
    '- Use ONLY selectors listed above',
    '- getByTestId() for data-testid elements',
    '- getByRole("button", { name }) for buttons',
    '- 5+ tests: load, elements, click date, time slots, mobile',
    '- Page Object Model pattern',
    '- Return ONLY TypeScript, no markdown fences'
  ];

  const result = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: 'Expert QA engineer. Return ONLY TypeScript, no markdown.'
      },
      { role: 'user', content: lines.join('\n') }
    ],
    max_tokens: 3000
  });

  let code = result.choices[0].message.content!.trim();
  code = code.replace(/^```typescript\n?|^```\n?|```$/gm, '').trim();

  fs.writeFileSync(
    path.join(process.cwd(), 'tests', 'ai-generated.spec.ts'),
    code
  );
  console.log('Done! Preview:');
  console.log(code.substring(0, 400));
}

const url = process.argv[2] || 'https://cal.com/bailey/chat';
generateTests(url).catch(console.error);