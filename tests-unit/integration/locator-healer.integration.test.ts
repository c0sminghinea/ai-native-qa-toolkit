/**
 * Integration test: drive `healLocator` end-to-end against a static HTML
 * fixture served from an in-process HTTP server, with the LLM call stubbed.
 *
 * Validates the orchestration layer (browser launch, DOM extraction,
 * suggestion verification, report persistence) without flakiness or API
 * spend. This complements the pure unit tests by covering the wiring
 * between `groqChat`, the live page, and the saved markdown report.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { serveStaticHtml, captureStdout, type StaticServer } from './helpers';

// Mock the Groq client module *before* importing the orchestrator so the
// mock is picked up. Hoisted by vitest.
vi.mock('../../ai-tools/groq-client', () => ({
  groqChat: vi.fn(),
  groqChatJSON: vi.fn(),
  MODELS: { text: 'mock-text-model', vision: 'mock-vision-model' },
}));

// Imported after vi.mock so the module under test sees the stubs.
import { groqChat } from '../../ai-tools/groq-client';
import { healLocator } from '../../ai-tools/locator-healer';

const FIXTURE_HTML = fs.readFileSync(path.join(__dirname, 'fixtures', 'healer-page.html'), 'utf-8');

describe('locator-healer integration (mocked LLM)', () => {
  let server: StaticServer;

  beforeAll(async () => {
    server = await serveStaticHtml(FIXTURE_HTML);
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    vi.mocked(groqChat).mockReset();
  });

  it('verifies a visible suggestion against the live page and writes a JSON envelope', async () => {
    vi.mocked(groqChat).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              targetDescription: 'The primary checkout call-to-action button.',
              suggestions: [
                {
                  method: 'getByTestId',
                  args: ['checkout-cta'],
                  description: 'Stable testid wired by the form.',
                  confidence: 'high',
                  playwrightCode: "page.getByTestId('checkout-cta')",
                },
                {
                  method: 'getByTestId',
                  args: ['nav-about'],
                  description: 'Sibling nav link, also stable.',
                  confidence: 'medium',
                  playwrightCode: "page.getByTestId('nav-about')",
                },
                {
                  method: 'getByTestId',
                  args: ['does-not-exist'],
                  description: 'Bogus suggestion to exercise the not-found branch.',
                  confidence: 'low',
                  playwrightCode: "page.getByTestId('does-not-exist')",
                },
              ],
            }),
          },
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const stdout = await captureStdout(async () => {
      await healLocator("getByTestId('old-cta')", server.url, {
        json: true,
        quiet: true,
        help: false,
        stats: false,
        positional: [],
      });
    });

    // The orchestrator must have asked the LLM exactly once.
    expect(vi.mocked(groqChat)).toHaveBeenCalledTimes(1);

    // JSON envelope on stdout
    const envelope = JSON.parse(stdout.trim());
    expect(envelope.ok).toBe(true);
    expect(envelope.targetDescription).toMatch(/checkout/i);
    expect(envelope.suggestions).toHaveLength(3);
    expect(envelope.suggestions[0]).toMatchObject({
      code: "page.getByTestId('checkout-cta')",
      visible: true,
    });
    expect(envelope.suggestions[2]).toMatchObject({
      code: "page.getByTestId('does-not-exist')",
      count: 0,
      visible: false,
    });

    // Report was persisted
    const reportPath = path.join(process.cwd(), envelope.reportPath);
    expect(fs.existsSync(reportPath)).toBe(true);
    const report = fs.readFileSync(reportPath, 'utf-8');
    expect(report).toContain('# AI Locator Healer Report');
    expect(report).toContain("page.getByTestId('checkout-cta')");
    expect(report).toContain('✅ Visible');
  }, 60_000);

  it('exits with code 1 when no suggestion is visible on the page', async () => {
    vi.mocked(groqChat).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              targetDescription: 'A button that does not exist.',
              suggestions: [
                {
                  method: 'getByTestId',
                  args: ['ghost-button'],
                  description: 'Not present in the DOM.',
                  confidence: 'low',
                  playwrightCode: "page.getByTestId('ghost-button')",
                },
              ],
            }),
          },
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`__exit_${code}__`);
    }) as never);

    try {
      await captureStdout(async () => {
        await expect(
          healLocator("getByTestId('ghost-button')", server.url, {
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
  }, 60_000);
});
