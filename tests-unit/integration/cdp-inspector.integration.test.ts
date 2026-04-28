/**
 * Integration test: drive `inspectWithCDP` end-to-end against a static
 * HTML fixture, with the LLM call stubbed. Verifies CDP session setup,
 * network/console capture, and report persistence.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { serveStaticHtml, captureStdout, type StaticServer } from './helpers';

vi.mock('../../ai-tools/groq-client', () => ({
  groqChat: vi.fn(),
  groqChatJSON: vi.fn(),
  MODELS: { text: 'mock-text-model', vision: 'mock-vision-model' },
}));

import { groqChat } from '../../ai-tools/groq-client';
import { inspectWithCDP } from '../../ai-tools/cdp-inspector';

const FIXTURE_HTML = fs.readFileSync(path.join(__dirname, 'fixtures', 'healer-page.html'), 'utf-8');

describe('cdp-inspector integration (mocked LLM)', () => {
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

  it('opens a CDP session, captures events, and persists a report', async () => {
    vi.mocked(groqChat).mockResolvedValue({
      choices: [
        {
          message: {
            content:
              '1. HEALTH ASSESSMENT: Good\n2. API RISKS: None observed\n3. ERROR ANALYSIS: No errors\n4. QA RECOMMENDATIONS: Add a 404 test, verify retries, check timeouts.',
          },
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const stdout = await captureStdout(async () => {
      await inspectWithCDP(server.url, {
        json: true,
        quiet: true,
        help: false,
        stats: false,
        positional: [],
      });
    });

    expect(vi.mocked(groqChat)).toHaveBeenCalledTimes(1);
    const envelope = JSON.parse(stdout.trim());
    expect(envelope).toMatchObject({
      ok: true,
      url: server.url,
      jsErrors: 0,
    });
    expect(envelope.totalRequests).toBeGreaterThan(0);

    const reportPath = path.join(process.cwd(), envelope.reportPath);
    expect(fs.existsSync(reportPath)).toBe(true);
    const report = fs.readFileSync(reportPath, 'utf-8');
    expect(report).toContain('# CDP Inspector Report');
    expect(report).toContain('HEALTH ASSESSMENT');
  }, 60_000);
});
