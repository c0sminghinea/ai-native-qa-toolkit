import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import Groq from 'groq-sdk';
import type { ZodSchema } from 'zod';
import { parseAIJson } from './tool-utils';

// Kept local — not re-exported; the only caller is the retry loop below.
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

dotenv.config({ quiet: true });

if (!process.env.GROQ_API_KEY) {
  throw new Error(
    'GROQ_API_KEY is not set. Copy .env.example to .env and add your key from https://console.groq.com/'
  );
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const MODELS = {
  text: 'llama-3.3-70b-versatile',
  vision: 'meta-llama/llama-4-scout-17b-16e-instruct',
} as const;

// ─── Token usage tracking ──────────────────────────────────────────────────
// Cumulative usage across a single CLI / MCP run, written to .cache/run-stats.json
// at process exit. Useful for spotting prompt regressions and budgeting cost.

interface RunStats {
  calls: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cacheHits: number;
  retries: number;
  byModel: Record<string, { calls: number; tokens: number }>;
}

const stats: RunStats = {
  calls: 0,
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  cacheHits: 0,
  retries: 0,
  byModel: {},
};

let statsHookInstalled = false;
function installStatsHook(): void {
  if (statsHookInstalled) return;
  statsHookInstalled = true;
  process.on('exit', () => {
    if (stats.calls === 0 && stats.cacheHits === 0) return;
    try {
      const dir = path.join(process.cwd(), '.cache');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'run-stats.json'),
        JSON.stringify({ ...stats, timestamp: new Date().toISOString() }, null, 2)
      );
    } catch {
      // Don't let stats writing fail a run.
    }
  });
}

/** Returns a snapshot of the current run's token usage. */
export function getRunStats(): RunStats {
  return { ...stats, byModel: { ...stats.byModel } };
}

/**
 * Prints the current run's token usage to stderr. Used by the CLI tools'
 * `--stats` flag. No-op when no calls have been made.
 */
export function maybePrintStats(flags: { stats?: boolean }): void {
  if (!flags.stats) return;
  const s = getRunStats();
  if (s.calls === 0 && s.cacheHits === 0) return;
  const lines = [
    '',
    '── Groq usage ──',
    `calls: ${s.calls}   cache hits: ${s.cacheHits}   retries: ${s.retries}`,
    `tokens: prompt=${s.promptTokens} completion=${s.completionTokens} total=${s.totalTokens}`,
    'by model:',
    ...Object.entries(s.byModel).map(([m, b]) => `  ${m}: ${b.calls} calls / ${b.tokens} tokens`),
  ];
  process.stderr.write(lines.join('\n') + '\n');
}

// ─── Response cache ────────────────────────────────────────────────────────
// Opt-in via GROQ_CACHE=1. Hashes (model, messages, max_tokens) → JSON file.
// Speeds up local prompt iteration and avoids burning quota during dev.

function cacheKey(params: Record<string, unknown>): string {
  const json = JSON.stringify({
    model: params.model,
    messages: params.messages,
    max_tokens: params.max_tokens ?? null,
    temperature: params.temperature ?? null,
  });
  return crypto.createHash('sha256').update(json).digest('hex').substring(0, 16);
}

function cachePath(key: string): string {
  return path.join(process.cwd(), '.cache', 'groq', `${key}.json`);
}

function readCache(key: string): Groq.Chat.ChatCompletion | null {
  const file = cachePath(key);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as Groq.Chat.ChatCompletion;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: Groq.Chat.ChatCompletion): void {
  try {
    const file = cachePath(key);
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value));
  } catch {
    // Cache writes are best-effort.
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Decides whether a thrown error from the Groq SDK warrants a retry.
 * Retries on rate-limit (429) and 5xx server errors only.
 * Exported so tests and other providers can reuse the policy.
 */
export function shouldRetryError(err: unknown): boolean {
  const status = (err as { status?: number })?.status ?? 0;
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

/**
 * Exponential backoff: 1s, 2s, 4s, capped at 8s. Exported for tests.
 * `attempt` is 0-based.
 */
export function backoffDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 8000);
}

/**
 * Wraps groq.chat.completions.create with exponential-backoff retry.
 * Retries automatically on rate-limit (429) and transient server errors (5xx).
 * Always resolves to a non-streaming ChatCompletion response.
 *
 * Optional behaviour:
 * - GROQ_CACHE=1 — cache responses keyed on (model, messages, max_tokens) under .cache/groq/
 * - GROQ_VERBOSE=1 — log token usage per call to stderr
 */
export async function groqChat(
  params: Omit<Parameters<typeof groq.chat.completions.create>[0], 'stream'>,
  maxRetries = 3
): Promise<Groq.Chat.ChatCompletion> {
  installStatsHook();

  const key = cacheKey(params as Record<string, unknown>);
  if (process.env.GROQ_CACHE === '1') {
    const cached = readCache(key);
    if (cached) {
      stats.cacheHits++;
      if (process.env.GROQ_VERBOSE === '1') {
        console.error(`💾 Groq cache hit (${key})`);
      }
      return cached;
    }
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = (await groq.chat.completions.create({
        ...params,
        stream: false,
      })) as Groq.Chat.ChatCompletion;

      // Track token usage
      const model = String(params.model);
      const usage = result.usage;
      stats.calls++;
      if (usage) {
        stats.promptTokens += usage.prompt_tokens ?? 0;
        stats.completionTokens += usage.completion_tokens ?? 0;
        stats.totalTokens += usage.total_tokens ?? 0;
        const bucket = stats.byModel[model] ?? { calls: 0, tokens: 0 };
        bucket.calls++;
        bucket.tokens += usage.total_tokens ?? 0;
        stats.byModel[model] = bucket;
        if (process.env.GROQ_VERBOSE === '1') {
          console.error(
            `🪙  ${model}: ${usage.prompt_tokens}/${usage.completion_tokens} tokens (cumulative ${stats.totalTokens})`
          );
        }
      }

      if (process.env.GROQ_CACHE === '1') writeCache(key, result);
      return result;
    } catch (err: unknown) {
      if (attempt === maxRetries) throw err;
      if (!shouldRetryError(err)) throw err;
      stats.retries++;
      const status = (err as { status?: number })?.status ?? 0;
      const delay = backoffDelay(attempt);
      console.error(
        `⚠️  Groq API ${status} — retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})…`
      );
      await sleep(delay);
    }
  }
  throw new Error('unreachable');
}

/**
 * Calls groqChat and validates the response content as JSON against a Zod schema.
 * Retries the call once if the content does not parse or fails validation.
 */
export async function groqChatJSON<T>(
  params: Omit<Parameters<typeof groq.chat.completions.create>[0], 'stream'>,
  schema: ZodSchema<T>,
  opener: '{' | '[' = '{'
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await groqChat(params);
    const content = result.choices[0]?.message?.content ?? '';
    try {
      const parsed = parseAIJson<unknown>(content, opener);
      return schema.parse(parsed);
    } catch (err) {
      if (attempt === 1) {
        throw new Error(
          `AI returned invalid JSON or schema mismatch: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      console.error('⚠️  AI response failed schema validation, retrying once…');
    }
  }
  throw new Error('unreachable');
}
