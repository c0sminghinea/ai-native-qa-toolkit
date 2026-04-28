/**
 * Page Object Model for a Wikipedia article page.
 *
 * Companion to the cal.com `BookingPage` POM, but with no data-testid
 * dependencies — every locator is either a semantic role or a stable
 * Wikipedia-internal element id. This makes the pack a reference for users
 * whose own apps don't ship with a testid scaffold.
 */
import type { Page, Locator, Response } from '@playwright/test';

export class ArticlePage {
  constructor(private readonly page: Page) {}

  /** Navigate to a fully-qualified article URL. */
  goto(url: string): Promise<Response | null> {
    return this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  /** Top-level article heading (`<h1 id="firstHeading">`). */
  get title(): Locator {
    return this.page.locator('h1#firstHeading');
  }

  /** First paragraph of body copy — sanity check that content rendered. */
  get firstParagraph(): Locator {
    return this.page.locator('#mw-content-text p').first();
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

  /** Global search input — accessible by role on every Wikipedia page. */
  get searchInput(): Locator {
    return this.page.getByRole('searchbox', { name: /search/i }).first();
  }

  /** Footer "this page was last edited on …" line. */
  get lastModified(): Locator {
    return this.page.locator('#footer-info-lastmod');
  }
}
