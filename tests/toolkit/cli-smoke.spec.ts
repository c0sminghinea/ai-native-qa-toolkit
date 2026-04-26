import { test, expect } from '@playwright/test';
import { spawnSync } from 'child_process';
import * as path from 'path';

// Toolkit smoke tests — exercise the CLI surface itself rather than any
// particular target site. These specs answer the question "does this toolkit
// still ship?" independent of cal.com or any other example.
//
// We invoke each tool with --help so the runs are offline, deterministic,
// and don't need GROQ_API_KEY. The contract we assert:
//   1. `--help` exits 0
//   2. stdout contains a recognisable usage hint
//   3. stderr stays empty (no stack traces, no API client init)

const REPO_ROOT = path.resolve(__dirname, '..', '..');

type Tool = { label: string; entry: string };
const TOOLS: Tool[] = [
  { label: 'generate-tests', entry: 'ai-tools/generate-tests.ts' },
  { label: 'analyze-failure', entry: 'ai-tools/analyze-failure.ts' },
  { label: 'coverage-advisor', entry: 'ai-tools/coverage-advisor.ts' },
  { label: 'visual-regression', entry: 'ai-tools/visual-regression.ts' },
  { label: 'browser-agent', entry: 'ai-tools/browser-agent.ts' },
  { label: 'persona-engine', entry: 'ai-tools/persona-engine.ts' },
  { label: 'data-consistency', entry: 'ai-tools/data-consistency.ts' },
  { label: 'cdp-inspector', entry: 'ai-tools/cdp-inspector.ts' },
  { label: 'locator-healer', entry: 'ai-tools/locator-healer.ts' },
  { label: 'discover-selectors', entry: 'ai-tools/discover-selectors.ts' },
];

test.describe('Toolkit: CLI smoke', () => {
  for (const { label, entry } of TOOLS) {
    test(`${label} --help exits 0 and prints usage`, () => {
      const result = spawnSync('npx', ['tsx', entry, '--help'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        timeout: 60_000,
        // Strip GROQ_API_KEY so we prove the tools don't touch the network on --help.
        env: { ...process.env, GROQ_API_KEY: '' },
      });

      expect(result.status, `stderr was: ${result.stderr}`).toBe(0);
      expect(result.stdout.toLowerCase()).toContain('usage');
      // Lazy LLM clients shouldn't have initialised, so no stack traces should leak.
      expect(result.stderr).not.toMatch(/Error|Traceback|UnhandledPromiseRejection/i);
    });
  }

  test('cli.ts dispatcher prints help and lists every tool', () => {
    const result = spawnSync('npx', ['tsx', 'cli.ts', 'help'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      timeout: 60_000,
      env: { ...process.env, GROQ_API_KEY: '' },
    });
    expect(result.status).toBe(0);
    const out = result.stdout.toLowerCase();
    // Every dispatcher command name must appear in the help output.
    for (const cmd of [
      'generate',
      'analyze',
      'coverage',
      'visual',
      'agent',
      'personas',
      'consistency',
      'cdp',
      'heal',
      'discover',
    ]) {
      expect(out, `cli help missing "${cmd}"`).toContain(cmd);
    }
  });

  test('cli.ts rejects unknown commands with non-zero exit', () => {
    const result = spawnSync('npx', ['tsx', 'cli.ts', '__definitely_not_a_command__'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      timeout: 60_000,
      env: { ...process.env, GROQ_API_KEY: '' },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr.toLowerCase()).toContain('unknown command');
  });
});
