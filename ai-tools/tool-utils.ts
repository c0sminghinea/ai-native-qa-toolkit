import * as fs from 'fs';
import * as path from 'path';
import { chromium, type Browser } from '@playwright/test';
import { recordArtifact } from './run-telemetry';

// Re-export selector / target constants so existing imports keep working.
export {
  SELECTORS,
  DEFAULT_BOOKING_PATH,
  DEFAULT_BASE_URL,
  DEFAULT_TARGET_URL,
  TARGET,
  defaultProfileFromBookingUrl,
} from './selectors';

/** Creates a directory if it does not already exist. */
export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * Directory under which all generated tool reports are written.
 * Lives under `runs/` (already gitignored) so reports never clutter the repo root.
 * Override with REPORT_DIR=. to restore old "write to root" behaviour.
 */
export const REPORT_DIR = process.env.REPORT_DIR || path.join('runs', 'reports');

/**
 * Writes a report file under {@link REPORT_DIR}. Silent when quiet=true.
 * Returns the workspace-relative path actually written.
 */
export function saveReport(filename: string, content: string, quiet = false): string {
  const relPath = path.join(REPORT_DIR, filename);
  const fullPath = path.join(process.cwd(), relPath);
  ensureDir(path.dirname(fullPath));
  fs.writeFileSync(fullPath, content);
  recordArtifact(relPath);
  if (!quiet) console.log(`\n📄 Report saved to: ${relPath}`);
  return relPath;
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
    const merged = { ...COMMON_ERROR_HINTS, ...hints };
    const matchedHint = Object.entries(merged).find(([keyword]) => err.message.includes(keyword));
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

/**
 * Hints reused across multiple CLI tools. Per-tool hints passed to
 * `handleToolError` override these on key conflicts.
 */
export const COMMON_ERROR_HINTS: Record<string, string> = {
  'API key': 'Add GROQ_API_KEY=your_key to your .env file',
  GROQ_API_KEY: 'Add GROQ_API_KEY=your_key to your .env file',
  'rate limit':
    'Groq free-tier rate limit hit — wait a minute or set GROQ_CACHE=1 to replay locally',
  ENOTFOUND: 'Network error — check your connection and that the target URL is reachable',
};

/**
 * @internal Used only by groq-client for retry backoff.
 * Prefer waitForLoadState() for browser waits.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Default booking page path, overridable via BOOKING_PATH env var. */
// Constants moved to ./selectors and re-exported above.

/** Maximum characters to read from a file before truncating for AI analysis. */
export const MAX_FILE_CHARS = 8000;

/**
 * Wraps untrusted content (page text, user-supplied error logs, file bodies)
 * in delimiters before interpolating it into an LLM prompt. The prompt's
 * system message must instruct the model to treat anything inside the
 * delimiters as data, not instructions — this is the project's first line of
 * defence against prompt-injection from compromised pages.
 *
 * Strips any pre-existing closing delimiter to prevent termination injection.
 */
export function wrapUntrusted(content: string, label = 'UNTRUSTED'): string {
  const safeLabel = label.replace(/[^A-Z_]/gi, '');
  const closer = new RegExp(`<\\/${safeLabel}>`, 'gi');
  return `<${safeLabel}>\n${String(content).replace(closer, '')}\n</${safeLabel}>`;
}

/**
 * Returns true if a CSS / Playwright selector string is safe to pass to
 * `page.locator()`. Uses an allowlist of CSS / text-engine characters; rejects
 * HTML angle brackets, ampersands, semicolons, backticks and any
 * `on<event>=` attribute reference.
 */
export function isSafeSelector(selector: string | undefined): selector is string {
  if (!selector || selector.trim().length === 0) return false;
  if (selector.length > 500) return false;
  // Allowlist: word chars, whitespace, and standard CSS / text-engine punctuation.
  // Forbids `<`, `>`-as-tag-open (combinator `>` is still allowed), `&`, `;`, backtick.
  // NOTE: `>` IS allowed because CSS uses it as a child combinator; only `<` opens HTML.
  if (!/^[\w\s.#[\]"'=,>+~*:()\-^|$!/]+$/.test(selector)) return false;
  // Even within allowed chars, refuse event-handler attribute references.
  // Catches `onclick=`, `onclick*=`, `onclick ~= `, etc. — CSS attribute operators
  // can be `=`, `*=`, `~=`, `|=`, `^=`, `$=`.
  if (/\bon[a-z]+\s*[*~|^$]?=/i.test(selector)) return false;
  // Refuse pseudo-protocol references that could survive escaping.
  if (/javascript:|data:text\/html/i.test(selector)) return false;
  return true;
}

/**
 * Returns true only if the URL begins with the http:// or https:// scheme.
 * Stricter than `startsWith('http')`, which would accept e.g. `httpfoo://`.
 */
export function isHttpUrl(url: string | undefined): url is string {
  if (typeof url !== 'string' || !url) return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Returns true if a resolved absolute path stays inside the current workspace.
 * Used to defend against path-traversal in MCP tool inputs that write files.
 * Resolves symlinks on any existing ancestor directory so a symlinked subtree
 * cannot be used to escape the workspace.
 */
export function isPathInsideWorkspace(resolvedPath: string): boolean {
  const root = process.cwd() + path.sep;
  // Lexical guard — fast path, also fallback when realpath is unavailable.
  const lexicallyInside = resolvedPath === process.cwd() || resolvedPath.startsWith(root);
  try {
    let probe = resolvedPath;
    while (!fs.existsSync(probe)) {
      const parent = path.dirname(probe);
      if (parent === probe) return lexicallyInside;
      probe = parent;
    }
    const real = fs.realpathSync(probe);
    const realRoot = fs.realpathSync(process.cwd()) + path.sep;
    return real === fs.realpathSync(process.cwd()) || real.startsWith(realRoot) || lexicallyInside;
  } catch {
    return lexicallyInside;
  }
}

// ─── CLI helpers ─────────────────────────────────────────────────────────────

/**
 * Common flags supported by every CLI tool: --json, --quiet, --help, -h.
 * Returns the parsed flags plus the remaining positional args.
 */
export interface CliFlags {
  json: boolean;
  quiet: boolean;
  help: boolean;
  stats: boolean;
  positional: string[];
}

export function parseCliFlags(argv: string[]): CliFlags {
  const flags: CliFlags = {
    json: false,
    quiet: false,
    help: false,
    stats: false,
    positional: [],
  };
  for (const arg of argv) {
    if (arg === '--json') flags.json = true;
    else if (arg === '--quiet' || arg === '-q') flags.quiet = true;
    else if (arg === '--help' || arg === '-h') flags.help = true;
    else if (arg === '--stats') flags.stats = true;
    else flags.positional.push(arg);
  }
  return flags;
}

/**
 * If `flags.help` is true, prints `helpText` to stdout and exits with code 0.
 * Otherwise returns silently.
 */
export function maybePrintHelpAndExit(flags: CliFlags, helpText: string): void {
  if (flags.help) {
    process.stdout.write(helpText.trimEnd() + '\n');
    process.exit(0);
  }
}

/**
 * In --json mode, stdout must be machine-parseable: the only thing that should
 * land there is the final JSON line. This redirects mid-flow `console.log`
 * (and `console.info`) calls to stderr so progress prose doesn't corrupt the
 * JSON stream. No-op when `flags.json` is false.
 */
export function redirectLogsForJson(flags: CliFlags): void {
  if (!flags.json) return;
  const toStderr: typeof console.log = (...args: unknown[]) => {
    process.stderr.write(args.map(a => (typeof a === 'string' ? a : String(a))).join(' ') + '\n');
  };
  console.log = toStderr;
  console.info = toStderr;
}

/**
 * Minimal logger gated on a `quiet` flag and TTY detection.
 * `info` is suppressed in quiet mode; `error` always goes to stderr.
 * `json(...)` writes a single JSON line to stdout for machine consumption.
 */
export class Logger {
  constructor(private readonly quiet: boolean) {}

  info(...args: unknown[]): void {
    if (!this.quiet) console.log(...args);
  }

  error(...args: unknown[]): void {
    console.error(...args);
  }

  json(payload: unknown): void {
    process.stdout.write(JSON.stringify(payload) + '\n');
  }
}

// ---------------------------------------------------------------------------
// File / spec helpers shared between CLI tools and the MCP server.
// ---------------------------------------------------------------------------

/**
 * Reads a UTF-8 file capped at MAX_FILE_CHARS. When truncated, appends a
 * marker so AI prompts know the input was clipped, and (in non-quiet contexts)
 * warns to stderr.
 */
export function readWithTruncationWarning(filePath: string, label?: string): string {
  const content = fs.readFileSync(filePath, 'utf-8');
  if (content.length <= MAX_FILE_CHARS) return content;
  console.warn(
    `⚠️  ${label ?? path.basename(filePath)} is ${content.length} chars — truncated to ${MAX_FILE_CHARS}`
  );
  return (
    content.substring(0, MAX_FILE_CHARS) +
    `\n\n[...truncated — file exceeds ${MAX_FILE_CHARS} chars]`
  );
}

/**
 * Joins all .ts files in a Page-Object-Model directory with file-header
 * comments. Returns '' if the directory is missing or empty.
 */
export function collectPomContextFromDir(pagesDir: string): string {
  if (!fs.existsSync(pagesDir)) return '';
  const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.ts'));
  if (files.length === 0) return '';
  return files
    .map(f => `// --- ${f} ---\n${readWithTruncationWarning(path.join(pagesDir, f), f)}`)
    .join('\n\n');
}

/** Convenience: derives `<dirname(testFilePath)>/pages` and reads its POM files. */
export function collectPomContext(testFilePath: string): string {
  return collectPomContextFromDir(path.join(path.dirname(testFilePath), 'pages'));
}

/** Extracts test names from a Playwright spec via regex. */
export function extractTestNames(specFilePath: string): string[] {
  const content = fs.readFileSync(specFilePath, 'utf-8');
  const matches = [...content.matchAll(/test(?:\.only|\.skip)?\s*\(\s*['"`]([^'"`\n]+)['"`]/g)];
  return matches.map(m => m[1]);
}

/** Lists test names in sibling .spec.ts files (excluding the target file). */
// NOTE: This regex catches `test('name', ...)`, `test.only`, `test.skip`. It
// does NOT extract `test.describe(...)` block names or template-literal names
// containing `${...}`. Acceptable for coverage-advisor's "already covered"
// hint, but do not rely on it as ground truth.
export function collectSuiteContext(testFilePath: string): string {
  const dir = path.dirname(testFilePath);
  const targetBase = path.basename(testFilePath);
  if (!fs.existsSync(dir)) return '';
  const otherSpecs = fs.readdirSync(dir).filter(f => f.endsWith('.spec.ts') && f !== targetBase);
  return otherSpecs
    .map(f => {
      const names = extractTestNames(path.join(dir, f));
      if (names.length === 0) return '';
      return `${f}:\n${names.map(n => `  - "${n}"`).join('\n')}`;
    })
    .filter(Boolean)
    .join('\n\n');
}

// ---------------------------------------------------------------------------
// Browser lifecycle
// ---------------------------------------------------------------------------

export interface WithBrowserOptions {
  /**
   * Override the default headless behaviour. Default: headless in CI, headed
   * locally when PWDEBUG is set; otherwise headless.
   */
  headless?: boolean;
  /** Browser launch timeout in ms. Default: 30s \u2014 protects CI from infinite hangs. */
  launchTimeoutMs?: number;
}

/**
 * Launches Chromium, runs `fn(browser)`, and always closes the browser \u2014 even
 * on throw. Centralises the headless / timeout policy that was previously
 * inconsistent across tools.
 */
export async function withBrowser<T>(
  fn: (browser: Browser) => Promise<T>,
  options: WithBrowserOptions = {}
): Promise<T> {
  const headless = options.headless ?? (process.env.CI ? true : !process.env.PWDEBUG);
  const browser = await chromium.launch({
    headless,
    timeout: options.launchTimeoutMs ?? 30_000,
  });
  try {
    return await fn(browser);
  } finally {
    await browser.close().catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Stats reporting (--stats flag) — implemented in groq-client to avoid a
// circular import; re-exported here so callers can do
// `import { maybePrintStats } from './tool-utils'`.
// ---------------------------------------------------------------------------

export { maybePrintStats } from './groq-client';
