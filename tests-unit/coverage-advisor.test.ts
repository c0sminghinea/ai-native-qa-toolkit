import { describe, it, expect } from 'vitest';
import { buildCoverageReport, type CoverageAdvice } from '../ai-tools/coverage-advisor';

const sampleAdvice: CoverageAdvice = {
  score: 7,
  whatIsCovered: ['happy path booking', 'date picker'],
  criticalGaps: ['no test for empty time slots'],
  topTestsToAdd: [
    {
      name: 'handles empty slots',
      why: 'production traffic shows ~5% of slots come back empty',
      code: "test('empty slots', async ({ page }) => {});",
    },
  ],
};

describe('buildCoverageReport', () => {
  it('uses a stable date in the header when one is supplied', () => {
    const fixed = new Date('2025-01-15T12:00:00.000Z');
    const md = buildCoverageReport('tests/booking.spec.ts', sampleAdvice, fixed);
    expect(md).toContain('**Date:** 2025-01-15');
  });

  it('embeds the file path, score, gaps, and recommended tests', () => {
    const md = buildCoverageReport('tests/booking.spec.ts', sampleAdvice, new Date('2025-01-15'));
    expect(md).toContain('`tests/booking.spec.ts`');
    expect(md).toContain('**Score:** 7/10');
    expect(md).toContain('- happy path booking');
    expect(md).toContain('- no test for empty time slots');
    expect(md).toContain('### 1. handles empty slots');
    expect(md).toContain('production traffic shows ~5%');
    expect(md).toContain('```typescript');
  });

  it('handles empty arrays without throwing', () => {
    const md = buildCoverageReport(
      'tests/x.spec.ts',
      { score: 0, whatIsCovered: [], criticalGaps: [], topTestsToAdd: [] },
      new Date('2025-01-15')
    );
    expect(md).toContain('## What is covered');
    expect(md).toContain('## Critical gaps');
    expect(md).toContain('## Top tests to add');
    expect(md).toContain('**Score:** 0/10');
  });

  it('numbers the recommended tests starting at 1', () => {
    const advice: CoverageAdvice = {
      score: 5,
      whatIsCovered: [],
      criticalGaps: [],
      topTestsToAdd: [
        { name: 'first', why: 'a', code: 'a' },
        { name: 'second', why: 'b', code: 'b' },
        { name: 'third', why: 'c', code: 'c' },
      ],
    };
    const md = buildCoverageReport('tests/x.spec.ts', advice, new Date('2025-01-15'));
    expect(md).toContain('### 1. first');
    expect(md).toContain('### 2. second');
    expect(md).toContain('### 3. third');
  });
});
