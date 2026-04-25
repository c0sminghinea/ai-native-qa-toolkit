import { describe, it, expect } from 'vitest';
import * as path from 'path';
import {
  isHttpUrl,
  isSafeSelector,
  isPathInsideWorkspace,
  parseAIJson,
  parseCliFlags,
} from '../ai-tools/tool-utils';

describe('isHttpUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isHttpUrl('http://example.com')).toBe(true);
    expect(isHttpUrl('https://example.com/path?q=1')).toBe(true);
  });

  it('rejects URLs with non-http protocols even if they start with "http"', () => {
    expect(isHttpUrl('httpfoo://example.com')).toBe(false);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects non-strings and malformed URLs', () => {
    expect(isHttpUrl(undefined)).toBe(false);
    // @ts-expect-error - testing runtime guard against non-string input
    expect(isHttpUrl(123)).toBe(false);
    expect(isHttpUrl('not a url')).toBe(false);
    expect(isHttpUrl('')).toBe(false);
  });
});

describe('isSafeSelector', () => {
  it('accepts simple selectors', () => {
    expect(isSafeSelector('button.primary')).toBe(true);
    expect(isSafeSelector('[data-testid="submit"]')).toBe(true);
  });

  it('rejects selectors with script tags or javascript:', () => {
    expect(isSafeSelector('<script>alert(1)</script>')).toBe(false);
    expect(isSafeSelector("a[href='javascript:alert(1)']")).toBe(false);
  });

  it('rejects empty / non-string / overlong selectors', () => {
    expect(isSafeSelector('')).toBe(false);
    expect(isSafeSelector(undefined)).toBe(false);
    expect(isSafeSelector('a'.repeat(501))).toBe(false);
  });

  it('rejects event-handler attribute injection', () => {
    expect(isSafeSelector('button[onclick*="alert(1)"]')).toBe(false);
    expect(isSafeSelector('div[onerror=x]')).toBe(false);
    expect(isSafeSelector('a[onmouseover="evil()"]')).toBe(false);
  });

  it('rejects javascript: and data: URIs in attribute selectors', () => {
    expect(isSafeSelector('a[href*="javascript:"]')).toBe(false);
    expect(isSafeSelector('iframe[src="data:text/html,<script>"]')).toBe(false);
  });
});

describe('isPathInsideWorkspace', () => {
  const cwd = process.cwd();

  it('accepts paths inside the workspace', () => {
    expect(isPathInsideWorkspace(path.join(cwd, 'tests', 'foo.spec.ts'))).toBe(true);
  });

  it('rejects paths outside the workspace', () => {
    expect(isPathInsideWorkspace('/etc/passwd')).toBe(false);
    expect(isPathInsideWorkspace(path.join(cwd, '..', 'other'))).toBe(false);
  });
});

describe('parseAIJson', () => {
  it('parses raw JSON object', () => {
    expect(parseAIJson<{ a: number }>('{"a": 1}')).toEqual({ a: 1 });
  });

  it('parses JSON wrapped in prose / markdown', () => {
    const text = 'Sure! Here\'s the result:\n```json\n{"ok": true}\n```\nLet me know.';
    expect(parseAIJson<{ ok: boolean }>(text)).toEqual({ ok: true });
  });

  it('parses JSON arrays when opener is "["', () => {
    expect(parseAIJson<number[]>('Some text [1, 2, 3] tail', '[')).toEqual([1, 2, 3]);
  });

  it('throws on missing JSON', () => {
    expect(() => parseAIJson('no json here')).toThrow();
  });
});

describe('parseCliFlags', () => {
  it('detects --json / --quiet / --help', () => {
    const f = parseCliFlags(['--json', '--quiet', '--help']);
    expect(f.json).toBe(true);
    expect(f.quiet).toBe(true);
    expect(f.help).toBe(true);
    expect(f.positional).toEqual([]);
  });

  it('supports short flags -q -h', () => {
    const f = parseCliFlags(['-q', '-h']);
    expect(f.quiet).toBe(true);
    expect(f.help).toBe(true);
  });

  it('separates positional args from flags', () => {
    const f = parseCliFlags(['goal', '--json', 'https://example.com']);
    expect(f.json).toBe(true);
    expect(f.positional).toEqual(['goal', 'https://example.com']);
  });

  it('returns falsy defaults when no flags', () => {
    const f = parseCliFlags([]);
    expect(f).toEqual({ json: false, quiet: false, help: false, stats: false, positional: [] });
  });
});
