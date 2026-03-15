#!/usr/bin/env npx tsx

import { execSync } from 'child_process';
import * as path from 'path';

const args = process.argv.slice(2);
const command = args[0];
const rest = args.slice(1).join(' ');

const tools: Record<string, string> = {
  'generate':    `npx tsx ai-tools/generate-tests.ts ${rest}`,
  'analyze':     `npx tsx ai-tools/analyze-failure.ts ${rest}`,
  'coverage':    `npx tsx ai-tools/coverage-advisor.ts ${rest}`,
  'visual':      `npx tsx ai-tools/visual-regression.ts ${rest}`,
  'agent':       `npx tsx ai-tools/browser-agent.ts ${rest}`,
  'personas':    `npx tsx ai-tools/persona-engine.ts ${rest}`,
  'consistency': `npx tsx ai-tools/data-consistency.ts ${rest}`,
  'cdp':         `npx tsx ai-tools/cdp-inspector.ts ${rest}`,
  'mcp':         `npx tsx mcp-playwright-demo.ts ${rest}`,
  'test':        `npx playwright test ${rest}`,
  'report':      `npx playwright show-report`,
};

const descriptions: Record<string, string> = {
  'generate':    'Generate Playwright tests from a URL',
  'analyze':     'Analyze a test failure and get a fix',
  'coverage':    'Score test coverage and get missing tests',
  'visual':      'AI vision analysis across viewports',
  'agent':       'Autonomous browser agent',
  'personas':    'Synthetic persona engine',
  'consistency': 'Data consistency checker',
  'cdp':         'CDP browser protocol inspector',
  'mcp':         'Playwright MCP server demo',
  'test':        'Run the Playwright test suite',
  'report':      'Open the Playwright trace viewer',
};

if (!command || command === 'help' || command === '--help') {
  console.log('\n🧪 AI-Native QA Toolkit\n');
  console.log('Usage: npx tsx cli.ts <command> [options]\n');
  console.log('Commands:');
  Object.entries(descriptions).forEach(([cmd, desc]) => {
    console.log(`  ${cmd.padEnd(14)} ${desc}`);
  });
  console.log('\nExamples:');
  console.log('  npx tsx cli.ts generate https://cal.com/bailey/chat');
  console.log('  npx tsx cli.ts analyze');
  console.log('  npx tsx cli.ts visual https://cal.com/bailey/chat');
  console.log('  npx tsx cli.ts agent "verify booking flow" https://cal.com/bailey/chat');
  console.log('  npx tsx cli.ts test');
  console.log('  npx tsx cli.ts report\n');
  process.exit(0);
}

if (!tools[command]) {
  console.error(`\n❌ Unknown command: "${command}"`);
  console.error('   Run "npx tsx cli.ts help" to see available commands\n');
  process.exit(1);
}

try {
  execSync(tools[command], { stdio: 'inherit', cwd: path.resolve(__dirname) });
} catch (err) {
  process.exit(1);
}