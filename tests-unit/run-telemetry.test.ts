import { describe, it, expect } from 'vitest';
import { buildRunRecord } from '../ai-tools/run-telemetry';

const baseStats = {
  calls: 0,
  cacheHits: 0,
  retries: 0,
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  byModel: {},
};

describe('buildRunRecord', () => {
  it('captures argv, timing, exit code, and artifacts', () => {
    const record = buildRunRecord({
      argv: ['agent', 'verify booking', 'https://cal.com/bailey/chat'],
      startedAt: '2025-01-15T12:00:00.000Z',
      endedAt: '2025-01-15T12:00:42.500Z',
      durationMs: 42500,
      exitCode: 0,
      artifacts: ['agent-report.md'],
      stats: baseStats,
    });

    expect(record).toMatchObject({
      schemaVersion: 1,
      command: 'agent',
      argv: ['agent', 'verify booking', 'https://cal.com/bailey/chat'],
      startedAt: '2025-01-15T12:00:00.000Z',
      endedAt: '2025-01-15T12:00:42.500Z',
      durationMs: 42500,
      exitCode: 0,
      artifacts: ['agent-report.md'],
    });
  });

  it('flattens token stats under llm.*', () => {
    const record = buildRunRecord({
      argv: [],
      startedAt: '2025-01-15T12:00:00.000Z',
      endedAt: '2025-01-15T12:00:01.000Z',
      durationMs: 1000,
      exitCode: 0,
      artifacts: [],
      stats: {
        ...baseStats,
        calls: 3,
        promptTokens: 100,
        completionTokens: 200,
        totalTokens: 300,
        retries: 1,
        cacheHits: 2,
        byModel: { 'llama-3.3': { calls: 3, tokens: 300 } },
      },
    });

    expect(record.llm).toMatchObject({
      calls: 3,
      retries: 1,
      cacheHits: 2,
      promptTokens: 100,
      completionTokens: 200,
      totalTokens: 300,
      byModel: { 'llama-3.3': { calls: 3, tokens: 300 } },
    });
  });

  it('represents non-zero exit codes faithfully', () => {
    const record = buildRunRecord({
      argv: ['agent'],
      startedAt: '2025-01-15T12:00:00.000Z',
      endedAt: '2025-01-15T12:00:01.000Z',
      durationMs: 1000,
      exitCode: 1,
      artifacts: [],
      stats: baseStats,
    });
    expect(record.exitCode).toBe(1);
  });

  it('returns a JSON-serialisable object', () => {
    const record = buildRunRecord({
      argv: [],
      startedAt: '2025-01-15T12:00:00.000Z',
      endedAt: '2025-01-15T12:00:01.000Z',
      durationMs: 1000,
      exitCode: 0,
      artifacts: ['a.md', 'b.md'],
      stats: baseStats,
    });
    expect(() => JSON.stringify(record)).not.toThrow();
    const round = JSON.parse(JSON.stringify(record));
    expect(round.artifacts).toEqual(['a.md', 'b.md']);
  });
});
