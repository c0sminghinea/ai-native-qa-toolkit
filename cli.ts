#!/usr/bin/env npx tsx

import { spawnSync } from 'child_process';
import * as path from 'path';

const args = process.argv.slice(2);
const command = args[0];
// Keep extra args as an array — never interpolate user input into a shell string
const extraArgs = args.slice(1);

const toolCommands: Record<string, string[]> = {
  'generate':    ['npx', 'tsx', 'ai-tools/generate-tests.ts', ...extraArgs],
  'analyze':     ['npx', 'tsx', 'ai-tools/analyze-failure.ts', ...extraArgs],
  'coverage':    ['npx', 'tsx', 'ai-tools/coverage-advisor.ts', ...extraArgs],
  'visual':      ['npx', 'tsx', 'ai-tools/visual-regression.ts', ...extraArgs],
  'agent':       ['npx', 'tsx', 'ai-tools/browser-agent.ts', ...extraArgs],
  'personas':    ['npx', 'tsx', 'ai-tools/persona-engine.ts', ...extraArgs],
  'consistency': ['npx', 'tsx', 'ai-tools/data-consistency.ts', ...extraArgs],
  'cdp':         ['npx', 'tsx', 'ai-tools/cdp-inspector.ts', ...extraArgs],
  'heal':        ['npx', 'tsx', 'ai-tools/locator-healer.ts', ...extraArgs],
  'mcp':         ['npx', 'tsx', 'mcp-playwright-demo.ts', ...extraArgs],
  'test':        ['npx', 'playwright', 'test', ...extraArgs],
  'report':      ['npx', 'playwright', 'show-report'],
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
  'heal':        'Heal broken locators with AI suggestions',
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

if (!toolCommands[command]) {
  console.error(`\n❌ Unknown command: "${command}"`);
  console.error('   Run "npx tsx cli.ts help" to see available commands\n');
  process.exit(1);
}

try {
  const [bin, ...binArgs] = toolCommands[command];
  const result = spawnSync(bin, binArgs, {
    stdio: 'inherit',
    cwd: path.resolve(__dirname),
    shell: false,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
} catch (err) {
  process.exit(1);
}