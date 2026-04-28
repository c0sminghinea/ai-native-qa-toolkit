import { test, expect } from '@playwright/test';
import { ArticlePage, DEFAULT_ARTICLE_URL as ARTICLE_URL } from './pages/ArticlePage';

// Example suite — exercises a Wikipedia article. Non-scheduling counterpart
// to the cal.com pack; validates the toolkit's "no testid scaffold" path.
test.describe('Example: wikipedia article', () => {
  let article: ArticlePage;

  test.beforeEach(async ({ page }) => {
    article = new ArticlePage(page);
    const response = await page.goto(ARTICLE_URL, { waitUntil: 'domcontentloaded' });
    if (!response || response.status() >= 400) {
      test.skip(true, `wikipedia unreachable: status=${response?.status() ?? 'no response'}`);
    }
  });

  test('article page loads with title and body content', async () => {
    await expect(article.title).toBeVisible();
    await expect(article.title).not.toHaveText('');
    await expect(article.firstParagraph).toBeVisible();
  });

  test('table of contents links to in-page sections', async () => {
    if ((await article.tableOfContents.count()) === 0) {
      test.skip(true, 'TOC absent on this article');
      return;
    }
    await expect(article.tableOfContents).toBeVisible();

    if ((await article.tocSectionLinks.count()) === 0) {
      test.skip(true, 'TOC contains no section anchors');
      return;
    }
    const href = await article.tocSectionLinks.first().getAttribute('href');
    expect(href, 'TOC link has no href').toMatch(/^#.+/);
  });

  test('global search input is reachable and accepts input', async () => {
    await expect(article.searchInput).toBeVisible();
    await article.searchInput.fill('Playwright');
    await expect(article.searchInput).toHaveValue('Playwright');
  });

  test('footer surfaces a last-modified timestamp', async () => {
    await expect(article.lastModified).toBeVisible();
    await expect(article.lastModified).not.toHaveText('');
  });

  test('article URL is shareable — reload preserves the title', async ({ page }) => {
    const titleBefore = await article.title.textContent();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(article.title).toBeVisible();
    await expect(article.title).toHaveText(titleBefore!);
  });
});
