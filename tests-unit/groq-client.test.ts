import { describe, it, expect } from 'vitest';
import { shouldRetryError, backoffDelay } from '../ai-tools/groq-client';

describe('shouldRetryError', () => {
  it('retries on 429 (rate limit)', () => {
    expect(shouldRetryError({ status: 429 })).toBe(true);
  });

  it('retries on every 5xx', () => {
    for (const status of [500, 502, 503, 504, 599]) {
      expect(shouldRetryError({ status })).toBe(true);
    }
  });

  it('does not retry on 4xx other than 429', () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(shouldRetryError({ status })).toBe(false);
    }
  });

  it('does not retry on 6xx or unknown statuses', () => {
    expect(shouldRetryError({ status: 600 })).toBe(false);
    expect(shouldRetryError({ status: 0 })).toBe(false);
  });

  it('does not retry on errors without a status field', () => {
    expect(shouldRetryError(new Error('boom'))).toBe(false);
    expect(shouldRetryError(null)).toBe(false);
    expect(shouldRetryError(undefined)).toBe(false);
  });
});

describe('backoffDelay', () => {
  it('starts at 1s and doubles', () => {
    expect(backoffDelay(0)).toBe(1000);
    expect(backoffDelay(1)).toBe(2000);
    expect(backoffDelay(2)).toBe(4000);
  });

  it('caps at 8s', () => {
    expect(backoffDelay(3)).toBe(8000);
    expect(backoffDelay(10)).toBe(8000);
    expect(backoffDelay(100)).toBe(8000);
  });
});
