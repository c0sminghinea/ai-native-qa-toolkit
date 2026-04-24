import * as fs from 'fs';
import * as path from 'path';

/** Creates a directory if it does not already exist. */
export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Writes a report file to the project root and logs the path. */
export function saveReport(filename: string, content: string): void {
  fs.writeFileSync(path.join(process.cwd(), filename), content);
  console.log(`\n📄 Report saved to: ${filename}`);
}

/**
 * Parses an AI response that should be JSON.
 * Falls back to a regex extraction when the model wraps the JSON in prose.
 * @param opener - '{' for objects (default), '[' for arrays
 */
export function parseAIJson<T>(raw: string, opener: '{' | '[' = '{'): T {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const pattern = opener === '[' ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
    const match = trimmed.match(pattern);
    if (match) return JSON.parse(match[0]);
    throw new Error(`Could not parse AI response: ${trimmed.substring(0, 200)}`);
  }
}

/**
 * Unified error handler for CLI tools.
 * Prints the error and an optional context-specific hint, then exits.
 * @param hints - key/value pairs where the key is a substring to match in the error message
 */
export function handleToolError(err: unknown, hints: Record<string, string> = {}): never {
  if (err instanceof Error) {
    console.error('\n❌ Error:', err.message);
    const matchedHint = Object.entries(hints).find(([keyword]) =>
      err.message.includes(keyword)
    );
    if (matchedHint) {
      console.error(`💡 ${matchedHint[1]}`);
    } else {
      console.error('💡 Check your network connection and API key validity');
    }
  } else {
    console.error('\n❌ Unexpected error:', err);
  }
  process.exit(1);
}

/** Pauses execution for a given number of milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Default booking page path, overridable via BOOKING_PATH env var. */
export const DEFAULT_BOOKING_PATH = process.env.BOOKING_PATH || '/bailey/chat';

/** Default target base URL, overridable via BASE_URL env var. */
export const DEFAULT_BASE_URL = process.env.BASE_URL || 'https://cal.com';

/** Full default target URL (base + path). */
export const DEFAULT_TARGET_URL = `${DEFAULT_BASE_URL}${DEFAULT_BOOKING_PATH}`;
