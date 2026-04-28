/**
 * Integration test: drive `analyzeFailure` end-to-end with the LLM call
 * stubbed. No browser — just file I/O + LLM + report persistence.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { captureStdout } from './helpers';

vi.mock('../../ai-tools/groq-client', () => ({
  groqChat: vi.fn(),
  groqChatJSON: vi.fn(),
  MODELS: { text: 'mock-text-model', vision: 'mock-vision-model' },
}));

import { groqChat } from '../../ai-tools/groq-client';
import { analyzeFailure } from '../../ai-tools/analyze-failure';

describe('analyze-failure integration (mocked LLM)', () => {
  let tmpDir: string;
  let testFile: string;

  beforeEach(() => {
    vi.mocked(groqChat).mockReset();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'analyze-failure-'));
    testFile = path.join(tmpDir, 'sample.spec.ts');
    fs.writeFileSync(
      testFile,
      "import { test, expect } from '@playwright/test';\ntest('demo', async ({ page }) => { await page.goto('/'); });\n"
    );
  });

  it('reads the test file, calls the LLM, and persists a report', async () => {
    vi.mocked(groqChat).mockResolvedValue({
      choices: [
        {
          message: {
            content:
              '1. ROOT CAUSE: getByText is not strict.\n2. FIX: Use getByTestId.\n3. PREVENTION: Prefer testids.',
          },
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const stdout = await captureStdout(async () => {
      await analyzeFailure('Error: locator resolved to 2 elements', testFile, {
        json: true,
        quiet: true,
        help: false,
        stats: false,
        positional: [],
      });
    });

    expect(vi.mocked(groqChat)).toHaveBeenCalledTimes(1);
    const envelope = JSON.parse(stdout.trim());
    expect(envelope.ok).toBe(true);
    expect(envelope.analysis).toContain('ROOT CAUSE');

    const reportPath = path.join(process.cwd(), envelope.reportPath);
    expect(fs.existsSync(reportPath)).toBe(true);
    expect(fs.readFileSync(reportPath, 'utf-8')).toContain('# Failure Analysis Report');
  });

  it('rejects an empty error log via handleToolError (process.exit(1))', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`__exit_${code}__`);
    }) as never);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await expect(
        analyzeFailure('   ', testFile, {
          json: false,
          quiet: true,
          help: false,
          stats: false,
          positional: [],
        })
      ).rejects.toThrow('__exit_1__');
    } finally {
      exitSpy.mockRestore();
      errSpy.mockRestore();
    }
  });
});
