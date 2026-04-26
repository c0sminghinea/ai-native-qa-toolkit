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
    // Single evaluate() call instead of per-element round-trips to avoid timeouts on
    // pages with many images (e.g. 88+ images × 30 ms/call > 30 s timeout).
    const { total, missing } = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return {
        total: imgs.length,
        missing: imgs
          .filter(img => img.getAttribute('alt') === null)
          .map(img => img.src || '<no src>'),
      };
    });
    if (total === 0) test.skip(true, 'no images on this page');
    softExpect(
      missing.length === 0,
      `${missing.length} image(s) missing alt: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? '…' : ''}`,
      testInfo
    );
  });

  test('all visible <button>s have an accessible name', async ({ page }, testInfo) => {
    const count = await page.locator('button:visible').count();
    if (count === 0) test.skip(true, 'no visible buttons');

    // Single evaluate() call — avoids N Playwright round-trips for pages with many buttons.
    const nameless = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button'))
        .filter(btn => {
          const r = btn.getBoundingClientRect();
          const s = window.getComputedStyle(btn);
          return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
        })
        .reduce<number[]>((acc, btn, i) => {
          const aria = btn.getAttribute('aria-label') ?? '';
          const label = btn.getAttribute('aria-labelledby') ?? '';
          const text = (btn.textContent ?? '').trim();
          const title = btn.getAttribute('title') ?? '';
          if (!aria && !label && !text && !title) acc.push(i);
          return acc;
        }, [])
    );
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
