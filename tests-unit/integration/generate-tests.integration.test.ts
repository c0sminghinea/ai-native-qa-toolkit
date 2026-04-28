/**
 * Integration test: drive `generateTests` end-to-end against a static HTML
 * fixture, with the LLM call stubbed. Verifies page exploration, file
 * persistence, and the typecheck gate on AI-generated output.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { serveStaticHtml, captureStdout, type StaticServer } from './helpers';

vi.mock('../../ai-tools/groq-client', () => ({
  groqChat: vi.fn(),
  groqChatJSON: vi.fn(),
  MODELS: { text: 'mock-text-model', vision: 'mock-vision-model' },
}));

import { groqChat } from '../../ai-tools/groq-client';
import { generateTests } from '../../ai-tools/generate-tests';

const FIXTURE_HTML = fs.readFileSync(path.join(__dirname, 'fixtures', 'healer-page.html'), 'utf-8');

// Self-contained TS so the orchestrator's standalone `tsc --noEmit` (which
// does NOT pick up the workspace tsconfig because it's invoked with an
// explicit file argument) succeeds without resolving @playwright/test.
const VALID_SPEC = `// Generated test placeholder
const heading: string = 'Welcome';
const cta: string = 'checkout-cta';
export { heading, cta };
`;

describe('generate-tests integration (mocked LLM)', () => {
  let server: StaticServer;
  let tmpDir: string;
  let outputPath: string;

  beforeAll(async () => {
    server = await serveStaticHtml(FIXTURE_HTML);
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    vi.mocked(groqChat).mockReset();
    // Output must live inside the workspace so the typecheck step (which
    // resolves @playwright/test from node_modules) succeeds. Use a unique
    // filename and clean up after each test.
    tmpDir = path.join(process.cwd(), 'runs', 'tmp-generate-tests');
    fs.mkdirSync(tmpDir, { recursive: true });
    outputPath = path.join(tmpDir, `generated-${Date.now()}.spec.ts`);
  });

  afterEach(() => {
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    const failedPath = outputPath.replace(/\.spec\.ts$/, '.failed.spec.ts');
    if (fs.existsSync(failedPath)) fs.unlinkSync(failedPath);
  });

  it('explores the page, calls the LLM, writes the spec, and typechecks it', async () => {
    vi.mocked(groqChat).mockResolvedValue({
      choices: [{ message: { content: VALID_SPEC } }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const stdout = await captureStdout(async () => {
      await generateTests(server.url, outputPath, {
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
    expect(envelope.bytes).toBeGreaterThan(50);

    expect(fs.existsSync(outputPath)).toBe(true);
    expect(fs.readFileSync(outputPath, 'utf-8')).toContain('checkout-cta');
  }, 120_000);
});
