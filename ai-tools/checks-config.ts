/**
 * Declarative configuration for the data-consistency tool.
 *
 * A `qa-checks.json` file at the workspace root (or a path passed via
 * `--checks <path>`) describes which data points to verify across which
 * pages. URL fields support `{TARGET.bookingUrl}` / `{TARGET.profileUrl}`
 * (kept for backward compatibility with the cal.com pack) and
 * `{TARGET.baseUrl}` / `{TARGET.startUrl}` placeholders so a single config
 * works regardless of BASE_URL/START_PATH.
 *
 * Targets that need a fallback set of checks pass a `fallback` callback to
 * `loadChecksConfig` — the toolkit core does not bake in any one product's
 * default checks.
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { TARGET } from './selectors';

const PageCheckSchema = z.object({
  name: z.string().min(1),
  url: z.string().min(1),
  description: z.string().default(''),
});

const CheckSchema = z.object({
  key: z.string().min(1),
  pages: z.array(PageCheckSchema).min(1),
});

const ChecksConfigSchema = z.object({
  $schema: z.string().optional(),
  checks: z.array(CheckSchema).min(1),
});

export type Check = z.infer<typeof CheckSchema>;
export type ChecksConfig = z.infer<typeof ChecksConfigSchema>;

const DEFAULT_CONFIG_FILENAME = 'qa-checks.json';

/**
 * Resolves `{TARGET.<field>}` placeholders against the runtime TARGET object.
 *
 * Supports the generic toolkit fields (`baseUrl`, `startUrl`) plus two
 * scheduling-shaped aliases (`bookingUrl`, `profileUrl`) that are kept for
 * backward compatibility with the cal.com pack — they fall back to
 * `startUrl` when the underlying TARGET doesn't define them.
 */
function expandPlaceholders(value: string): string {
  const t = TARGET as Record<string, unknown>;
  const baseUrl = typeof t.baseUrl === 'string' ? t.baseUrl : '';
  const startUrl = typeof t.startUrl === 'string' ? t.startUrl : '';
  const bookingUrl = typeof t.bookingUrl === 'string' ? t.bookingUrl : startUrl;
  const profileUrl = typeof t.profileUrl === 'string' ? t.profileUrl : startUrl;
  return value
    .replace(/\{TARGET\.bookingUrl\}/g, bookingUrl)
    .replace(/\{TARGET\.profileUrl\}/g, profileUrl)
    .replace(/\{TARGET\.startUrl\}/g, startUrl)
    .replace(/\{TARGET\.baseUrl\}/g, baseUrl);
}

function expandConfig(config: ChecksConfig): Check[] {
  return config.checks.map(c => ({
    ...c,
    pages: c.pages.map(p => ({ ...p, url: expandPlaceholders(p.url) })),
  }));
}

/**
 * Loads checks from disk, optionally falling back to a caller-supplied
 * provider when no config file is found. The toolkit core never bakes in a
 * product-specific default — packs (e.g. `tests/examples/cal-com/target.ts`)
 * expose their own `…Checks()` function and pass it as `fallback`.
 *
 * Resolution order:
 *   1. explicit `configPath` argument (errors if missing/invalid)
 *   2. `./qa-checks.json` at the workspace root (silently falls back if missing)
 *   3. `fallback()` if provided
 *   4. throws — no config available
 */
export interface LoadChecksOptions {
  /** Provider invoked when no config file is found. */
  fallback?: () => Check[];
  /** Human label describing where `fallback` came from (printed in CLI output). */
  fallbackLabel?: string;
}

export function loadChecksConfig(
  configPath?: string,
  options: LoadChecksOptions = {}
): {
  checks: Check[];
  source: string;
} {
  const explicit = !!configPath;
  const resolved = configPath || path.join(process.cwd(), DEFAULT_CONFIG_FILENAME);

  if (!fs.existsSync(resolved)) {
    if (explicit) {
      throw new Error(`Checks config not found: ${resolved}`);
    }
    if (options.fallback) {
      return {
        checks: options.fallback(),
        source: options.fallbackLabel ?? 'caller-supplied fallback',
      };
    }
    throw new Error(
      `No qa-checks.json found at ${resolved} and no fallback provider supplied. ` +
        'Pass --checks <path> or create qa-checks.json at the workspace root.'
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
  } catch (err) {
    throw new Error(
      `Failed to parse ${resolved}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  let parsed: ChecksConfig;
  try {
    parsed = ChecksConfigSchema.parse(raw);
  } catch (err) {
    const detail =
      err instanceof z.ZodError
        ? err.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
        : String(err);
    throw new Error(`Invalid checks config in ${resolved}: ${detail}`);
  }

  return { checks: expandConfig(parsed), source: resolved };
}

/**
 * Reads a `--checks <path>` value from raw argv. Returns undefined when not
 * provided. Used by tools that want to support a config-file flag without
 * polluting the shared CliFlags interface.
 */
export function extractChecksFlag(argv: string[]): string | undefined {
  const idx = argv.indexOf('--checks');
  if (idx >= 0 && idx + 1 < argv.length) return argv[idx + 1];
  const eqArg = argv.find(a => a.startsWith('--checks='));
  if (eqArg) return eqArg.slice('--checks='.length);
  return undefined;
}
