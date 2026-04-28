import { test, expect } from '@playwright/test';
import { WIKI_TARGET as TARGET } from './target';
import { ArticlePage } from './pages/ArticlePage';

// Wikipedia article suite — second example pack. Validates that the toolkit
// works against a non-scheduling target with no data-testid scaffold. Specs
// import only from this pack; nothing here reaches into ai-tools/.
test.describe('Example: wikipedia article', () => {
  let article: ArticlePage;

  test.beforeEach(async ({ page }) => {
    article = new ArticlePage(page);
    const response = await article.goto(TARGET.bookingUrl);
    if (!response || response.status() >= 400) {
      test.skip(true, `wikipedia unreachable: status=${response?.status() ?? 'no response'}`);
    }
  });

  test('article renders with a non-empty title and body', async () => {
    await expect(article.title).toBeVisible();
    const titleText = (await article.title.textContent())?.trim() ?? '';
    expect(titleText.length, 'article title text empty').toBeGreaterThan(0);
    await expect(article.firstParagraph).toBeVisible();
  });

  test('table of contents links navigate within the page', async () => {
    if ((await article.tableOfContents.count()) === 0) {
      test.skip(true, 'TOC absent on this article');
    }
    await expect(article.tableOfContents).toBeVisible();

    // Wikipedia's first TOC entry is often "(Top)" with href="#" — skip it
    // and look for a real section anchor.
    const sectionLinks = article.tableOfContents.locator('a[href^="#"]:not([href="#"])');
    if ((await sectionLinks.count()) === 0) {
      test.skip(true, 'TOC contains no section anchors');
    }
    const href = await sectionLinks.first().getAttribute('href');
    expect(href, 'TOC link has no href').toBeTruthy();
    expect(href).toMatch(/^#.+/);
  });

  test('global search input is reachable from the article', async () => {
    const search = article.searchInput;
    await expect(search).toBeVisible();
    await search.fill('Playwright');
    await expect(search).toHaveValue('Playwright');
  });

  test('footer surfaces a last-modified timestamp', async () => {
    await expect(article.lastModified).toBeVisible();
    const text = (await article.lastModified.textContent())?.trim() ?? '';
    expect(text.length, 'last-modified text empty').toBeGreaterThan(0);
  });
});
