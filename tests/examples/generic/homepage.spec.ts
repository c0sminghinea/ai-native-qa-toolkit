import { test, expect } from '@playwright/test';

// Lightweight smoke checks for the marketing/home origin of the target app.
// Booking-flow specs already cover the deep-link booker; these guard against
// origin-level breakage (DNS, SSL, redirect loops, hard 5xx).

test.describe('Homepage smoke', () => {
  test('root URL returns 2xx and renders HTML', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response, 'goto returned no response').not.toBeNull();
    expect(response!.status(), `unexpected status ${response!.status()}`).toBeLessThan(400);

    // Sanity: rendered <html> with non-trivial body content.
    const bodyText = (await page.locator('body').innerText()).trim();
    expect(bodyText.length).toBeGreaterThan(50);
  });

  test('document has a non-empty <title>', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    expect(title.trim().length, 'page title is empty').toBeGreaterThan(0);
  });

  test('exposes basic SEO meta tags', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    // viewport is required for any responsive site.
    await expect(page.locator('meta[name="viewport"]')).toHaveCount(1);
    // At least one of description / og:description should exist on a marketing site.
    const descCount = await page
      .locator('meta[name="description"], meta[property="og:description"]')
      .count();
    expect(descCount, 'no description meta tag found').toBeGreaterThan(0);
  });

  test('serves a 4xx (not a 5xx or hang) for an unknown route', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist-xyz123', {
      waitUntil: 'domcontentloaded',
    });
    expect(response).not.toBeNull();
    const status = response!.status();
    // Some apps soft-404 with 200 + custom page. Both are acceptable; what we
    // really want to catch is an outright 5xx or a redirect loop.
    expect(status, `unexpected status ${status}`).toBeLessThan(500);
  });
});
