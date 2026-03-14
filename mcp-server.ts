import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import Groq from 'groq-sdk';
import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
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
    const result = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
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

    if (!fs.existsSync(resolvedPath)) {
      return {
        content: [{ type: 'text', text: `Error: File not found at ${resolvedPath}` }]
      };
    }

    const testCode = fs.readFileSync(resolvedPath, 'utf-8');

    const result = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
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

// ─── Tool 3: Generate Tests ───────────────────────────────────────────────
server.tool(
  'generate_tests',
  'Generates a complete Playwright TypeScript test file for any URL',
  {
    url: z.string().describe('The URL of the page to generate tests for'),
    output_path: z.string().optional().describe('Where to save the generated test file (optional)'),
  },
  async ({ url, output_path }) => {
    const result = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are an expert QA engineer specializing in Playwright E2E testing. Return ONLY TypeScript code, no explanations, no markdown fences.'
        },
        {
          role: 'user',
          content: `Generate a complete, production-ready Playwright TypeScript test file for this URL: ${url}

Requirements:
- Use Page Object Model pattern
- Include at least 5 meaningful test cases
- Cover: page load, key UI elements, interactions, mobile viewport
- Use data-testid selectors where possible, fall back to getByRole and getByText
- Include self-healing fallback selectors using try/catch
- Add descriptive comments explaining what each test validates`
        }
      ]
    });

    const code = result.choices[0].message.content!;

    if (output_path) {
      const resolvedPath = path.resolve(process.cwd(), output_path);
      fs.writeFileSync(resolvedPath, code);
      return {
        content: [{
          type: 'text',
          text: `Tests generated and saved to ${resolvedPath}\n\n${code}`
        }]
      };
    }

    return {
      content: [{ type: 'text', text: code }]
    };
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

      const result = await groq.chat.completions.create({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
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