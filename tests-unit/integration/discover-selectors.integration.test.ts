/**
 * Integration test: drive `discoverSelectors` end-to-end against a static
 * HTML fixture, with the LLM call stubbed. Verifies browser launch, DOM
 * snapshot capture, role->testid mapping, and selectors.json persistence.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { serveStaticHtml, captureStdout, type StaticServer } from './helpers';

vi.mock('../../ai-tools/groq-client', () => ({
  groqChat: vi.fn(),
  groqChatJSON: vi.fn(),
  MODELS: { text: 'mock-text-model', vision: 'mock-vision-model' },
}));

import { groqChatJSON } from '../../ai-tools/groq-client';
import { discoverSelectors } from '../../ai-tools/discover-selectors';

const FIXTURE_HTML = fs.readFileSync(path.join(__dirname, 'fixtures', 'healer-page.html'), 'utf-8');

describe('discover-selectors integration (mocked LLM)', () => {
  let server: StaticServer;
  let tmpDir: string;
  let outputPath: string;
  let rolesPath: string;

  beforeAll(async () => {
    server = await serveStaticHtml(FIXTURE_HTML);
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    vi.mocked(groqChatJSON).mockReset();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'discover-'));
    outputPath = path.join(tmpDir, 'selectors.json');
    rolesPath = path.join(tmpDir, 'roles.json');
    fs.writeFileSync(
      rolesPath,
      JSON.stringify({
        CHECKOUT_CTA: 'The primary call-to-action button on the page.',
        NAV_ABOUT: 'The About link in the navigation.',
      })
    );
  });

  it('maps roles to testids and writes selectors.json', async () => {
    vi.mocked(groqChatJSON).mockResolvedValue({
      CHECKOUT_CTA: 'checkout-cta',
      NAV_ABOUT: 'nav-about',
    });

    const stdout = await captureStdout(async () => {
      await discoverSelectors(
        server.url,
        outputPath,
        { json: true, quiet: true, help: false, stats: false, positional: [] },
        rolesPath
      );
    });

    expect(vi.mocked(groqChatJSON)).toHaveBeenCalledTimes(1);
    const envelope = JSON.parse(stdout.trim());
    expect(envelope).toMatchObject({
      ok: true,
      matched: 2,
      total: 2,
      mapping: { CHECKOUT_CTA: 'checkout-cta', NAV_ABOUT: 'nav-about' },
    });

    expect(fs.existsSync(outputPath)).toBe(true);
    const written = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    expect(written.CHECKOUT_CTA).toBe('checkout-cta');
    expect(written.NAV_ABOUT).toBe('nav-about');
  }, 60_000);

  it('exits with code 1 when no roles can be mapped', async () => {
    vi.mocked(groqChatJSON).mockResolvedValue({
      CHECKOUT_CTA: null,
      NAV_ABOUT: null,
    });

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`__exit_${code}__`);
    }) as never);

    try {
      await captureStdout(async () => {
        await expect(
          discoverSelectors(
            server.url,
            outputPath,
            { json: true, quiet: true, help: false, stats: false, positional: [] },
            rolesPath
          )
        ).rejects.toThrow('__exit_1__');
      });
    } finally {
      exitSpy.mockRestore();
    }
  }, 60_000);
});
