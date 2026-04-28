/**
 * Integration test: drive `runAgent` end-to-end against a static HTML
 * fixture, with the LLM call stubbed. The mocked `decideNextAction`
 * returns `done` on step 1 so the agent loop exits cleanly without
 * `process.exit`.
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
import { runAgent } from '../../ai-tools/browser-agent';

const FIXTURE_HTML = fs.readFileSync(path.join(__dirname, 'fixtures', 'healer-page.html'), 'utf-8');

describe('browser-agent integration (mocked LLM)', () => {
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

  it('runs the agent loop, persists a report, and emits a JSON envelope on success', async () => {
    vi.mocked(groqChat).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              action: 'done',
              reason: 'Heading is visible',
              finding: 'Page renders the welcome heading',
            }),
          },
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const stdout = await captureStdout(async () => {
      await runAgent('Verify heading renders', server.url, 3, {
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
      finding: 'Page renders the welcome heading',
    });

    const reportPath = path.join(process.cwd(), envelope.reportPath);
    expect(fs.existsSync(reportPath)).toBe(true);
    expect(fs.readFileSync(reportPath, 'utf-8')).toContain('# Autonomous QA Agent Report');
  }, 60_000);
});
