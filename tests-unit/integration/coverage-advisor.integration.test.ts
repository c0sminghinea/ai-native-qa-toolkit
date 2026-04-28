/**
 * Integration test: drive `adviseCoverage` end-to-end against a static
 * Playwright spec fixture, with the LLM call stubbed.
 *
 * Validates the orchestration layer (file I/O, POM/suite context
 * collection, schema-validated LLM call, report persistence) without
 * flakiness or API spend.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { captureStdout } from './helpers';

vi.mock('../../ai-tools/groq-client', () => ({
  groqChat: vi.fn(),
  groqChatJSON: vi.fn(),
  MODELS: { text: 'mock-text-model', vision: 'mock-vision-model' },
}));

import { groqChatJSON } from '../../ai-tools/groq-client';
import { adviseCoverage } from '../../ai-tools/coverage-advisor';

const FIXTURE_SPEC = path.join(__dirname, 'fixtures', 'sample.spec.ts');

describe('coverage-advisor integration (mocked LLM)', () => {
  beforeEach(() => {
    vi.mocked(groqChatJSON).mockReset();
  });

  it('passes the spec to the LLM, persists a report, and emits a JSON envelope', async () => {
    vi.mocked(groqChatJSON).mockResolvedValue({
      score: 8,
      whatIsCovered: ['Heading renders', 'Primary CTA is visible'],
      criticalGaps: [
        'No assertion that submitting the form navigates forward',
        'No keyboard-accessibility check on the CTA',
      ],
      topTestsToAdd: [
        {
          name: 'submitting the form advances to the confirmation step',
          why: 'Covers the happy-path navigation that users actually rely on.',
          code: "test('submits the form', async ({ page }) => { await page.goto('/'); await page.getByTestId('checkout-cta').click(); });",
        },
      ],
    });

    const stdout = await captureStdout(async () => {
      await adviseCoverage(FIXTURE_SPEC, {
        json: true,
        quiet: true,
        help: false,
        stats: false,
        positional: [],
      });
    });

    // LLM was called exactly once with a Zod schema as the second arg.
    expect(vi.mocked(groqChatJSON)).toHaveBeenCalledTimes(1);
    const [requestArg, schemaArg] = vi.mocked(groqChatJSON).mock.calls[0];
    expect(requestArg.model).toBe('mock-text-model');
    // Schema is a Zod object — has a parse function.
    expect(typeof (schemaArg as { parse?: unknown }).parse).toBe('function');
    // The user-message body should embed the spec under <TEST> tags.
    const userMsg = requestArg.messages.find(m => m.role === 'user');
    expect(userMsg?.content).toContain('<TEST>');
    expect(userMsg?.content).toContain('</TEST>');
    expect(userMsg?.content).toContain('renders the page heading');

    // JSON envelope on stdout
    const envelope = JSON.parse(stdout.trim());
    expect(envelope).toMatchObject({
      ok: true,
      score: 8,
      testFile: FIXTURE_SPEC,
    });
    expect(envelope.reportPath).toMatch(/coverage-sample-report\.md$/);

    // Report was persisted with the mocked LLM payload.
    const reportPath = path.join(process.cwd(), envelope.reportPath);
    expect(fs.existsSync(reportPath)).toBe(true);
    const report = fs.readFileSync(reportPath, 'utf-8');
    expect(report).toContain('**Score:** 8/10');
    expect(report).toContain('No keyboard-accessibility check on the CTA');
    expect(report).toContain('submitting the form advances to the confirmation step');
  });

  it('exits with code 1 when the score is at or below 5', async () => {
    vi.mocked(groqChatJSON).mockResolvedValue({
      score: 3,
      whatIsCovered: [],
      criticalGaps: ['Almost nothing is tested'],
      topTestsToAdd: [],
    });

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`__exit_${code}__`);
    }) as never);

    try {
      await captureStdout(async () => {
        await expect(
          adviseCoverage(FIXTURE_SPEC, {
            json: true,
            quiet: true,
            help: false,
            stats: false,
            positional: [],
          })
        ).rejects.toThrow('__exit_1__');
      });
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      exitSpy.mockRestore();
    }
  });
});
