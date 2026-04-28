/**
 * Self-contained Playwright spec used as input for the coverage-advisor
 * integration test. Intentionally minimal so the advisor reports clear
 * coverage gaps. Not executed by Playwright in this repo (lives under
 * tests-unit/integration/fixtures/).
 */
import { test, expect } from '@playwright/test';

test.describe('Sample app — homepage', () => {
  test('renders the page heading', async ({ page }) => {
    await page.goto('http://127.0.0.1/');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('shows the primary CTA', async ({ page }) => {
    await page.goto('http://127.0.0.1/');
    await expect(page.getByTestId('checkout-cta')).toBeVisible();
  });
});
