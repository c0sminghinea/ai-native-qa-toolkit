/**
 * Cal.com target pack.
 *
 * Self-contained module that owns every piece of cal.com-specific knowledge
 * the toolkit ships with. Specs, page objects, and the data-consistency
 * config live alongside this file. Other targets follow the same pattern —
 * copy this directory, rename it, and edit the exports below.
 *
 * The toolkit's generic layer ([ai-tools/selectors.ts](../../../ai-tools/selectors.ts)) provides
 * env-driven defaults; this pack overrides those with concrete cal.com values
 * so a fresh clone of the repo still has a working demo.
 */
import * as path from 'path';
import {
  TARGET as GENERIC_TARGET,
  defaultProfileFromBookingUrl,
} from '../../../ai-tools/selectors';
import type { Check } from '../../../ai-tools/checks-config';

/**
 * `data-testid` registry for the cal.com booking widget. Override by
 * generating a `selectors.json` against your own deployment via:
 *   npx tsx ai-tools/discover-selectors.ts <url>
 */
export const CAL_COM_SELECTORS = {
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

/** Booking path appended to BASE_URL. Override with `BOOKING_PATH` env var. */
export const CAL_COM_BOOKING_PATH = process.env.BOOKING_PATH || '/bailey/chat';

/** Display name shown on the example booker page — used by content-sanity assertions. */
export const CAL_COM_HOST_NAME =
  process.env.QA_TARGET_HOST_NAME || process.env.HOST_NAME || 'Bailey Pumfleet';

/**
 * Cal.com-specific TARGET. Inherits `baseUrl` from the generic toolkit
 * TARGET (env-driven, defaulting to https://cal.com when no `BASE_URL` is
 * set — see [ai-tools/selectors.ts](../../../ai-tools/selectors.ts)) and adds the booking-app
 * fields the demo specs need.
 */
export const CAL_COM_TARGET = {
  name: 'cal.com',
  description:
    'a scheduling and booking platform (the default example target shipped with this toolkit)',
  baseUrl: GENERIC_TARGET.baseUrl,
  bookingPath: CAL_COM_BOOKING_PATH,
  hostName: CAL_COM_HOST_NAME,
  bookingUrl: `${GENERIC_TARGET.baseUrl}${CAL_COM_BOOKING_PATH}`,
  get profileUrl(): string {
    return defaultProfileFromBookingUrl(this.bookingUrl);
  },
} as const;

/**
 * Path to this pack's `qa-checks.json`. Used by the data-consistency tool's
 * fallback resolution when no checks file exists at the workspace root.
 */
export const CAL_COM_CHECKS_PATH = path.join(__dirname, 'qa-checks.json');

/**
 * Cal.com fallback for the data-consistency tool — keyed data points and the
 * pages they should be consistent across. Mirrored as `qa-checks.json` in
 * this directory so the file can also be consumed via `--checks`.
 */
export function calComChecks(): Check[] {
  const PROFILE_URL = CAL_COM_TARGET.profileUrl;
  const EVENT_URL = CAL_COM_TARGET.bookingUrl;
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
