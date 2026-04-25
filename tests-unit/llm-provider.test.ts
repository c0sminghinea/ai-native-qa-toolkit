import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  getProvider,
  listProviders,
  registerProvider,
  type LLMProvider,
} from '../ai-tools/llm-provider';

describe('getProvider', () => {
  it('returns the groq provider by default', () => {
    const p = getProvider();
    expect(p.name).toBe('groq');
    expect(typeof p.chat).toBe('function');
    expect(typeof p.chatJSON).toBe('function');
    expect(p.models.text).toBeTruthy();
    expect(p.models.vision).toBeTruthy();
  });

  it('accepts an explicit name argument', () => {
    expect(getProvider('groq').name).toBe('groq');
  });

  it('throws on unknown provider name', () => {
    expect(() => getProvider('not-a-real-provider')).toThrow(/Unknown LLM provider/);
  });
});

describe('listProviders', () => {
  it('includes the built-in groq provider', () => {
    expect(listProviders()).toContain('groq');
  });
});

describe('registerProvider', () => {
  it('makes a custom provider available via getProvider', async () => {
    const fake: LLMProvider = {
      name: 'fake-test-provider',
      models: { text: 'fake-text', vision: 'fake-vision' },
      async chat() {
        return { content: 'hello' };
      },
      async chatJSON<T>(_req: unknown, schema: z.ZodSchema<T>) {
        return schema.parse({ ok: true });
      },
    };

    registerProvider(fake);
    expect(listProviders()).toContain('fake-test-provider');

    const got = getProvider('fake-test-provider');
    expect(got.name).toBe('fake-test-provider');

    const chat = await got.chat({ model: 'fake-text', messages: [] });
    expect(chat.content).toBe('hello');

    const json = await got.chatJSON(
      { model: 'fake-text', messages: [] },
      z.object({ ok: z.boolean() })
    );
    expect(json).toEqual({ ok: true });
  });
});
