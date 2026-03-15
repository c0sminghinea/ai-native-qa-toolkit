import * as dotenv from 'dotenv';
import Groq from 'groq-sdk';
import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function captureScreenshot(url: string, name: string, viewport = { width: 1280, height: 720 }): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();

    await page.goto(url, { timeout: 15000 }).catch(() => {
      throw new Error(`Could not load URL: ${url} — check it is publicly accessible`);
    });

    await page.waitForTimeout(2000);

    const dir = path.join(process.cwd(), 'visual-regression');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    const screenshotPath = path.join(dir, `${name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    return screenshotPath;

  } finally {
    await browser.close();
  }
}

async function analyzeScreenshot(screenshotPath: string, context: string): Promise<string> {
  try {
    if (!fs.existsSync(screenshotPath)) {
      throw new Error(`Screenshot not found: ${screenshotPath}`);
    }

    const imageData = fs.readFileSync(screenshotPath);
    const base64Image = imageData.toString('base64');

    const result = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
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

Be specific. Reference actual elements you can see in the screenshot.`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`
              }
            }
          ]
        }
      ]
    });

    return result.choices[0].message.content!;

  } catch (err) {
    if (err instanceof Error && err.message.includes('Screenshot not found')) {
      throw err;
    }
    throw new Error(`AI vision analysis failed — ${err instanceof Error ? err.message : 'unknown error'}`);
  }
}

async function compareViewports(url: string) {
  try {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not set in your .env file');
    }

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

    for (const vp of viewports) {
      console.log(`📸 Capturing ${vp.label}...`);

      let screenshotPath: string;
      try {
        screenshotPath = await captureScreenshot(url, vp.name, { width: vp.width, height: vp.height });
      } catch (err) {
        console.error(`⚠️  Screenshot failed for ${vp.label}: ${err instanceof Error ? err.message : err}`);
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
        console.error(`⚠️  AI analysis failed for ${vp.label}: ${err instanceof Error ? err.message : err}`);
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
        screenshot: screenshotPath
      });

      await new Promise(r => setTimeout(r, 2000));
    }

    if (results.length === 0) {
      throw new Error('All viewport captures failed — no results to report');
    }

    const report = `# AI Visual Regression Report

**URL Tested:** ${url}  
**Date:** ${new Date().toISOString().split('T')[0]}  
**Tool:** Groq Vision (meta-llama/llama-4-scout-17b-16e-instruct)

---

## Summary

| Viewport | Score | Screenshot |
|---|---|---|
${results.map(r => `| ${r.viewport} | ${r.score} | visual-regression/${r.viewport.split(' ')[0].toLowerCase()}.png |`).join('\n')}

---

## Detailed Analysis

${results.map(r => `
### ${r.viewport}

${r.analysis}

---
`).join('\n')}

*Generated by AI-Native QA Toolkit — Visual Regression Module*
`;

    const reportPath = path.join(process.cwd(), 'visual-regression-report.md');
    fs.writeFileSync(reportPath, report);

    console.log('\n📄 Report saved to: visual-regression-report.md');
    console.log('📸 Screenshots saved to: visual-regression/');

  } catch (err) {
    if (err instanceof Error) {
      console.error('\n❌ Visual regression failed:', err.message);
      if (err.message.includes('API key')) {
        console.error('💡 Add GROQ_API_KEY=your_key to your .env file');
      } else if (err.message.includes('URL')) {
        console.error('💡 Usage: npx tsx ai-tools/visual-regression.ts https://example.com');
      } else {
        console.error('💡 Check your network connection and API key validity');
      }
    } else {
      console.error('\n❌ Unexpected error:', err);
    }
    process.exit(1);
  }
}

const url = process.argv[2] || 'https://cal.com/bailey/chat';
compareViewports(url);