import { describe, it, expect } from 'vitest';
import {
  AgentActionSchema,
  extractCleanText,
  resolveNavigateUrl,
  isHostAllowed,
  planClickStrategies,
} from '../ai-tools/browser-agent';

describe('AgentActionSchema', () => {
  it('accepts a minimal "done" action with just action + reason', () => {
    const r = AgentActionSchema.safeParse({ action: 'done', reason: 'goal met' });
    expect(r.success).toBe(true);
  });

  it('accepts a full click action', () => {
    const r = AgentActionSchema.safeParse({
      action: 'click',
      selector: "button[text='Confirm']",
      reason: 'submit form',
    });
    expect(r.success).toBe(true);
  });

  it('rejects unknown action verbs', () => {
    const r = AgentActionSchema.safeParse({ action: 'teleport', reason: 'why not' });
    expect(r.success).toBe(false);
  });

  it('rejects missing reason', () => {
    const r = AgentActionSchema.safeParse({ action: 'done' });
    expect(r.success).toBe(false);
  });
});

describe('extractCleanText', () => {
  it("extracts text from BUTTON[text='…'] form", () => {
    expect(extractCleanText("BUTTON[text='14 Today']")).toBe('14 Today');
  });

  it("extracts text from generic text='…' form", () => {
    expect(extractCleanText("a[text='Confirm']")).toBe('Confirm');
  });

  it('extracts text from double-quoted form', () => {
    expect(extractCleanText('button[text="Next"]')).toBe('Next');
  });

  it('falls back to the raw selector when no text= payload is present', () => {
    expect(extractCleanText('[data-testid="submit"]')).toBe('[data-testid="submit"]');
  });
});

describe('resolveNavigateUrl', () => {
  const start = 'https://cal.com/bailey/chat';

  it('returns absolute URLs unchanged', () => {
    const u = resolveNavigateUrl('https://cal.com/other', start);
    expect(u?.toString()).toBe('https://cal.com/other');
  });

  it('resolves relative paths against startUrl', () => {
    const u = resolveNavigateUrl('/bailey/chat', start);
    expect(u?.toString()).toBe('https://cal.com/bailey/chat');
  });

  it('returns null for unparseable garbage', () => {
    expect(resolveNavigateUrl('::::not a url::::', 'not a base either')).toBeNull();
  });
});

describe('isHostAllowed', () => {
  it('returns true when hostnames match exactly', () => {
    expect(isHostAllowed(new URL('https://cal.com/foo'), 'cal.com')).toBe(true);
  });

  it('returns false for cross-origin hosts (SSRF protection)', () => {
    expect(isHostAllowed(new URL('https://evil.example/foo'), 'cal.com')).toBe(false);
  });

  it('treats subdomains as different hosts', () => {
    expect(isHostAllowed(new URL('https://api.cal.com/foo'), 'cal.com')).toBe(false);
  });
});

describe('planClickStrategies', () => {
  it('short-circuits to a single href strategy when href= is present', () => {
    const plan = planClickStrategies("a[href='/foo']", 'Foo');
    expect(plan).toEqual([{ kind: 'href', value: '/foo' }]);
  });

  it('short-circuits to a single testid strategy when data-testid= is present', () => {
    const plan = planClickStrategies("button[data-testid='submit']", 'Submit');
    expect(plan).toEqual([{ kind: 'testid', value: 'submit' }]);
  });

  it('returns the 5-strategy fallback cascade in order otherwise', () => {
    const plan = planClickStrategies("BUTTON[text='Confirm']", 'Confirm');
    expect(plan.map(s => s.kind)).toEqual([
      'role-button',
      'text',
      'day-testid',
      'css-button',
      'raw-css',
    ]);
  });

  it('marks raw-css as unsafe when the selector contains JS-like patterns', () => {
    const plan = planClickStrategies('javascript:alert(1)', 'x');
    const rawCss = plan.find(s => s.kind === 'raw-css');
    expect(rawCss).toBeDefined();
    if (rawCss && rawCss.kind === 'raw-css') {
      expect(rawCss.safe).toBe(false);
    }
  });

  it('marks raw-css as safe for benign selectors', () => {
    const plan = planClickStrategies('.calendar-day', '14');
    const rawCss = plan.find(s => s.kind === 'raw-css');
    expect(rawCss).toBeDefined();
    if (rawCss && rawCss.kind === 'raw-css') {
      expect(rawCss.safe).toBe(true);
    }
  });

  it('threads cleanText through every text-based strategy', () => {
    const plan = planClickStrategies("button[text='Next']", '14 Today');
    for (const s of plan) {
      if (
        s.kind === 'role-button' ||
        s.kind === 'text' ||
        s.kind === 'day-testid' ||
        s.kind === 'css-button'
      ) {
        expect(s.text).toBe('14 Today');
      }
    }
  });
});
