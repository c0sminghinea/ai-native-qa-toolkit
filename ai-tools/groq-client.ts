import * as dotenv from 'dotenv';
import Groq from 'groq-sdk';

// Kept local — not re-exported; the only caller is the retry loop below.
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

dotenv.config();

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

/**
 * Wraps groq.chat.completions.create with exponential-backoff retry.
 * Retries automatically on rate-limit (429) and transient server errors (5xx).
 * Always resolves to a non-streaming ChatCompletion response.
 */
export async function groqChat(
  params: Omit<Parameters<typeof groq.chat.completions.create>[0], 'stream'>,
  maxRetries = 3
): Promise<Groq.Chat.ChatCompletion> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return (await groq.chat.completions.create({
        ...params,
        stream: false,
      })) as Groq.Chat.ChatCompletion;
    } catch (err: unknown) {
      if (attempt === maxRetries) throw err;
      const status = (err as { status?: number })?.status ?? 0;
      if (status !== 429 && (status < 500 || status >= 600)) throw err;
      const delay = Math.min(1000 * 2 ** attempt, 8000);
      console.error(
        `⚠️  Groq API ${status} — retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})…`
      );
      await sleep(delay);
    }
  }
  throw new Error('unreachable');
}
