import { describe, it, expect } from 'vitest';
import { categorizeRequests } from '../ai-tools/cdp-inspector';

const req = (over: Partial<Parameters<typeof categorizeRequests>[0][number]> = {}) => ({
  requestId: 'r',
  url: 'https://example.com/',
  method: 'GET',
  resourceType: 'xhr',
  ...over,
});

describe('categorizeRequests', () => {
  it('flags /api/, trpc, and graphql URLs as API requests', () => {
    const { apiRequests } = categorizeRequests([
      req({ url: 'https://example.com/api/users' }),
      req({ url: 'https://example.com/trpc/booking.create' }),
      req({ url: 'https://example.com/graphql' }),
      req({ url: 'https://example.com/static/main.js' }),
    ]);
    expect(apiRequests).toHaveLength(3);
    expect(apiRequests.map(r => r.url)).not.toContain('https://example.com/static/main.js');
  });

  it('flags 4xx and 5xx responses as failures', () => {
    const { failedRequests } = categorizeRequests([
      req({ status: 200 }),
      req({ status: 404 }),
      req({ status: 500 }),
      req({}), // pending — undefined status
    ]);
    expect(failedRequests.map(r => r.status)).toEqual([404, 500]);
  });

  it('does not treat 3xx redirects as failures', () => {
    const { failedRequests } = categorizeRequests([req({ status: 301 }), req({ status: 399 })]);
    expect(failedRequests).toHaveLength(0);
  });

  it('flags requests with timing > 1000ms as slow', () => {
    const { slowRequests } = categorizeRequests([
      req({ timing: 200 }),
      req({ timing: 1001 }),
      req({ timing: 5000 }),
      req({}), // no timing — never slow
    ]);
    expect(slowRequests.map(r => r.timing)).toEqual([1001, 5000]);
  });

  it('returns empty buckets for an empty input list', () => {
    const { apiRequests, failedRequests, slowRequests } = categorizeRequests([]);
    expect(apiRequests).toEqual([]);
    expect(failedRequests).toEqual([]);
    expect(slowRequests).toEqual([]);
  });
});
