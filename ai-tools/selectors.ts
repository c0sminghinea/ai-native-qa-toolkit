/**
 * Target configuration registry.
 *
 * The toolkit core is **target-agnostic**. Every cal.com-specific value lives
 * in the bundled example pack at [tests/examples/cal-com/target.ts](../tests/examples/cal-com/target.ts).
 * Re-point the toolkit at your own app by either:
 *
 *   1. Editing `selectors.json` at the workspace root (created automatically
 *      by `npx tsx ai-tools/discover-selectors.ts <url>`).
 *   2. Setting env vars: `BASE_URL`, `BOOKING_PATH`, `QA_TARGET_NAME`,
 *      `QA_TARGET_DESCRIPTION`, `QA_TARGET_HOST_NAME`.
 *   3. Adding a new pack under `tests/examples/<your-app>/target.ts` that
 *      mirrors the cal.com pack.
 *
 * Tools must import from this module rather than hardcoding URLs, paths,
 * or `data-testid` strings.
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Selector registry ────────────────────────────────────────────────────
// Every selector is now optional — the toolkit core makes no assumption that
// any particular role exists. Tools must guard `SELECTORS.X` with an
// `if (X)` check before using it.

export type SelectorKey = string;

/**
 * Loads `selectors.json` from the workspace root. When the file is absent,
 * falls back to `tests/examples/cal-com/selectors.json` so the bundled demo
 * still has working selectors out of the box. Users opt out by either
 * replacing `selectors.json` at root or deleting the pack.
 *
 * Metadata keys (those starting with `$`) are stripped, non-string values
 * are dropped, and empty strings are ignored. Returns `{}` on any read or
 * parse error so the toolkit always boots.
 */
function loadSelectorOverlay(): Partial<Record<string, string>> {
  const candidates = [
    path.join(process.cwd(), 'selectors.json'),
    path.join(process.cwd(), 'tests', 'examples', 'cal-com', 'selectors.json'),
  ];
  for (const fp of candidates) {
    try {
      if (!fs.existsSync(fp)) continue;
      const raw = JSON.parse(fs.readFileSync(fp, 'utf-8')) as Record<string, unknown>;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (k.startsWith('$')) continue; // skip $schema, $generatedAt
        if (typeof v === 'string' && v.trim().length > 0) out[k] = v.trim();
      }
      return out;
    } catch {
      // try next candidate
    }
  }
  return {};
}

/**
 * `data-testid` registry, populated from `selectors.json` at the workspace
 * root with a fallback to the bundled cal.com pack. Empty when neither
 * source is present. Consumers must guard accesses against `undefined`.
 */
export const SELECTORS: Partial<Record<string, string>> = loadSelectorOverlay();

// ─── Target metadata ──────────────────────────────────────────────────────

/** Default booking path, overridable via BOOKING_PATH env var. */
export const DEFAULT_BOOKING_PATH = process.env.BOOKING_PATH || '/bailey/chat';

/**
 * Default target base URL, overridable via BASE_URL env var.
 * Defensive read: vite/vitest inject `process.env.BASE_URL = '/'` into the
 * Node test environment, which would silently corrupt our URLs. Only accept
 * values that look like real http(s) origins.
 */
function readBaseUrlEnv(): string {
  const v = process.env.BASE_URL;
  if (typeof v !== 'string') return 'https://cal.com';
  if (!/^https?:\/\//i.test(v)) return 'https://cal.com';
  return v;
}
export const DEFAULT_BASE_URL = readBaseUrlEnv();

/** Full default target URL (base + path). */
export const DEFAULT_TARGET_URL = `${DEFAULT_BASE_URL}${DEFAULT_BOOKING_PATH}`;

/**
 * Derives a profile URL from a booking URL by stripping to the first path
 * segment. Works for any app where booking pages live under a profile,
 * e.g. /:user/:event → /:user.
 */
export function defaultProfileFromBookingUrl(bookingUrl: string): string {
  try {
    const u = new URL(bookingUrl);
    const segments = u.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return u.origin;
    return `${u.origin}/${segments[0]}`;
  } catch {
    return bookingUrl;
  }
}

/**
 * Single source of truth for target-specific knowledge. Prompts, MCP tool
 * descriptions, CLI help, and sample errors should reference these fields
 * rather than embedding the literal product name.
 *
 * Override via env vars:
 *   QA_TARGET_NAME          short identifier (default: "cal.com")
 *   QA_TARGET_DESCRIPTION   human sentence used in LLM prompts

 *   BASE_URL                origin (default: https://cal.com)
 *   BOOKING_PATH            booking-page path (default: /bailey/chat)
 */
export const TARGET = {
  name: process.env.QA_TARGET_NAME || 'cal.com',
  description:
    process.env.QA_TARGET_DESCRIPTION ||
    'the application under test (the bundled demo points at cal.com)',
  baseUrl: DEFAULT_BASE_URL,
  bookingPath: DEFAULT_BOOKING_PATH,
  bookingUrl: DEFAULT_TARGET_URL,
  startUrl: DEFAULT_TARGET_URL,
  profileUrl: defaultProfileFromBookingUrl(DEFAULT_TARGET_URL),
  profileFromBookingUrl: defaultProfileFromBookingUrl,
} as const;
