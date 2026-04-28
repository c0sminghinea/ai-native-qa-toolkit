import { Page, Locator } from '@playwright/test';
import { WIKI_TARGET as TARGET } from '../target';

/**
 * Page object for a Wikipedia article. Mirrors the conventions of
 * [BookingPage](../../cal-com/pages/BookingPage.ts):
 *
 *   - public `readonly page` for direct test access when needed
 *   - every locator initialised in the constructor (no per-call lookups)
 *   - getters reserved for composed / multi-strategy locators
 *   - a single `goto()` that reads the URL from the target pack
 *
 * Wikipedia ships no `data-testid` attributes, so locators are either
 * stable element ids or ARIA roles — making this a useful reference for
 * users adapting the toolkit to apps that don't have a testid scaffold.
 */
export const DEFAULT_ARTICLE_URL = TARGET.bookingUrl;

export class ArticlePage {
  readonly page: Page;

  /** Top-level article heading (`<h1 id="firstHeading">`). */
  readonly title: Locator;

  /** First paragraph of body copy — sanity check that content rendered. */
  readonly firstParagraph: Locator;

  /** Global search input — accessible by role on every Wikipedia page. */
  readonly searchInput: Locator;

  /** Footer "this page was last edited on …" line. */
  readonly lastModified: Locator;

  constructor(page: Page) {
    this.page = page;
    this.title = page.locator('h1#firstHeading');
    this.firstParagraph = page.locator('#mw-content-text p').first();
    this.searchInput = page.getByRole('searchbox', { name: /search/i }).first();
    this.lastModified = page.locator('#footer-info-lastmod');
  }

  /**
   * Table of contents. Wikipedia ships several variants depending on skin
   * (legacy Vector `#toc`, Vector-2022 sidebar `#vector-toc`, inline
   * navigation landmarks). We accept any of them. Empty Locator on
   * articles that have no TOC; callers should `count()`-check before
   * asserting.
   */
  get tableOfContents(): Locator {
    return this.page
      .locator(
        [
          '#toc',
          '#mw-panel-toc',
          '#vector-toc',
          '[role="navigation"][aria-labelledby="mw-toc-heading"]',
          '[role="navigation"][aria-labelledby="mw-panel-toc-label"]',
        ].join(', ')
      )
      .first();
  }

  /**
   * Section anchors inside the table of contents — real `#section` links,
   * excluding Wikipedia's "(Top)" entry which is rendered as `href="#"`.
   */
  get tocSectionLinks(): Locator {
    return this.tableOfContents.locator('a[href^="#"]:not([href="#"])');
  }

  async goto(url: string = DEFAULT_ARTICLE_URL): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }
}
