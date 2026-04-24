import { groqChat, MODELS } from './groq-client';
import { saveReport, sleep } from './tool-utils';
import { chromium, Browser } from '@playwright/test';

interface PageCheck {
  name: string;
  url: string;
  description: string;
}

interface DataPoint {
  page: string;
  url: string;
  value: string | null;
  context: string;
  found: boolean;
}

interface ConsistencyResult {
  dataKey: string;
  consistent: boolean;
  values: DataPoint[];
  discrepancies: string[];
  aiAnalysis: string;
}

async function extractDataFromPage(
  url: string,
  dataKey: string,
  pageName: string,
  browser: Browser
): Promise<DataPoint> {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(url, { timeout: 15000 });
    await sleep(2000);

    const pageText = await page.evaluate(() => document.body.innerText);

    // Ask AI to extract the specific data point from page content
    const result = await groqChat({
      model: MODELS.text,
      messages: [
        {
          role: 'system',
          content: 'You are a data extraction assistant. Extract specific values from page content. Be precise and concise. Return ONLY the extracted value or "NOT_FOUND" if the value is not present.'
        },
        {
          role: 'user',
          content: `Extract the following data point from this page content:

DATA POINT TO FIND: "${dataKey}"

PAGE CONTENT:
${pageText.substring(0, 3000)}

Rules:
- Return ONLY the exact value you found (e.g. "$25/night", "4.8 stars", "John Smith")
- If you find multiple values for the same data point, return them all separated by " | "
- If not found, return exactly: NOT_FOUND
- Do not include any explanation`
        }
      ]
    });

    const extracted = result.choices[0].message.content!.trim();
    const found = extracted !== 'NOT_FOUND';

    return {
      page: pageName,
      url,
      value: found ? extracted : null,
      context: pageText.substring(0, 500),
      found
    };

  } finally {
    await context.close(); // reuse the shared browser — only close this context
  }
}

async function analyzeConsistency(
  dataKey: string,
  dataPoints: DataPoint[]
): Promise<{ consistent: boolean; discrepancies: string[]; aiAnalysis: string }> {
  const foundPoints = dataPoints.filter(d => d.found);

  if (foundPoints.length === 0) {
    return {
      consistent: false,
      discrepancies: [`"${dataKey}" was not found on any page`],
      aiAnalysis: `The data point "${dataKey}" could not be located on any of the tested pages.`
    };
  }

  // Check for simple value consistency
  const uniqueValues = [...new Set(foundPoints.map(d => d.value))];
  const isConsistent = uniqueValues.length === 1;
  const discrepancies: string[] = [];

  if (!isConsistent) {
    foundPoints.forEach(d => {
      discrepancies.push(`${d.page}: "${d.value}"`);
    });
  }

  // Ask AI for deeper analysis
  const result = await groqChat({
    model: MODELS.text,
    messages: [
      {
        role: 'system',
        content: 'You are a QA engineer specializing in data integrity testing for marketplace platforms.'
      },
      {
        role: 'user',
        content: `Analyze the consistency of this data point across multiple pages of a marketplace platform.
        DATA POINT: "${dataKey}"
        VALUES FOUND ACROSS PAGES:
        ${dataPoints.map(d => `- ${d.page} (${d.url}): ${d.found ? `"${d.value}"` : 'NOT FOUND'}`).join('\n')}
        Provide:
        1. CONSISTENCY STATUS: Is this data consistent across all pages? (Yes/No)
        2. RISK LEVEL: What is the business risk if this data is inconsistent? (Low/Medium/High/Critical)
        3. IMPACT: One sentence on how this inconsistency could affect users or the business
        4. RECOMMENDATION: One specific action to fix or prevent this issue`
    }
  ]
  });

  return {
    consistent: isConsistent,
    discrepancies,
    aiAnalysis: result.choices[0].message.content!
  };
}

async function runDataConsistencyCheck(
  dataPoints: { key: string; pages: PageCheck[] }[]
) {
  console.log('\n🔍 Data Consistency Checker');
  console.log('============================\n');
  console.log('Verifying data integrity across marketplace pages...\n');

  const results: ConsistencyResult[] = [];
  // One browser for the entire run — contexts are closed after each page visit
  const browser = await chromium.launch({ headless: true });

  try {
    for (const check of dataPoints) {
      console.log(`\n📊 Checking: "${check.key}"`);
      console.log(`   Pages: ${check.pages.map(p => p.name).join(', ')}\n`);

      const extractedData: DataPoint[] = [];

      for (const pageCheck of check.pages) {
        console.log(`   🌐 Visiting ${pageCheck.name}...`);
        let dataPoint: DataPoint;
        try {
          dataPoint = await extractDataFromPage(
            pageCheck.url,
            check.key,
            pageCheck.name,
            browser
          );
        } catch (err) {
          console.error(`   ❌ Failed to visit ${pageCheck.name}: ${err instanceof Error ? err.message : err}`);
          dataPoint = { page: pageCheck.name, url: pageCheck.url, value: null, context: '', found: false };
        }
        console.log(`   ${dataPoint.found ? '✅' : '❌'} ${pageCheck.name}: ${dataPoint.value || 'NOT FOUND'}`);
        extractedData.push(dataPoint);
        await sleep(1000);
      }

      const analysis = await analyzeConsistency(check.key, extractedData);

      const result: ConsistencyResult = {
        dataKey: check.key,
        consistent: analysis.consistent,
        values: extractedData,
        discrepancies: analysis.discrepancies,
        aiAnalysis: analysis.aiAnalysis
      };

      results.push(result);

      const status = analysis.consistent ? '✅ CONSISTENT' : '❌ INCONSISTENT';
      console.log(`\n   Result: ${status}`);
      if (!analysis.consistent && analysis.discrepancies.length > 0) {
        analysis.discrepancies.forEach(d => console.log(`   ⚠️  ${d}`));
      }
    }
  } finally {
    await browser.close();
  }

  await generateReport(results);
}

async function generateReport(results: ConsistencyResult[]) {
  const consistent = results.filter(r => r.consistent).length;
  const inconsistent = results.filter(r => !r.consistent).length;

  const report = `# Data Consistency Report

**Date:** ${new Date().toISOString().split('T')[0]}  
**Tool:** AI-Native QA Toolkit — Data Consistency Checker  
**Purpose:** Verify that key data points remain consistent across all pages of the marketplace

---

## Summary

| Metric | Count |
|---|---|
| Total checks | ${results.length} |
| ✅ Consistent | ${consistent} |
| ❌ Inconsistent | ${inconsistent} |
| Consistency rate | ${Math.round((consistent / results.length) * 100)}% |

---

## Results

${results.map(r => `
### ${r.consistent ? '✅' : '❌'} "${r.dataKey}"

**Status:** ${r.consistent ? 'Consistent across all pages' : 'Inconsistent — discrepancies found'}

**Values found:**
${r.values.map(v => `- **${v.page}:** ${v.found ? `\`${v.value}\`` : '❌ Not found'}`).join('\n')}

${!r.consistent && r.discrepancies.length > 0 ? `**Discrepancies:**\n${r.discrepancies.map(d => `- ${d}`).join('\n')}\n` : ''}
**AI Analysis:**
${r.aiAnalysis}
`).join('\n---\n')}

---

## Why Data Consistency Matters for Marketplaces

In a C2C marketplace, data inconsistency between pages is a critical trust issue:

- **Price shown on search ≠ price at checkout** → user feels deceived, abandons booking
- **Availability on profile ≠ availability in calendar** → double bookings, support tickets  
- **Rating on listing ≠ rating on profile** → erodes trust in the platform
- **Name/details differ across pages** → suggests stale cache or sync bug

This tool catches these issues automatically before they reach users.

---

*Generated by AI-Native QA Toolkit — Data Consistency Module*
`;

  saveReport('data-consistency-report.md', report);
  console.log(`\n✅ ${consistent}/${results.length} data points consistent`);
}

// ─── Define what to check ────────────────────────────────────────────────
// Using cal.com as the demo target — checking if event/host data
// is consistent across the profile page, event page, and embed
const TARGET = process.env.BASE_URL || 'https://cal.com';
const checksToRun = [
  {
    key: 'host name',
    pages: [
      {
        name: 'Profile Page',
        url: `${TARGET}/bailey`,
        description: 'Main profile listing page'
      },
      {
        name: 'Event Page',
        url: `${TARGET}/bailey/chat`,
        description: 'Individual event booking page'
      }
    ]
  },
  {
    key: 'event duration',
    pages: [
      {
        name: 'Profile Page',
        url: `${TARGET}/bailey`,
        description: 'Duration shown on profile listing'
      },
      {
        name: 'Event Page',
        url: `${TARGET}/bailey/chat`,
        description: 'Duration shown on booking page'
      }
    ]
  },
  {
    key: 'meeting platform (Google Meet / Zoom / location)',
    pages: [
      {
        name: 'Profile Page',
        url: `${TARGET}/bailey`,
        description: 'Meeting platform shown on profile'
      },
      {
        name: 'Event Page',
        url: `${TARGET}/bailey/chat`,
        description: 'Meeting platform shown on booking page'
      }
    ]
  }
];

runDataConsistencyCheck(checksToRun).catch(console.error);