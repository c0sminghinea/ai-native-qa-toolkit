import { test, expect, Page, Locator } from '@playwright/test';
import { BookingPage } from './pages/BookingPage';

// Self-healing locator: tries multiple strategies in order
// If the primary selector breaks, it falls back to the next one
async function selfHealingLocator(page: Page, strategies: (() => Locator)[]): Promise<Locator> {
  for (const strategy of strategies) {
    const locator = strategy();
    if (await locator.isVisible({ timeout: 2000 }).catch(() => false)) {
      return locator;
    }
  }
  // Return the last strategy as final fallback — Playwright will surface the error
  return strategies[strategies.length - 1]();
}

test.describe('Cal.com Booking Flow', () => {
  let bookingPage: BookingPage;

  test.beforeEach(async ({ page }) => {
    bookingPage = new BookingPage(page);
    await bookingPage.goto();
  });

  test('booking page loads and displays event details', async ({ page }) => {
    // Self-healing: tries data-testid first, falls back to h1, then text
    const titleLocator = await selfHealingLocator(page, [
      () => page.getByTestId('event-title'),
      () => page.locator('h1').first(),
      () => page.getByText('Chat', { exact: true }),
    ]);

    await expect(titleLocator).toBeVisible();
    await expect(bookingPage.eventMeta.getByText('Bailey Pumfleet')).toBeVisible();
    await expect(page.getByText('15m')).toBeVisible();
  });

  test('calendar is visible and contains selectable dates', async ({ page }) => {
    await expect(bookingPage.monthLabel).toBeVisible();
    await expect(page.getByRole('button', { name: '23', exact: true })).toBeVisible();
  });

  test('clicking a date shows available time slots', async ({ page }) => {
    await bookingPage.selectDate('23');
    await expect(page.getByText('12h')).toBeVisible();
    await expect(page.getByText('24h')).toBeVisible();
  });

  test('booking page is responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await bookingPage.goto();

    // Self-healing: tries data-testid first, falls back to h1
    const titleLocator = await selfHealingLocator(page, [
      () => page.getByTestId('event-title'),
      () => page.locator('h1').first(),
    ]);

    await expect(titleLocator).toBeVisible();
    await expect(bookingPage.eventMeta.getByText('Bailey Pumfleet')).toBeVisible();
  });

});