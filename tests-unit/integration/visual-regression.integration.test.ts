/**
 * Integration test: drive `compareViewports` end-to-end against a static
 * HTML fixture, with the vision LLM call stubbed. Verifies multi-viewport
 * screenshot capture, score parsing, and report persistence.
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
import { compareViewports } from '../../ai-tools/visual-regression';

const FIXTURE_HTML = fs.readFileSync(path.join(__dirname, 'fixtures', 'healer-page.html'), 'utf-8');

describe('visual-regression integration (mocked LLM)', () => {
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

  it('captures three viewports, calls vision LLM per viewport, and writes a report', async () => {
    vi.mocked(groqChat).mockResolvedValue({
      choices: [
        {
          message: {
            content: 'Layout looks good. Score: 8/10. CTA is visible at all sizes.',
          },
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const stdout = await captureStdout(async () => {
      await compareViewports(server.url, {
        json: true,
        quiet: true,
        help: false,
        stats: false,
        positional: [],
      });
    });

    // One LLM call per viewport (3).
    expect(vi.mocked(groqChat)).toHaveBeenCalledTimes(3);
    const envelope = JSON.parse(stdout.trim());
    expect(envelope.ok).toBe(true);
    expect(envelope.worstScore).toBe(8);
    expect(envelope.viewports).toHaveLength(3);
    expect(envelope.viewports.map((v: { viewport: string }) => v.viewport)).toEqual([
      'Desktop (1280x720)',
      'Tablet (768x1024)',
      'Mobile (375x812)',
    ]);

    const reportPath = path.join(process.cwd(), envelope.reportPath);
    expect(fs.existsSync(reportPath)).toBe(true);
    expect(fs.readFileSync(reportPath, 'utf-8')).toContain('# AI Visual Regression Report');
  }, 90_000);
});
