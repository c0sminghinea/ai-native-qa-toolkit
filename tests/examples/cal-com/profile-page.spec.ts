import { test, expect } from '@playwright/test';
import { CAL_COM_SELECTORS as SELECTORS, CAL_COM_TARGET as TARGET } from './target';

// Example suite — profile/landing page that contains links to bookable
// events. Selector strings come from the cal.com target pack ([target.ts](target.ts)),
// so re-pointing the toolkit means copying this folder, not editing this file.
const PROFILE_URL = TARGET.profileUrl;

test.describe('Example: profile page', () => {
  test.beforeEach(async ({ page }) => {
    const response = await page.goto(PROFILE_URL, { waitUntil: 'domcontentloaded' });
    if (!response || response.status() >= 400) {
      test.skip(true, `profile page unreachable: status=${response?.status() ?? 'no response'}`);
    }
  });

  test('renders a profile page with discoverable event links', async ({ page }) => {
    // Wait briefly for CSR hydration.
    await page.waitForLoadState('networkidle').catch(() => {});

    // Any anchor whose href looks like a booking link (/<user>/<event>) is fair game.
    const profilePath = new URL(PROFILE_URL).pathname.replace(/\/$/, '');
    const eventLinks = page.locator(`a[href*="${profilePath}/"]`);
    const count = await eventLinks.count();
    expect(count, 'no event links found on profile page').toBeGreaterThan(0);
  });

  test('clicking an event link navigates to a booker page', async ({ page }) => {
    await page.waitForLoadState('networkidle').catch(() => {});
    const profilePath = new URL(PROFILE_URL).pathname.replace(/\/$/, '');
    const firstEvent = page.locator(`a[href*="${profilePath}/"]`).first();

    if ((await firstEvent.count()) === 0) {
      test.skip(true, 'no event links to follow');
    }

    const href = await firstEvent.getAttribute('href');
    expect(href, 'event link missing href').toBeTruthy();

    await Promise.all([page.waitForLoadState('domcontentloaded'), firstEvent.click()]);

    // Booker landing identifier — references SELECTORS so target overrides flow through.
    const landed = await Promise.race([
      page
        .getByTestId(SELECTORS.BOOKER_CONTAINER)
        .waitFor({ state: 'visible', timeout: 8000 })
        .then(() => true)
        .catch(() => false),
      page
        .getByTestId(SELECTORS.MONTH_LABEL)
        .waitFor({ state: 'visible', timeout: 8000 })
        .then(() => true)
        .catch(() => false),
    ]);
    expect(landed, `event click did not land on a booker page (current url: ${page.url()})`).toBe(
      true
    );
  });
});
