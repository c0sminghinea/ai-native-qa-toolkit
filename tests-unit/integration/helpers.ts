/**
 * Helpers for integration tests.
 *
 * Integration tests in this directory stub the LLM provider and drive 1-2
 * tools end-to-end against a static HTML fixture served from an in-process
 * HTTP server on a random port. The goal is to cover the orchestration
 * layer (browser launch, DOM extraction, locator verification, report
 * persistence) without flakiness or API spend.
 */
import * as http from 'http';
import { AddressInfo } from 'net';

export interface StaticServer {
  /** Fully-qualified URL of the served page, e.g. `http://127.0.0.1:54321/`. */
  url: string;
  /** Stop the server. Always call from `afterAll`/`afterEach`. */
  close(): Promise<void>;
}

/**
 * Start a tiny HTTP server that returns `html` for any request, listening
 * on a random free port. Use this in integration tests to give Playwright
 * a stable, offline target.
 */
export async function serveStaticHtml(html: string): Promise<StaticServer> {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}/`,
    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close(err => (err ? reject(err) : resolve()));
      });
    },
  };
}

/**
 * Capture stdout writes during `fn`, restore the original writer on exit,
 * and return the captured text. Used to assert the `--json` envelope of
 * tools without polluting the test runner's stdout.
 */
export async function captureStdout(fn: () => Promise<void>): Promise<string> {
  const original = process.stdout.write.bind(process.stdout);
  let buffer = '';
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    buffer += typeof chunk === 'string' ? chunk : chunk.toString();
    return true;
  }) as typeof process.stdout.write;
  try {
    await fn();
  } finally {
    process.stdout.write = original;
  }
  return buffer;
}
