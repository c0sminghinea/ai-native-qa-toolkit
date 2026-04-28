/**
 * Integration test: drive `runDataConsistencyCheck` end-to-end against
 * static HTML fixtures, with the LLM calls stubbed. Verifies the
 * multi-page extraction, consistency analysis, and report persistence.
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

import { groqChat, groqChatJSON } from '../../ai-tools/groq-client';
import { runDataConsistencyCheck } from '../../ai-tools/data-consistency';

const PAGE_A = `
<!doctype html><html><body>
  <h1>Listing</h1>
  <p>Price: $42</p>
  <p>Rating: 4.8</p>
</body></html>
`;

const PAGE_B = `
<!doctype html><html><body>
  <h1>Profile</h1>
  <p>Price: $42</p>
  <p>Rating: 4.8</p>
</body></html>
`;

describe('data-consistency integration (mocked LLM)', () => {
  let serverA: StaticServer;
  let serverB: StaticServer;

  beforeAll(async () => {
    serverA = await serveStaticHtml(PAGE_A);
    serverB = await serveStaticHtml(PAGE_B);
  });

  afterAll(async () => {
    await serverA.close();
    await serverB.close();
  });

  beforeEach(() => {
    vi.mocked(groqChat).mockReset();
    vi.mocked(groqChatJSON).mockReset();
  });

  it('extracts data from each page once, analyses consistency, and persists a report', async () => {
    // Per-page extraction returns the same values on both pages.
    vi.mocked(groqChatJSON).mockResolvedValue({
      values: { Price: '$42', Rating: '4.8' },
    });
    // analyzeConsistency LLM call
    vi.mocked(groqChat).mockResolvedValue({
      choices: [
        {
          message: {
            content:
              '1. CONSISTENCY STATUS: Yes\n2. RISK LEVEL: Low\n3. IMPACT: None\n4. RECOMMENDATION: Keep monitoring.',
          },
        },
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const stdout = await captureStdout(async () => {
      await runDataConsistencyCheck(
        [
          {
            key: 'Price',
            pages: [
              { name: 'Listing', url: serverA.url, description: 'Listing page' },
              { name: 'Profile', url: serverB.url, description: 'Profile page' },
            ],
          },
          {
            key: 'Rating',
            pages: [
              { name: 'Listing', url: serverA.url, description: 'Listing page' },
              { name: 'Profile', url: serverB.url, description: 'Profile page' },
            ],
          },
        ],
        { json: true, quiet: true, help: false, stats: false, positional: [] }
      );
    });

    // Extraction is one call per unique page (2), then two consistency analyses.
    expect(vi.mocked(groqChatJSON)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(groqChat)).toHaveBeenCalledTimes(2);

    const envelope = JSON.parse(stdout.trim());
    expect(envelope).toMatchObject({
      ok: true,
      consistent: 2,
      inconsistent: 0,
      total: 2,
    });

    const reportPath = path.join(process.cwd(), envelope.reportPath);
    expect(fs.existsSync(reportPath)).toBe(true);
    expect(fs.readFileSync(reportPath, 'utf-8')).toContain('# Data Consistency Report');
  }, 90_000);
});
