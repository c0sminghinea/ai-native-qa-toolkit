/**
 * Minimal LLM provider abstraction.
 *
 * The toolkit is built against Groq today, but every AI tool ultimately needs
 * just two operations: send a chat completion, and send one whose response is
 * validated as JSON against a Zod schema. Expressing those two operations as
 * an interface makes it cheap to add OpenAI / Anthropic / Ollama providers in
 * the future without touching tool call sites — they call `getProvider()` and
 * receive whichever backend the env is configured for.
 *
 * Today only `groq` is implemented. Other providers can register themselves
 * via `registerProvider()`.
 */
import type { ZodSchema } from 'zod';
import { groqChat, groqChatJSON, MODELS } from './groq-client';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | unknown[];
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

export interface ChatResponse {
  content: string;
}

export interface LLMProvider {
  /** Stable identifier (e.g. 'groq', 'openai'). */
  readonly name: string;
  /** Default model identifiers used by the toolkit. */
  readonly models: { readonly text: string; readonly vision: string };
  /** Send a chat completion request. */
  chat(req: ChatRequest): Promise<ChatResponse>;
  /** Send a chat completion request and validate its content as JSON. */
  chatJSON<T>(req: ChatRequest, schema: ZodSchema<T>, opener?: '{' | '['): Promise<T>;
}

const groqProvider: LLMProvider = {
  name: 'groq',
  models: MODELS,
  async chat(req) {
    // groqChat accepts the raw Groq SDK shape; our ChatRequest is a strict
    // subset, so the cast is safe.
    const result = await groqChat(req as unknown as Parameters<typeof groqChat>[0]);
    return { content: result.choices[0]?.message?.content ?? '' };
  },
  async chatJSON<T>(req: ChatRequest, schema: ZodSchema<T>, opener: '{' | '[' = '{'): Promise<T> {
    return groqChatJSON(req as unknown as Parameters<typeof groqChatJSON>[0], schema, opener);
  },
};

const registry = new Map<string, LLMProvider>([['groq', groqProvider]]);

/**
 * Register an additional provider implementation. Overwrites any existing
 * entry under the same name.
 */
export function registerProvider(provider: LLMProvider): void {
  registry.set(provider.name, provider);
}

/**
 * Returns the configured LLM provider. Reads `LLM_PROVIDER` env var, defaults
 * to `groq`. Throws if the requested provider has not been registered.
 */
export function getProvider(name?: string): LLMProvider {
  const requested = name ?? process.env.LLM_PROVIDER ?? 'groq';
  const provider = registry.get(requested);
  if (!provider) {
    throw new Error(
      `Unknown LLM provider: "${requested}". Registered: ${[...registry.keys()].join(', ')}`
    );
  }
  return provider;
}

/** List the names of all registered providers. Exposed for diagnostics & tests. */
export function listProviders(): string[] {
  return [...registry.keys()];
}
