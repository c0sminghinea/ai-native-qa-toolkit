import { describe, it, expect } from 'vitest';
import { parseScoreFromAnalysis, worstScore } from '../ai-tools/visual-regression';

describe('parseScoreFromAnalysis', () => {
  it('extracts a "N/10" pattern', () => {
    expect(parseScoreFromAnalysis('Overall score: 7/10. Layout is solid.')).toBe('7/10');
  });
  it('extracts a "N out of 10" pattern (case-insensitive)', () => {
    expect(parseScoreFromAnalysis('I would rate this 9 OUT OF 10 overall.')).toBe('9/10');
  });
  it('returns N/A when no score is present', () => {
    expect(parseScoreFromAnalysis('No numeric rating in this blurb.')).toBe('N/A');
  });
  it('returns the first match when multiple scores appear', () => {
    expect(parseScoreFromAnalysis('Layout 8/10. Content 6/10.')).toBe('8/10');
  });
});

describe('worstScore', () => {
  it('returns the lowest numeric score across results', () => {
    expect(worstScore([{ score: '8/10' }, { score: '6/10' }, { score: '9/10' }])).toBe(6);
  });
  it('treats N/A as a non-failing 10 so missing analysis does not poison the run', () => {
    expect(worstScore([{ score: 'N/A' }, { score: '7/10' }])).toBe(7);
  });
  it('returns 10 for an empty result list (nothing to fail on)', () => {
    expect(worstScore([])).toBe(10);
  });
  it('returns 10 when every score is N/A', () => {
    expect(worstScore([{ score: 'N/A' }, { score: 'N/A' }])).toBe(10);
  });
});
