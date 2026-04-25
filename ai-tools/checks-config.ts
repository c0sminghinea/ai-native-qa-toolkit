/**
 * Declarative configuration for the data-consistency tool.
 *
 * A `qa-checks.json` file at the workspace root (or a path passed via
 * `--checks <path>`) describes which data points to verify across which
 * pages. URL fields support `{TARGET.bookingUrl}` and `{TARGET.profileUrl}`
 * placeholders so a single config works regardless of BASE_URL/BOOKING_PATH.
 *
 * If no config file is present, a cal.com preset is returned so the tool
 * still works out of the box.
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { TARGET, DEFAULT_TARGET_URL } from './selectors';

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
 * Currently supports `bookingUrl`, `profileUrl`, `baseUrl`.
 */
function expandPlaceholders(value: string): string {
  return value
    .replace(/\{TARGET\.bookingUrl\}/g, TARGET.bookingUrl)
    .replace(/\{TARGET\.profileUrl\}/g, TARGET.profileUrl)
    .replace(/\{TARGET\.baseUrl\}/g, TARGET.baseUrl);
}

function expandConfig(config: ChecksConfig): Check[] {
  return config.checks.map(c => ({
    ...c,
    pages: c.pages.map(p => ({ ...p, url: expandPlaceholders(p.url) })),
  }));
}

/** Cal.com preset — the default checks bundled when no config is provided. */
export function defaultChecks(): Check[] {
  const PROFILE_URL = TARGET.profileFromBookingUrl(DEFAULT_TARGET_URL);
  const EVENT_URL = DEFAULT_TARGET_URL;
  return [
    {
      key: 'host name',
      pages: [
        { name: 'Profile Page', url: PROFILE_URL, description: 'Main profile listing page' },
        { name: 'Event Page', url: EVENT_URL, description: 'Individual event booking page' },
      ],
    },
    {
      key: 'event duration',
      pages: [
        { name: 'Profile Page', url: PROFILE_URL, description: 'Duration on profile listing' },
        { name: 'Event Page', url: EVENT_URL, description: 'Duration on booking page' },
      ],
    },
    {
      key: 'meeting platform (Google Meet / Zoom / location)',
      pages: [
        { name: 'Profile Page', url: PROFILE_URL, description: 'Meeting platform on profile' },
        { name: 'Event Page', url: EVENT_URL, description: 'Meeting platform on booking page' },
      ],
    },
  ];
}

/**
 * Loads checks from disk if present, otherwise returns the bundled defaults.
 * Resolution order:
 *   1. explicit `configPath` argument (errors if missing/invalid)
 *   2. `./qa-checks.json` at the workspace root (silently falls back if missing)
 *   3. bundled cal.com defaults
 */
export function loadChecksConfig(configPath?: string): {
  checks: Check[];
  source: string;
} {
  const explicit = !!configPath;
  const resolved = configPath || path.join(process.cwd(), DEFAULT_CONFIG_FILENAME);

  if (!fs.existsSync(resolved)) {
    if (explicit) {
      throw new Error(`Checks config not found: ${resolved}`);
    }
    return { checks: defaultChecks(), source: 'bundled defaults (cal.com preset)' };
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
