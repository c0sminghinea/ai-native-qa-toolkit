import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { groqChat, MODELS } from './ai-tools/groq-client';
import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
const server = new McpServer({
  name: 'ai-native-qa-toolkit',
  version: '1.0.0',
});

// ─── Tool 1: Failure Analyzer ─────────────────────────────────────────────
server.tool(
  'analyze_failure',
  'Analyzes a Playwright test failure and returns root cause, exact fix, and prevention advice',
  {
    error_log: z.string().describe('The Playwright error log or stack trace to analyze'),
    test_code: z.string().optional().describe('The test code that produced the error (optional)'),
  },
  async ({ error_log, test_code }) => {
    const result = await groqChat({
      model: MODELS.text,
      messages: [
        {
          role: 'system',
          content: 'You are an expert Playwright QA engineer. Analyze test failures and provide clear, actionable fixes.'
        },
        {
          role: 'user',
          content: `A Playwright test failed. Analyze the error and suggest a fix.

${test_code ? `TEST CODE:\n${test_code}\n` : ''}
ERROR LOG:
${error_log}

Provide:
1. ROOT CAUSE: What exactly caused this failure in 1-2 sentences
2. FIX: The exact code change needed to fix it
3. PREVENTION: One sentence on how to prevent this class of failure in future`
        }
      ]
    });

    return {
      content: [{ type: 'text', text: result.choices[0].message.content! }]
    };
  }
);

// ─── Tool 2: Coverage Advisor ─────────────────────────────────────────────
server.tool(
  'advise_coverage',
  'Reviews a Playwright test file, scores coverage out of 10, and writes the top 3 missing tests',
  {
    test_file_path: z.string().describe('Absolute or relative path to the Playwright test file to analyze'),
  },
  async ({ test_file_path }) => {
    const resolvedPath = path.resolve(process.cwd(), test_file_path);

    const workspaceRoot = process.cwd() + path.sep;
    if (!resolvedPath.startsWith(workspaceRoot)) {
      return {
        content: [{ type: 'text', text: 'Error: path outside workspace is not permitted' }]
      };
    }

    if (!fs.existsSync(resolvedPath)) {
      return {
        content: [{ type: 'text', text: `Error: File not found at ${resolvedPath}` }]
      };
    }

    const testCode = fs.readFileSync(resolvedPath, 'utf-8');

    const result = await groqChat({
      model: MODELS.text,
      messages: [
        {
          role: 'system',
          content: 'You are a senior QA engineer specializing in test coverage analysis. Be specific and practical.'
        },
        {
          role: 'user',
          content: `Review this Playwright test file and identify coverage gaps.

TEST FILE:
${testCode}

Provide your response in exactly this format:

COVERAGE SCORE: X/10

WHAT IS COVERED:
- (list each scenario currently tested)

CRITICAL GAPS:
- (list missing tests that could catch real bugs)

TOP 3 TESTS TO ADD:
1. Test name: [name]
   Why: [one sentence on why this matters]
   Code: [the actual Playwright test code]

2. Test name: [name]
   Why: [one sentence on why this matters]
   Code: [the actual Playwright test code]

3. Test name: [name]
   Why: [one sentence on why this matters]
   Code: [the actual Playwright test code]`
        }
      ]
    });

    return {
      content: [{ type: 'text', text: result.choices[0].message.content! }]
    };
  }
);

// ─── Helper: scrape interactive elements from a live page ─────────────────
async function explorePage(url: string) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await (await browser.newContext()).newPage();
    await page.goto(url, { timeout: 15000 });
    await page.waitForTimeout(2000);

    const data = await page.evaluate(() => {
      const testIds = Array.from(document.querySelectorAll('[data-testid]'))
        .filter(el => (el as HTMLElement).offsetParent !== null)
        .map(el => ({
          testId: el.getAttribute('data-testid'),
          tag: el.tagName,
          text: ((el as HTMLElement).innerText || '').trim().substring(0, 50),
        }));

      const buttons = Array.from(document.querySelectorAll('button:not([disabled])'))
        .map(el => ({
          text: ((el as HTMLElement).innerText || '').trim().substring(0, 50),
          testId: el.getAttribute('data-testid'),
        }))
        .filter(b => b.text);

      const headings = Array.from(document.querySelectorAll('h1,h2,h3'))
        .map(el => ({ tag: el.tagName, text: ((el as HTMLElement).innerText || '').trim().substring(0, 50) }));

      return { testIds, buttons, headings };
    });

    return { url: page.url(), title: await page.title(), ...data };
  } finally {
    await browser.close();
  }
}

// ─── Tool 3: Generate Tests ───────────────────────────────────────────────
server.tool(
  'generate_tests',
  'Explores a URL using a real browser then generates a grounded Playwright TypeScript test file',
  {
    url: z.string().describe('The URL of the page to generate tests for'),
    output_path: z.string().optional().describe('Where to save the generated test file (optional)'),
  },
  async ({ url, output_path }) => {
    if (!url.startsWith('http')) {
      return { content: [{ type: 'text', text: 'Error: URL must start with http or https' }] };
    }

    let pageData: Awaited<ReturnType<typeof explorePage>>;
    try {
      pageData = await explorePage(url);
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error exploring page: ${err instanceof Error ? err.message : String(err)}` }],
      };
    }

    const lines = [
      `Generate a Playwright TypeScript test file for: ${pageData.url}`,
      `Title: ${pageData.title}`,
      '',
      'DATA-TESTID ELEMENTS:',
      ...pageData.testIds.map(e => `- data-testid="${e.testId}" ${e.tag} "${e.text}"`),
      '',
      'BUTTONS:',
      ...pageData.buttons.map(b => `- "${b.text}"${b.testId ? ` [data-testid="${b.testId}"]` : ''}`),
      '',
      'HEADINGS:',
      ...pageData.headings.map(h => `- ${h.tag}: "${h.text}"`),
      '',
      'Rules:',
      '- Use ONLY selectors listed above',
      '- getByTestId() for data-testid elements',
      '- getByRole("button", { name }) for buttons',
      '- 5+ tests: load, elements, click date, time slots, mobile',
      '- Page Object Model pattern',
      '- Return ONLY TypeScript, no markdown fences',
    ];

    const result = await groqChat({
      model: MODELS.text,
      messages: [
        { role: 'system', content: 'Expert QA engineer. Return ONLY TypeScript, no markdown.' },
        { role: 'user', content: lines.join('\n') },
      ],
      max_tokens: 3000,
    });

    let code = result.choices[0].message.content!.trim();
    code = code.replace(/^```typescript\n?|^```\n?|```$/gm, '').trim();

    if (output_path) {
      const resolvedPath = path.resolve(process.cwd(), output_path);
      fs.writeFileSync(resolvedPath, code);
      return {
        content: [{ type: 'text', text: `Tests generated and saved to ${resolvedPath}\n\n${code}` }],
      };
    }

    return { content: [{ type: 'text', text: code }] };
  }
);

// ─── Tool 4: Visual Regression ────────────────────────────────────────────
server.tool(
  'visual_regression',
  'Takes screenshots across desktop, tablet, and mobile viewports and analyzes each for UX issues using AI vision',
  {
    url: z.string().describe('The URL to analyze visually'),
  },
  async ({ url }) => {
    const viewports = [
      { name: 'desktop', width: 1280, height: 720, label: 'Desktop' },
      { name: 'mobile', width: 375, height: 812, label: 'Mobile' },
    ];

    const analyses: string[] = [];

    for (const vp of viewports) {
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();
      await page.goto(url, { timeout: 15000 });
      await page.waitForTimeout(2000);

      const dir = path.join(process.cwd(), 'visual-regression');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);
      const screenshotPath = path.join(dir, `mcp-${vp.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      await browser.close();

      const imageData = fs.readFileSync(screenshotPath);
      const base64Image = imageData.toString('base64');

      const result = await groqChat({
        model: MODELS.vision,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this ${vp.label} screenshot for UX issues. Focus on: layout problems, CTA visibility, conversion risks. Rate 1-10.`
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${base64Image}` }
            }
          ]
        }]
      });

      analyses.push(`## ${vp.label}\n${result.choices[0].message.content}`);
      await new Promise(r => setTimeout(r, 2000));
    }

    return {
      content: [{ type: 'text', text: analyses.join('\n\n---\n\n') }]
    };
  }
);

// ─── Start Server ─────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('AI-Native QA Toolkit MCP Server running on stdio');
}

main().catch(console.error);