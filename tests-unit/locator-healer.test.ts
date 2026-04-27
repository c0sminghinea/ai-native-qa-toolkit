import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { extractBrokenSelector } from '../ai-tools/locator-healer';

describe('extractBrokenSelector', () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'healer-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns the input unchanged when no file exists at that path', () => {
    expect(extractBrokenSelector("getByTestId('foo')")).toBe("getByTestId('foo')");
  });

  it('extracts a Locator: line from a Playwright error log file', () => {
    const log = [
      'Test failed',
      "  Locator: page.getByTestId('event-title')",
      'Expected: visible',
    ].join('\n');
    const fp = path.join(tmpDir, 'err.log');
    fs.writeFileSync(fp, log);
    expect(extractBrokenSelector(fp)).toBe("page.getByTestId('event-title')");
  });

  it('falls back to the first known locator method when no Locator: line is present', () => {
    const log = "Some preamble\n  thrown by getByText('Submit Now')\nstack:";
    const fp = path.join(tmpDir, 'err.log');
    fs.writeFileSync(fp, log);
    expect(extractBrokenSelector(fp)).toBe("getByText('Submit Now')");
  });

  it('returns the first 300 chars of the file when no locator pattern matches', () => {
    const log = 'random unrelated content '.repeat(100);
    const fp = path.join(tmpDir, 'err.log');
    fs.writeFileSync(fp, log);
    const out = extractBrokenSelector(fp);
    expect(out.length).toBeLessThanOrEqual(300);
    expect(out.startsWith('random unrelated content')).toBe(true);
  });

  it('caps file reads at 8000 chars to avoid huge log payloads', () => {
    const log = 'x'.repeat(20000) + "\nLocator: getByTestId('late')";
    const fp = path.join(tmpDir, 'err.log');
    fs.writeFileSync(fp, log);
    // The 8000-char window stops before the late Locator: line, so the
    // method-line fallback returns nothing and we get the prefix.
    const out = extractBrokenSelector(fp);
    expect(out).not.toContain('late');
    expect(out.length).toBeLessThanOrEqual(300);
  });
});
