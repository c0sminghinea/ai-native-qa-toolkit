import * as dotenv from 'dotenv';
import Groq from 'groq-sdk';
import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

interface Persona {
  name: string;
  email: string;
  timezone: string;
  scenario: string;
  edgeCase: string;
  expectedRisk: 'low' | 'medium' | 'high';
}

async function generatePersonas(): Promise<Persona[]> {
  console.log('🧠 Generating edge case personas...\n');

  const result = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: 'You are a QA engineer specializing in edge case testing. Return ONLY valid JSON, no markdown, no explanation.'
      },
      {
        role: 'user',
        content: `Generate 8 edge case user personas for testing a scheduling/booking platform like cal.com.
        
Each persona should represent a different risk scenario that could expose bugs.

Return a JSON array with exactly this structure:
[
  {
    "name": "display name (can include special chars, very long names, unicode)",
    "email": "valid test email",
    "timezone": "IANA timezone string e.g. America/New_York",
    "scenario": "one sentence describing what this user is trying to do",
    "edgeCase": "one sentence describing the specific edge case this tests",
    "expectedRisk": "low" | "medium" | "high"
  }
]

Make personas diverse and realistic. Include cases like:
- Users in extreme timezones (UTC+14, UTC-12)
- Users with very long names or special characters
- Users with unusual email formats
- Users booking far in the future or same-day
- Users on mobile-sized viewports
- Users with slow/unreliable connections (simulate with throttling)
- Users who navigate back and forth before booking
- Users in locales with different date formats`
      }
    ]
  });

  const raw = result.choices[0].message.content!.trim();
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Could not parse personas JSON');
  }
}

async function testPersona(persona: Persona, index: number): Promise<{
  persona: Persona;
  passed: boolean;
  findings: string[];
  frictionPoints: string[];
  screenshot: string;
}> {
  console.log(`\n👤 Testing Persona ${index + 1}: ${persona.name}`);
  console.log(`   Scenario: ${persona.scenario}`);
  console.log(`   Edge Case: ${persona.edgeCase}`);
  console.log(`   Risk: ${persona.expectedRisk.toUpperCase()}`);

  const browser = await chromium.launch({ headless: true });

  const safeTimezone = persona.timezone.match(/^[A-Za-z]+\/[A-Za-z_]+$/)
    ? persona.timezone
    : 'UTC';

  const context = await browser.newContext({
    timezoneId: safeTimezone,
    locale: persona.timezone.startsWith('America') ? 'en-US' :
            persona.timezone.startsWith('Europe') ? 'en-GB' : 'en-US',
    viewport: index % 3 === 0 ? { width: 375, height: 812 } : { width: 1280, height: 720 }
  });

  const page = await context.newPage();
  const findings: string[] = [];
  const frictionPoints: string[] = [];
  let passed = true;

  const screenshotsDir = path.join(process.cwd(), 'persona-screenshots');
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir);
  const screenshotPath = path.join(screenshotsDir, `persona-${index + 1}.png`);
  const viewport = context.browser()?.contexts()[0] ? 
    { width: 1280, height: 720 } : { width: 375, height: 812 };

  try {
    await page.goto('https://cal.com/bailey/chat', { timeout: 15000 });
    findings.push('✅ Page loaded successfully');

    // Check event title
    const titleVisible = await page.getByTestId('event-title').isVisible().catch(() => false) ||
                         await page.locator('h1').first().isVisible().catch(() => false);
    if (titleVisible) {
      findings.push('✅ Event title visible');
    } else {
      frictionPoints.push('⚠️  UX: Event title not immediately visible — user may not know what they are booking');
    }

    // Check if CTA / primary action is above the fold
    const dateButton = page.getByRole('button').filter({ hasNot: page.locator('[disabled]') }).first();
    const dateButtonBox = await dateButton.boundingBox().catch(() => null);
    const pageViewport = page.viewportSize();
    if (dateButtonBox && pageViewport) {
      if (dateButtonBox.y > pageViewport.height) {
        frictionPoints.push(`⚠️  UX: First available date button is below the fold (y=${Math.round(dateButtonBox.y)}px, viewport height=${pageViewport.height}px) — user must scroll to book`);
      } else {
        findings.push('✅ First available date is visible without scrolling');
      }
    }

    // Check calendar rendered
    const calendarVisible = await page.getByText('March').isVisible().catch(() => false) ||
                            await page.getByText('April').isVisible().catch(() => false);
    if (calendarVisible) {
      findings.push('✅ Calendar rendered correctly');
    } else {
      frictionPoints.push('⚠️  UX: Calendar month label not visible — user cannot orient themselves in time');
    }

    // Click a date and check time slots
    await dateButton.click({ timeout: 3000 }).catch(() => null);
    await page.waitForTimeout(1000);

    const timeSlotsVisible = await page.getByText('12h').isVisible().catch(() => false);
    if (timeSlotsVisible) {
      findings.push('✅ Time slots rendered after date selection');
    } else {
      frictionPoints.push('⚠️  UX: Time slots did not appear after selecting a date — booking flow broken or delayed');
      passed = false;
    }

    // Check time slot buttons are above the fold
    const timeSlot = page.getByRole('button', { name: /^\d{1,2}:\d{2}$/ }).first();
    const timeSlotBox = await timeSlot.boundingBox().catch(() => null);
    if (timeSlotBox && pageViewport) {
      if (timeSlotBox.y > pageViewport.height) {
        frictionPoints.push(`⚠️  UX: Time slot buttons are below the fold — user must scroll to complete booking (conversion risk)`);
      } else {
        findings.push('✅ Time slot buttons visible without scrolling');
      }
    }

    // Ask AI to analyse the page for additional friction points
    const pageText = await page.evaluate(() => document.body.innerText.substring(0, 1500));
    const aiAnalysis = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: 'You are a UX-focused QA engineer. Identify friction points and conversion risks. Be concise and specific.'
        },
        {
          role: 'user',
          content: `This persona is testing a booking page: "${persona.scenario}"
          Edge case: "${persona.edgeCase}"
          Viewport: ${index % 3 === 0 ? '375x812 (mobile)' : '1280x720 (desktop)'}
          Timezone: ${safeTimezone}
          Page content:
          ${pageText}

          List up to 3 UX friction points or conversion risks specific to this persona. 
          Each on a new line starting with "⚠️  UX:". 
          If none, respond with "✅ No additional friction points identified."`
        }
      ]
    });

    const aiFindings = aiAnalysis.choices[0].message.content!.trim();
    aiFindings.split('\n')
      .filter(line => line.trim().length > 0)
      .forEach(line => {
        if (line.includes('⚠️')) {
          frictionPoints.push(line.trim());
        } else if (line.includes('✅')) {
          findings.push(line.trim());
        }
      });

    await page.screenshot({ path: screenshotPath, fullPage: true });
  
  } catch (err) {
    findings.push(`❌ Error: ${err}`);
    passed = false;
    await page.screenshot({ path: screenshotPath }).catch(() => null);
  } finally {
    await browser.close();
  }

  const status = passed ? '✅ PASSED' : '❌ FAILED';
  console.log(`   Result: ${status}`);
  findings.forEach(f => console.log(`   ${f}`));
  if (frictionPoints.length > 0) {
    console.log(`   Friction Points:`);
    frictionPoints.forEach(f => console.log(`   ${f}`));
  }

  return { persona, passed, findings, frictionPoints, screenshot: screenshotPath };
}

async function generateReport(results: Awaited<ReturnType<typeof testPersona>>[]) {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const highRiskFailed = results.filter(r => !r.passed && r.persona.expectedRisk === 'high').length;

  const report = `# Synthetic Persona Engine Report

## Summary
- **Total Personas Tested:** ${results.length}
- **Passed:** ${passed}
- **Failed:** ${failed}  
- **High-Risk Failures:** ${highRiskFailed}

---

## Persona Results

${results.map((r, i) => `
### Persona ${i + 1}: ${r.persona.name}
- **Status:** ${r.passed ? '✅ Passed' : '❌ Failed'}
- **Risk Level:** ${r.persona.expectedRisk.toUpperCase()}
- **Timezone:** ${r.persona.timezone}
- **Scenario:** ${r.persona.scenario}
- **Edge Case:** ${r.persona.edgeCase}
- **Screenshot:** persona-screenshots/persona-${i + 1}.png

**Technical Findings:**
${r.findings.join('\n')}

**UX Friction Points:**
${r.frictionPoints.length > 0 ? r.frictionPoints.join('\n') : '✅ No friction points identified'}
`).join('\n---\n')}

## UX Friction Summary
${results.flatMap(r => r.frictionPoints).length === 0 
  ? '✅ No friction points detected across all personas.'
  : results.flatMap(r => r.frictionPoints).join('\n')}

---

## Risk Analysis

${results.filter(r => !r.passed).length === 0 
  ? '✅ All personas passed — no edge case failures detected.'
  : `⚠️  ${failed} persona(s) failed. Review findings above for details.`}

---
*Generated by AI-Native QA Toolkit — Synthetic Persona Engine*`;

  const reportPath = path.join(process.cwd(), 'persona-report.md');
  fs.writeFileSync(reportPath, report);
  console.log(`\n📄 Full report saved to: persona-report.md`);
  console.log(`📸 Screenshots saved to: persona-screenshots/`);
  console.log(`\n✅ ${passed}/${results.length} personas passed`);
}

async function runPersonaEngine() {
  console.log('\n🎭 Synthetic Persona Engine');
  console.log('================================\n');

  const personas = await generatePersonas();
  console.log(`Generated ${personas.length} edge case personas\n`);
  personas.forEach((p, i) => {
    console.log(`${i + 1}. ${p.name} — ${p.edgeCase} [${p.expectedRisk.toUpperCase()}]`);
  });

  console.log('\n🚀 Running persona tests...');
  const results: Awaited<ReturnType<typeof testPersona>>[] = [];

  // Run personas sequentially to avoid overwhelming the server
  for (let i = 0; i < personas.length; i++) {
    const result = await testPersona(personas[i], i);
    results.push(result);
    // Small delay between personas
    await new Promise(r => setTimeout(r, 1000));
  }

  await generateReport(results);
}

runPersonaEngine().catch(console.error);