import { describe, it, expect } from 'vitest';
import { detectInconsistency, type DataPoint } from '../ai-tools/data-consistency';

const dp = (over: Partial<DataPoint>): DataPoint => ({
  page: 'p',
  url: 'https://example.com/',
  value: null,
  context: '',
  found: false,
  ...over,
});

describe('detectInconsistency', () => {
  it('flags missing on every page as inconsistent with reason="missing"', () => {
    const result = detectInconsistency('host name', [
      dp({ page: 'A', found: false }),
      dp({ page: 'B', found: false }),
    ]);
    expect(result.consistent).toBe(false);
    expect(result.reason).toBe('missing');
    expect(result.discrepancies).toEqual(['"host name" was not found on any page']);
  });

  it('flags consistent values as consistent with reason="ok"', () => {
    const result = detectInconsistency('host name', [
      dp({ page: 'A', value: 'Alice', found: true }),
      dp({ page: 'B', value: 'Alice', found: true }),
    ]);
    expect(result.consistent).toBe(true);
    expect(result.reason).toBe('ok');
    expect(result.discrepancies).toEqual([]);
  });

  it('flags differing values as inconsistent with reason="differ" and lists each page', () => {
    const result = detectInconsistency('price', [
      dp({ page: 'Profile', value: '$30', found: true }),
      dp({ page: 'Booking', value: '$35', found: true }),
    ]);
    expect(result.consistent).toBe(false);
    expect(result.reason).toBe('differ');
    expect(result.discrepancies).toEqual(['Profile: "$30"', 'Booking: "$35"']);
  });

  it('treats partial-found as consistent when the found values agree', () => {
    // Only A has a value; B is missing. Should be consistent over the
    // single found point — missing pages don't create discrepancies.
    const result = detectInconsistency('rating', [
      dp({ page: 'A', value: '4.8', found: true }),
      dp({ page: 'B', found: false }),
    ]);
    expect(result.consistent).toBe(true);
    expect(result.reason).toBe('ok');
  });

  it('only includes found pages in the discrepancy list when values differ', () => {
    const result = detectInconsistency('duration', [
      dp({ page: 'A', value: '15m', found: true }),
      dp({ page: 'B', value: '30m', found: true }),
      dp({ page: 'C', found: false }), // skipped
    ]);
    expect(result.discrepancies).toEqual(['A: "15m"', 'B: "30m"']);
  });
});
