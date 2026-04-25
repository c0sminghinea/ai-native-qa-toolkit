import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadChecksConfig, defaultChecks, extractChecksFlag } from '../ai-tools/checks-config';

describe('extractChecksFlag', () => {
  it('reads space-separated --checks <path>', () => {
    expect(extractChecksFlag(['--checks', '/tmp/x.json'])).toBe('/tmp/x.json');
  });
  it('reads --checks=<path> form', () => {
    expect(extractChecksFlag(['--checks=/tmp/y.json'])).toBe('/tmp/y.json');
  });
  it('returns undefined when absent', () => {
    expect(extractChecksFlag(['--quiet'])).toBeUndefined();
  });
});

describe('defaultChecks', () => {
  it('returns the bundled cal.com preset with at least one check', () => {
    const checks = defaultChecks();
    expect(checks.length).toBeGreaterThan(0);
    for (const c of checks) {
      expect(c.key).toBeTruthy();
      expect(c.pages.length).toBeGreaterThan(0);
      for (const p of c.pages) {
        expect(p.url).toMatch(/^https?:/);
      }
    }
  });
});

describe('loadChecksConfig', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-checks-'));
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('falls back to bundled defaults when no file is present', () => {
    process.chdir(tmpDir);
    const { checks, source } = loadChecksConfig();
    expect(checks.length).toBeGreaterThan(0);
    expect(source).toMatch(/bundled defaults/);
  });

  it('loads and expands TARGET placeholders', () => {
    const cfg = {
      checks: [
        {
          key: 'host name',
          pages: [
            { name: 'Profile', url: '{TARGET.profileUrl}', description: '' },
            { name: 'Booking', url: '{TARGET.bookingUrl}', description: '' },
          ],
        },
      ],
    };
    const filePath = path.join(tmpDir, 'qa-checks.json');
    fs.writeFileSync(filePath, JSON.stringify(cfg));
    const { checks } = loadChecksConfig(filePath);
    expect(checks).toHaveLength(1);
    expect(checks[0].pages[0].url).toMatch(/^https?:/);
    expect(checks[0].pages[1].url).toMatch(/^https?:/);
    expect(checks[0].pages[0].url).not.toContain('{TARGET');
  });

  it('throws on invalid schema with details', () => {
    const filePath = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(filePath, JSON.stringify({ checks: [{ key: 'x' }] }));
    expect(() => loadChecksConfig(filePath)).toThrow(/Invalid checks config/);
  });

  it('throws when explicit path is missing', () => {
    expect(() => loadChecksConfig(path.join(tmpDir, 'nope.json'))).toThrow(/not found/);
  });
});
