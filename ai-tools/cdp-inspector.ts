import { groqChat, MODELS } from './groq-client';
import { saveReport, DEFAULT_TARGET_URL } from './tool-utils';
import { chromium } from '@playwright/test';

interface NetworkRequest {
  url: string;
  method: string;
  resourceType: string;
  status?: number;
  responseSize?: number;
  timing?: number;
}

interface ConsoleMessage {
  type: string;
  text: string;
}

async function inspectWithCDP(url: string) {
  console.log('\n🔬 CDP Inspector');
  console.log('================\n');
  console.log(`URL: ${url}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Open a CDP session directly on the page
  const cdpSession = await context.newCDPSession(page);

  const networkRequests: NetworkRequest[] = [];
  const consoleMessages: ConsoleMessage[] = [];
  const errors: string[] = [];

  // Enable CDP domains
  await cdpSession.send('Network.enable');
  await cdpSession.send('Console.enable');
  await cdpSession.send('Runtime.enable');

  // Enable request interception via CDP
  await cdpSession.send('Fetch.enable', {
    patterns: [
      { urlPattern: '*/api/trpc/slots*', requestStage: 'Request' },
      { urlPattern: '*/api/auth/session*', requestStage: 'Request' }
    ]
  });

  let interceptedRequests = 0;
  const interceptedLog: string[] = [];

  // Intercept and optionally mock API responses
  cdpSession.on('Fetch.requestPaused', async (params) => {
    interceptedRequests++;
    const url = params.request.url;
    interceptedLog.push(`Intercepted: ${params.request.method} ${url.substring(0, 80)}`);

    // Mock the slots API to return empty availability
    // This tests whether the UI handles "no available slots" gracefully
    if (url.includes('slots/getSchedule') && interceptedRequests === 1) {
      interceptedLog.push('→ Mocking empty slots response to test UI resilience');
      await cdpSession.send('Fetch.fulfillRequest', {
        requestId: params.requestId,
        responseCode: 200,
        responseHeaders: [
          { name: 'content-type', value: 'application/json' }
        ],
        body: Buffer.from(JSON.stringify({
          result: { data: { json: { slots: {} } } }
        })).toString('base64')
      });
    } else {
      // Pass all other requests through normally
      await cdpSession.send('Fetch.continueRequest', {
        requestId: params.requestId
      });
    }
  });

  // Capture all network requests via CDP
  cdpSession.on('Network.requestWillBeSent', (params) => {
    networkRequests.push({
      url: params.request.url,
      method: params.request.method,
      resourceType: params.type || 'unknown',
    });
  });

  // Capture network responses via CDP
  cdpSession.on('Network.responseReceived', (params) => {
    const request = networkRequests.find(r => r.url === params.response.url);
    if (request) {
      request.status = params.response.status;
    }
  });

  // Capture console messages via CDP
  cdpSession.on('Console.messageAdded', (params) => {
    consoleMessages.push({
      type: params.message.level,
      text: params.message.text
    });
    if (params.message.level === 'error') {
      errors.push(params.message.text);
    }
  });

  // Capture JavaScript exceptions via CDP Runtime domain
  cdpSession.on('Runtime.exceptionThrown', (params) => {
    const desc = params.exceptionDetails.exception?.description || 
                 params.exceptionDetails.text;
    errors.push(`JS Exception: ${desc}`);
  });

  // Navigate and interact with the page
  console.log('📡 Opening CDP session and navigating...\n');
  try {
    await page.goto(url, { timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

    // Simulate a user interaction to capture dynamic requests
    console.log('👆 Simulating user interaction...\n');
    try {
      const dateButton = page.getByRole('button').filter({
        hasNot: page.locator('[disabled]')
      }).first();
      await dateButton.click({ timeout: 3000 });
      await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
    } catch {
      console.log('   No interactive elements found — static analysis only\n');
    }
  } finally {
    await browser.close();
  }

  // Analyze findings
  console.log(`\n🔀 Request Interception Results:`);
  console.log(`   Requests intercepted: ${interceptedRequests}`);
  interceptedLog.forEach(l => console.log(`   ${l}`));
  console.log();

  const apiRequests = networkRequests.filter(r =>
    r.url.includes('/api/') ||
    r.url.includes('trpc') ||
    r.url.includes('graphql')
  );

  const failedRequests = networkRequests.filter(r =>
    r.status && r.status >= 400
  );

  const slowRequests = networkRequests.filter(r =>
    r.timing && r.timing > 1000
  );

  // Print raw findings
  console.log(`📊 CDP Session Results:`);
  console.log(`   Total network requests captured: ${networkRequests.length}`);
  console.log(`   API/tRPC calls: ${apiRequests.length}`);
  console.log(`   Failed requests (4xx/5xx): ${failedRequests.length}`);
  console.log(`   Slow requests (>1s): ${slowRequests.length}`);
  console.log(`   Console messages: ${consoleMessages.length}`);
  console.log(`   JavaScript errors: ${errors.length}\n`);

  if (apiRequests.length > 0) {
    console.log('🌐 API Requests detected:');
    apiRequests.slice(0, 5).forEach(r => {
      console.log(`   ${r.method} ${r.url.substring(0, 80)} [${r.status || 'pending'}]`);
    });
    console.log();
  }

  if (errors.length > 0) {
    console.log('❌ Errors detected:');
    errors.forEach(e => console.log(`   ${e}`));
    console.log();
  }

  // Ask AI to analyze the CDP findings
  console.log('🧠 AI analyzing CDP findings...\n');

  const result = await groqChat({
    model: MODELS.text,
    messages: [
      {
        role: 'system',
        content: 'You are a senior QA engineer specializing in browser protocol debugging and network analysis.'
      },
      {
        role: 'user',
        content: `Analyze these CDP (Chrome DevTools Protocol) session findings from a QA inspection of a booking page.

URL: ${url}

NETWORK SUMMARY:
- Total requests: ${networkRequests.length}
- API/tRPC calls: ${apiRequests.length}
- Failed requests: ${failedRequests.length}
- Slow requests (>1s): ${slowRequests.length}
- Resource types: ${[...new Set(networkRequests.map(r => r.resourceType))].join(', ')}

API CALLS DETECTED:
${apiRequests.slice(0, 10).map(r => `- ${r.method} ${r.url} [${r.status || 'no response'}]`).join('\n') || 'None'}

FAILED REQUESTS:
${failedRequests.map(r => `- ${r.method} ${r.url} [${r.status}]`).join('\n') || 'None'}

CONSOLE ERRORS:
${errors.join('\n') || 'None'}

CONSOLE MESSAGES:
${consoleMessages.slice(0, 10).map(m => `[${m.type}] ${m.text}`).join('\n') || 'None'}

Provide:
1. HEALTH ASSESSMENT: Overall browser-level health of this page (Good/Warning/Critical)
2. API RISKS: Any concerns about the API calls observed
3. ERROR ANALYSIS: What the console errors indicate if any
4. QA RECOMMENDATIONS: 2-3 specific things to test based on what you observed at the protocol level`
      }
    ]
  });

  const analysis = result.choices[0].message.content!;
  console.log('📋 AI Analysis:\n');
  console.log(analysis);

  // Save report
  const report = `# CDP Inspector Report

**URL:** ${url}
**Date:** ${new Date().toISOString().split('T')[0]}
**Tool:** Chrome DevTools Protocol (CDP) via Playwright

---

## Network Summary
- Total requests captured: ${networkRequests.length}
- API/tRPC calls: ${apiRequests.length}
- Failed requests: ${failedRequests.length}
- Slow requests (>1s): ${slowRequests.length}
- JavaScript errors: ${errors.length}

## API Calls Detected
${apiRequests.map(r => `- \`${r.method}\` ${r.url} [${r.status || 'pending'}]`).join('\n') || 'None detected'}

## Errors
${errors.map(e => `- ${e}`).join('\n') || 'No errors detected'}

## Request Interception
${interceptedLog.map(l => `- ${l}`).join('\n') || 'No requests intercepted'}

## AI Analysis
${analysis}

---
*Generated by AI-Native QA Toolkit — CDP Inspector*
`;

  saveReport('cdp-report.md', report);
}

const url = process.argv[2] || DEFAULT_TARGET_URL;
inspectWithCDP(url).catch(console.error);