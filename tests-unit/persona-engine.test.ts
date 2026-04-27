import { describe, it, expect } from 'vitest';
import { safeTimezoneId, timezoneToLocale, runWithConcurrency } from '../ai-tools/persona-engine';

describe('safeTimezoneId', () => {
  it('returns a valid IANA timezone unchanged', () => {
    expect(safeTimezoneId('America/New_York')).toBe('America/New_York');
    expect(safeTimezoneId('Europe/Berlin')).toBe('Europe/Berlin');
  });
  it('falls back to UTC for invalid timezones', () => {
    expect(safeTimezoneId('Mars/Olympus_Mons')).toBe('UTC');
    expect(safeTimezoneId('not a timezone')).toBe('UTC');
  });
});

describe('timezoneToLocale', () => {
  it.each([
    ['America/New_York', 'en-US'],
    ['Europe/London', 'en-GB'],
    ['Australia/Sydney', 'en-AU'],
    ['Pacific/Auckland', 'en-NZ'],
    ['Africa/Johannesburg', 'en-ZA'],
    ['Asia/Tokyo', 'en-IN'],
    ['Antarctica/McMurdo', 'en-US'],
  ])('maps %s -> %s', (tz, expected) => {
    expect(timezoneToLocale(tz)).toBe(expected);
  });
});

describe('runWithConcurrency', () => {
  it('returns results in input order', async () => {
    const tasks = [1, 2, 3, 4, 5].map(n => async () => n * 2);
    const out = await runWithConcurrency(tasks, 2);
    expect(out).toEqual([2, 4, 6, 8, 10]);
  });

  it('respects the concurrency cap', async () => {
    let inFlight = 0;
    let peak = 0;
    const tasks = Array.from({ length: 10 }, () => async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise(r => setTimeout(r, 10));
      inFlight--;
      return inFlight;
    });
    await runWithConcurrency(tasks, 3);
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(0);
  });

  it('handles empty task lists', async () => {
    const out = await runWithConcurrency([], 4);
    expect(out).toEqual([]);
  });

  it('caps workers at the task count when concurrency exceeds tasks', async () => {
    const tasks = [async () => 'only'];
    const out = await runWithConcurrency(tasks, 99);
    expect(out).toEqual(['only']);
  });

  it('propagates rejections', async () => {
    const tasks = [
      async () => 'ok',
      async () => {
        throw new Error('boom');
      },
    ];
    await expect(runWithConcurrency(tasks, 2)).rejects.toThrow(/boom/);
  });
});
