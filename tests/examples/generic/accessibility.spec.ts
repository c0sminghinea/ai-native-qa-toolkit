import { test, expect, type TestInfo } from '@playwright/test';

// Accessibility / document-quality checks. By default, findings are recorded
// as test annotations rather than failures so that regressions in the target
// site (which we don't control) don't break our CI. Set STRICT_A11Y=1 to flip
// every soft check into a hard assertion — useful when this toolkit points at
// an app you do own.

const STRICT = !!process.env.STRICT_A11Y;

function softExpect(condition: boolean, message: string, info: TestInfo): void {
  if (STRICT) {
    expect(condition, message).toBe(true);
  } else if (!condition) {
    info.annotations.push({ type: 'a11y-finding', description: message });
  }
}

test.describe('Accessibility basics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  });

  test('<html> declares a lang attribute', async ({ page }) => {
    // lang missing is severe enough to always fail, even outside strict mode.
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang, '<html lang> missing').toBeTruthy();
    expect(lang!.length, '<html lang> empty').toBeGreaterThan(0);
  });

  test('document has at least one <h1>', async ({ page }) => {
    await page.waitForLoadState('networkidle').catch(() => {});
    const h1s = await page.locator('h1').count();
    expect(h1s, 'no <h1> found on the page').toBeGreaterThanOrEqual(1);
  });

  test('every <img> has an alt attribute', async ({ page }, testInfo) => {
    await page.waitForLoadState('networkidle').catch(() => {});
    const imgs = page.locator('img');
    const count = await imgs.count();
    if (count === 0) test.skip(true, 'no images on this page');

    const missing: string[] = [];
    for (let i = 0; i < count; i++) {
      const img = imgs.nth(i);
      const alt = await img.getAttribute('alt');
      if (alt === null) missing.push((await img.getAttribute('src')) ?? '<no src>');
    }
    softExpect(
      missing.length === 0,
      `${missing.length} image(s) missing alt: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}`,
      testInfo
    );
  });

  test('all visible <button>s have an accessible name', async ({ page }, testInfo) => {
    const buttons = page.locator('button:visible');
    const count = await buttons.count();
    if (count === 0) test.skip(true, 'no visible buttons');

    const nameless: number[] = [];
    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      const aria = (await btn.getAttribute('aria-label')) ?? '';
      const label = (await btn.getAttribute('aria-labelledby')) ?? '';
      const text = (await btn.innerText()).trim();
      const title = (await btn.getAttribute('title')) ?? '';
      if (!aria && !label && !text && !title) nameless.push(i);
    }
    softExpect(
      nameless.length === 0,
      `${nameless.length} button(s) without accessible name (indices: ${nameless.slice(0, 5).join(',')})`,
      testInfo
    );
  });

  test('a main landmark exists', async ({ page }, testInfo) => {
    const mainCount = await page.locator('main, [role="main"]').count();
    softExpect(mainCount > 0, 'no <main>/[role=main] landmark on the page', testInfo);
  });
});
