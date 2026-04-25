import { describe, it, expect } from 'vitest';
import { buildMappingSchema, filterMapping, buildFileBody } from '../ai-tools/discover-selectors';

const ROLES = ['BOOKER_CONTAINER', 'EVENT_TITLE', 'PREV_MONTH'] as const;

describe('buildMappingSchema', () => {
  it('accepts a value object containing strings, nulls, and missing keys', () => {
    const schema = buildMappingSchema(ROLES);
    const ok = schema.safeParse({
      BOOKER_CONTAINER: 'booking-widget',
      EVENT_TITLE: null,
      // PREV_MONTH omitted on purpose
    });
    expect(ok.success).toBe(true);
  });

  it('rejects non-string / non-null values', () => {
    const schema = buildMappingSchema(ROLES);
    const bad = schema.safeParse({ BOOKER_CONTAINER: 42 });
    expect(bad.success).toBe(false);
  });

  it('ignores extra unrelated keys (zod default is non-strict)', () => {
    const schema = buildMappingSchema(ROLES);
    const ok = schema.safeParse({ EVENT_TITLE: 'event-name', random_extra: 'whatever' });
    expect(ok.success).toBe(true);
  });
});

describe('filterMapping', () => {
  it('keeps only non-empty trimmed string values', () => {
    const result = filterMapping(ROLES, {
      BOOKER_CONTAINER: '  booking-widget  ',
      EVENT_TITLE: '',
      PREV_MONTH: null,
    });
    expect(result).toEqual({ BOOKER_CONTAINER: 'booking-widget' });
  });

  it('drops keys not in the role list', () => {
    const result = filterMapping(ROLES, {
      BOOKER_CONTAINER: 'x',
      not_a_role: 'should-be-dropped',
    });
    expect(result).toEqual({ BOOKER_CONTAINER: 'x' });
    expect(result).not.toHaveProperty('not_a_role');
  });

  it('returns an empty object when nothing matches', () => {
    expect(filterMapping(ROLES, {})).toEqual({});
    expect(filterMapping(ROLES, { BOOKER_CONTAINER: null })).toEqual({});
  });

  it('handles non-string inputs gracefully', () => {
    const result = filterMapping(ROLES, {
      BOOKER_CONTAINER: 123 as unknown as string,
      EVENT_TITLE: { not: 'a string' } as unknown as string,
      PREV_MONTH: 'prev-button',
    });
    expect(result).toEqual({ PREV_MONTH: 'prev-button' });
  });
});

describe('buildFileBody', () => {
  it('embeds metadata and the mapping at the top level', () => {
    const fixed = new Date('2025-01-15T12:00:00.000Z');
    const body = buildFileBody(
      'https://example.com/booking',
      { BOOKER_CONTAINER: 'widget' },
      fixed
    );
    expect(body.$schema).toMatch(/Auto-generated/);
    expect(body.$generatedAt).toBe('2025-01-15T12:00:00.000Z');
    expect(body.$generatedFrom).toBe('https://example.com/booking');
    expect(body.BOOKER_CONTAINER).toBe('widget');
  });

  it('produces a JSON-serialisable object', () => {
    const body = buildFileBody('https://example.com', { EVENT_TITLE: 'event-name' });
    expect(() => JSON.stringify(body)).not.toThrow();
    const round = JSON.parse(JSON.stringify(body));
    expect(round.EVENT_TITLE).toBe('event-name');
  });
});
