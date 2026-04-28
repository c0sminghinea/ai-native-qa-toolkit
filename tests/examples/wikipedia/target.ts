/**
 * Wikipedia target pack — second example, used to validate that the toolkit
 * abstraction is genuinely target-agnostic and not accidentally
 * scheduling-shaped.
 *
 * Wikipedia is intentionally chosen because it differs from the cal.com pack
 * in three meaningful ways:
 *   1. **No `data-testid` attributes** — Wikipedia uses semantic HTML and
 *      ARIA roles. The selector overlay (`selectors.json`) is therefore
 *      empty, and the POM relies on Playwright's `getByRole` / id selectors.
 *      This exercises the toolkit's "no testid scaffold" code path.
 *   2. **No booking flow** — there is no calendar, no time slot, no
 *      checkout. Tools that depend on `SELECTORS.DAY` / `SELECTORS.TIME`
 *      etc. must no-op gracefully.
 *   3. **Cross-render consistency, not cross-page** — the data-consistency
 *      check compares the desktop article with its mobile counterpart,
 *      reusing the `bookingUrl`/`profileUrl` slots as generic "primary" and
 *      "secondary" URLs.
 *
 * Activate this pack by running its spec directly:
 *   npx playwright test tests/examples/wikipedia/article.spec.ts
 *
 * Or by importing `WIKI_TARGET` and `wikiChecks` from a tool invocation.
 */
import * as path from 'path';
import type { Check } from '../../../ai-tools/checks-config';

/** Wikipedia desktop origin. Override via `WIKI_BASE_URL`. */
export const WIKI_BASE_URL = process.env.WIKI_BASE_URL || 'https://en.wikipedia.org';

/** Wikipedia mobile origin. Override via `WIKI_MOBILE_BASE_URL`. */
export const WIKI_MOBILE_BASE_URL =
  process.env.WIKI_MOBILE_BASE_URL || 'https://en.m.wikipedia.org';

/** Stable example article. Override via `WIKI_ARTICLE_PATH`. */
export const WIKI_ARTICLE_PATH = process.env.WIKI_ARTICLE_PATH || '/wiki/Playwright_(software)';

/**
 * Wikipedia exposes no `data-testid` attributes on article pages. The
 * overlay map is therefore empty — the toolkit's tools that consult
 * `SELECTORS.X` will see `undefined` for every key and no-op cleanly,
 * which is exactly the contract this pack is here to validate.
 */
export const WIKI_SELECTORS = {} as const;

/**
 * Wikipedia-shaped TARGET. The `bookingUrl` / `profileUrl` field names are
 * generic anchors retained for compatibility with the toolkit's existing
 * placeholder grammar — here they map to the desktop and mobile renders of
 * the same article.
 */
export const WIKI_TARGET = {
  name: 'wikipedia',
  description:
    'a content / encyclopedia website (used as a non-scheduling target to validate the toolkit abstraction)',
  baseUrl: WIKI_BASE_URL,
  bookingPath: WIKI_ARTICLE_PATH,
  hostName: 'Wikipedia',
  bookingUrl: `${WIKI_BASE_URL}${WIKI_ARTICLE_PATH}`,
  profileUrl: `${WIKI_MOBILE_BASE_URL}${WIKI_ARTICLE_PATH}`,
} as const;

/**
 * Path to this pack's `qa-checks.json`. Useful when invoking the
 * data-consistency tool with `--checks` against this target.
 */
export const WIKI_CHECKS_PATH = path.join(__dirname, 'qa-checks.json');

/**
 * Programmatic equivalent of `qa-checks.json` — the desktop and mobile
 * Wikipedia renders should agree on the article's title and last-modified
 * timestamp. A discrepancy would indicate a CDN or rollout bug.
 */
export function wikiChecks(): Check[] {
  const renders = [
    { name: 'Desktop Article', url: WIKI_TARGET.bookingUrl },
    { name: 'Mobile Article', url: WIKI_TARGET.profileUrl },
  ];
  const pagesFor = (description: string) => renders.map(r => ({ ...r, description }));

  return [
    { key: 'article title', pages: pagesFor('Article title rendering') },
    { key: 'last modified date', pages: pagesFor('Footer last-edited timestamp') },
  ];
}
