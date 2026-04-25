import { groqChat, MODELS } from './groq-client';
import { ensureDir, saveReport, handleToolError, DEFAULT_TARGET_URL } from './tool-utils';
import { chromium, type Browser } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function captureScreenshot(
  browser: Browser,
  url: string,
  name: string,
  viewport = { width: 1280, height: 720 }
): Promise<string> {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  try {
    await page.goto(url, { timeout: 15000 }).catch(() => {
      throw new Error(`Could not load URL: ${url} — check it is publicly accessible`);
    });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    const dir = path.join(process.cwd(), 'visual-regression');
    ensureDir(dir);

    const screenshotPath = path.join(dir, `${name}.png`);
    // Viewport-only keeps the PNG well under the vision API's ~4 MB limit.
    // Full-page screenshots of tall pages can easily exceed it and cause hard errors.
    await page.screenshot({ path: screenshotPath, fullPage: false });

    return screenshotPath;
  } finally {
    await context.close();
  }
}

async function analyzeScreenshot(screenshotPath: string, context: string): Promise<string> {
  try {
    if (!fs.existsSync(screenshotPath)) {
      throw new Error(`Screenshot not found: ${screenshotPath}`);
    }

    const imageData = fs.readFileSync(screenshotPath);
    const base64Image = imageData.toString('base64');

    const result = await groqChat({
      model: MODELS.vision,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are a UX-focused QA engineer reviewing a screenshot of a booking page.

Context: ${context}

Analyze this screenshot and report on:
1. LAYOUT: Are all key elements visible and properly positioned?
2. CTA VISIBILITY: Is the primary call-to-action (book/select date) clearly visible without scrolling?
3. READABILITY: Is text legible and not overlapping?
4. CONVERSION RISKS: Any visual issues that could prevent a user from completing a booking?
5. OVERALL SCORE: Rate the visual UX quality from 1-10

Be specific. Reference actual elements you can see in the screenshot.`,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
              },
            },
          ],
        },
      ],
    });

    return result.choices[0].message.content!;
  } catch (err) {
    if (err instanceof Error && err.message.includes('Screenshot not found')) {
      throw err;
    }
    throw new Error(
      `AI vision analysis failed — ${err instanceof Error ? err.message : 'unknown error'}`
    );
  }
}

async function compareViewports(url: string) {
  try {
    if (!url.startsWith('http')) {
      throw new Error(`Invalid URL: "${url}" — must start with http or https`);
    }

    console.log('\n👁️  AI Visual Regression Analysis');
    console.log('=====================================\n');
    console.log(`URL: ${url}\n`);

    const viewports = [
      { name: 'desktop', width: 1280, height: 720, label: 'Desktop (1280x720)' },
      { name: 'tablet', width: 768, height: 1024, label: 'Tablet (768x1024)' },
      { name: 'mobile', width: 375, height: 812, label: 'Mobile (375x812)' },
    ];

    const results: { viewport: string; score: string; analysis: string; screenshot: string }[] = [];

    const browser = await chromium.launch({ headless: true });
    try {
      for (const vp of viewports) {
        console.log(`📸 Capturing ${vp.label}...`);

        let screenshotPath: string;
        try {
          screenshotPath = await captureScreenshot(browser, url, vp.name, {
            width: vp.width,
            height: vp.height,
          });
        } catch (err) {
          console.error(
            `⚠️  Screenshot failed for ${vp.label}: ${err instanceof Error ? err.message : err}`
          );
          console.error('   Skipping this viewport and continuing...\n');
          continue;
        }

        console.log(`🧠 Analyzing with AI vision...\n`);

        let analysis: string;
        try {
          analysis = await analyzeScreenshot(
            screenshotPath,
            `This is a ${vp.label} viewport of a booking page. Focus on whether the booking flow is usable at this screen size.`
          );
        } catch (err) {
          console.error(
            `⚠️  AI analysis failed for ${vp.label}: ${err instanceof Error ? err.message : err}`
          );
          analysis = 'Analysis unavailable — AI vision request failed';
        }

        const scoreMatch = analysis.match(/(\d+)\/10|(\d+) out of 10/i);
        const score = scoreMatch ? `${scoreMatch[1] || scoreMatch[2]}/10` : 'N/A';

        console.log(`--- ${vp.label} ---`);
        console.log(analysis);
        console.log();

        results.push({
          viewport: vp.label,
          score,
          analysis,
          screenshot: screenshotPath,
        });
      }
    } finally {
      await browser.close();
    }

    if (results.length === 0) {
      throw new Error('All viewport captures failed — no results to report');
    }

    const report = `# AI Visual Regression Report

**URL Tested:** ${url}  
**Date:** ${new Date().toISOString().split('T')[0]}  
**Tool:** Groq Vision (${MODELS.vision})

---

## Summary

| Viewport | Score | Screenshot |
|---|---|---|
${results.map(r => `| ${r.viewport} | ${r.score} | visual-regression/${r.viewport.split(' ')[0].toLowerCase()}.png |`).join('\n')}

---

## Detailed Analysis

${results
  .map(
    r => `
### ${r.viewport}

${r.analysis}

---
`
  )
  .join('\n')}

*Generated by AI-Native QA Toolkit — Visual Regression Module*
`;

    saveReport('visual-regression-report.md', report);
    console.log('📸 Screenshots saved to: visual-regression/');
  } catch (err) {
    handleToolError(err, {
      'API key': 'Add GROQ_API_KEY=your_key to your .env file',
      URL: 'Usage: npx tsx ai-tools/visual-regression.ts https://example.com',
    });
  }
}

if (require.main === module) {
  const url = process.argv[2] || DEFAULT_TARGET_URL;
  compareViewports(url);
}
