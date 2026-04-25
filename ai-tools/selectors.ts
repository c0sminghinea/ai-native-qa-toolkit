/**
 * Target configuration — the single place where cal.com-specific knowledge
 * lives. To point this toolkit at a different scheduling/booking app,
 * override via env vars (BASE_URL, BOOKING_PATH, QA_TARGET_NAME,
 * QA_TARGET_DESCRIPTION) or edit the constants below.
 *
 * Tools must import from this module instead of hardcoding URLs, paths,
 * or `data-testid` strings.
 *
 * Selector overrides
 * ──────────────────
 * If `./selectors.json` exists at the workspace root, its values override
 * the cal.com defaults below. Generate it automatically by running:
 *     npx tsx ai-tools/discover-selectors.ts <url>
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * `data-testid` registry. Cal.com defaults are bundled; override per-project
 * by running `discover-selectors.ts` (writes `selectors.json`) or by editing
 * the JSON file directly. Tools reference these symbolically so a single
 * change propagates everywhere.
 */
const DEFAULT_SELECTORS = {
  BOOKER_CONTAINER: 'booker-container',
  EVENT_TITLE: 'event-title',
  EVENT_META: 'event-meta',
  MONTH_LABEL: 'selected-month-label',
  PREV_MONTH: 'decrementMonth',
  NEXT_MONTH: 'incrementMonth',
  TIMEZONE_SELECT: 'timezone-select',
  OVERLAY_CALENDAR_SWITCH: 'overlay-calendar-switch',
  DAY: 'day',
  TIME: 'time',
} as const;

export type SelectorKey = keyof typeof DEFAULT_SELECTORS;

/**
 * Loads selector overrides from `./selectors.json` at the workspace root if
 * present. Unknown keys are ignored; non-string values are skipped. Returns
 * an empty object on any read/parse error so the toolkit always starts.
 */
function loadSelectorOverrides(): Partial<Record<SelectorKey, string>> {
  try {
    const filePath = path.join(process.cwd(), 'selectors.json');
    if (!fs.existsSync(filePath)) return {};
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
    const overrides: Partial<Record<SelectorKey, string>> = {};
    for (const key of Object.keys(DEFAULT_SELECTORS) as SelectorKey[]) {
      const v = raw[key];
      if (typeof v === 'string' && v.trim().length > 0) overrides[key] = v.trim();
    }
    return overrides;
  } catch {
    return {};
  }
}

export const SELECTORS: Record<SelectorKey, string> = {
  ...DEFAULT_SELECTORS,
  ...loadSelectorOverrides(),
};

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
    'a scheduling and booking platform (the default example is cal.com)',
  baseUrl: DEFAULT_BASE_URL,
  bookingPath: DEFAULT_BOOKING_PATH,
  bookingUrl: DEFAULT_TARGET_URL,
  profileUrl: defaultProfileFromBookingUrl(DEFAULT_TARGET_URL),
  profileFromBookingUrl: defaultProfileFromBookingUrl,
} as const;

/**
 * Human-readable description of each selector role. Consumed by
 * `discover-selectors.ts` to instruct the LLM what each key is supposed to
 * identify on a page. Keep these descriptions semantic, not target-specific.
 */
export const SELECTOR_ROLE_DESCRIPTIONS: Record<SelectorKey, string> = {
  BOOKER_CONTAINER:
    'The outer wrapper element that contains the entire booking widget (calendar + time slots).',
  EVENT_TITLE: 'The element showing the title of the event being booked (e.g. "30 Min Meeting").',
  EVENT_META:
    'The element showing event metadata such as duration, location, or description, near the title.',
  MONTH_LABEL: 'The text element displaying the currently visible month, e.g. "October 2025".',
  PREV_MONTH: 'The button that navigates the calendar to the previous month.',
  NEXT_MONTH: 'The button that navigates the calendar to the next month.',
  TIMEZONE_SELECT: 'The control (button or select) that lets the user change their timezone.',
  OVERLAY_CALENDAR_SWITCH:
    'A toggle/switch for overlaying the user\u2019s personal calendar on top of availability.',
  DAY: 'A single selectable day cell in the calendar grid.',
  TIME: 'A single selectable time slot button shown after a day is picked.',
};
