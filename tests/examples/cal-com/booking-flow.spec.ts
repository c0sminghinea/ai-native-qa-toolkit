import { test, expect } from '@playwright/test';
import { BookingPage, DEFAULT_HOST_NAME as HOST_NAME } from './pages/BookingPage';

// Example suite — exercises the booking flow of the bundled cal.com demo.
// Move/rewrite under tests/examples/<your-app>/ when re-pointing the toolkit.
test.describe('Example: booking flow', () => {
  let bookingPage: BookingPage;

  test.beforeEach(async ({ page }) => {
    bookingPage = new BookingPage(page);
    await bookingPage.goto();
  });

  test('booking page loads and displays event details', async () => {
    await expect(bookingPage.eventTitle).toBeVisible();
    await expect(bookingPage.eventMeta.getByText(HOST_NAME)).toBeVisible();
    await expect(bookingPage.durationLabel).toBeVisible();
  });

  test('calendar is visible and contains selectable dates', async () => {
    await expect(bookingPage.monthLabel).toBeVisible();
    await expect(bookingPage.firstAvailableDay).toBeVisible();
  });

  test('clicking a date shows available time slots', async () => {
    await bookingPage.selectFirstAvailableDate();
    await expect(bookingPage.timeToggle12h).toBeVisible();
    await expect(bookingPage.timeToggle24h).toBeVisible();
  });

  test('booking page is responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await bookingPage.goto();
    await expect(bookingPage.eventTitle).toBeVisible();
    await expect(bookingPage.eventMeta.getByText(HOST_NAME)).toBeVisible();
  });

  test('next month button advances the calendar', async () => {
    const initialMonth = await bookingPage.monthLabel.textContent();
    await bookingPage.nextMonthButton.click();
    // Use Playwright's auto-retrying assertion so Firefox's slower DOM update doesn't flake
    await expect(bookingPage.monthLabel).not.toHaveText(initialMonth!);
  });

  test('timezone selector is visible and interactive', async () => {
    await expect(bookingPage.timezoneSelect).toBeVisible();
    await bookingPage.timezoneSelect.click();
    await expect(bookingPage.timezoneSelect).toBeVisible();
  });

  test('booking form appears after selecting a time slot', async () => {
    await bookingPage.selectFirstAvailableDate();
    const slotSelected = await bookingPage.selectFirstAvailableTimeSlot();
    if (!slotSelected) {
      test.skip(true, 'No time slots available — skipping form check');
      return;
    }
    await expect(bookingPage.nameField).toBeVisible({ timeout: 5000 });
  });

  test('booking form validates required fields on empty submit', async () => {
    await bookingPage.selectFirstAvailableDate();
    const slotSelected = await bookingPage.selectFirstAvailableTimeSlot();
    if (!slotSelected) {
      test.skip(true, 'No time slots available — skipping validation check');
      return;
    }
    const formAppeared = await bookingPage.submitEmptyBookingForm();
    if (!formAppeared) {
      test.skip(true, 'Booking form did not load — skipping validation check');
      return;
    }
    await expect(bookingPage.validationError).toBeVisible({ timeout: 3000 });
  });

  test('previous month button never goes before the current month', async () => {
    // Most schedulers (cal.com included) disable past navigation. Verify either
    // the button is disabled or pressing it doesn't change the visible month.
    const initialMonth = await bookingPage.monthLabel.textContent();
    const isDisabled = await bookingPage.prevMonthButton.isDisabled().catch(() => false);
    if (isDisabled) {
      // Disabled is the canonical correct UX.
      expect(isDisabled).toBe(true);
      return;
    }
    await bookingPage.prevMonthButton.click();
    // Allow a beat for any state transition.
    await bookingPage.page.waitForTimeout(200);
    const after = await bookingPage.monthLabel.textContent();
    expect(after, 'past navigation should not advance backwards').toBe(initialMonth);
  });

  test('navigating month then back returns to original label', async () => {
    const initialMonth = await bookingPage.monthLabel.textContent();
    await bookingPage.nextMonthButton.click();
    await expect(bookingPage.monthLabel).not.toHaveText(initialMonth!);
    await bookingPage.prevMonthButton.click();
    await expect(bookingPage.monthLabel).toHaveText(initialMonth!);
  });

  test('booker URL is shareable — direct navigation matches initial render', async ({ page }) => {
    // Reload should produce the same primary content. Catches state-only routes.
    const titleBefore = await bookingPage.eventTitle.textContent();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(bookingPage.eventTitle).toBeVisible();
    const titleAfter = await bookingPage.eventTitle.textContent();
    expect(titleAfter).toBe(titleBefore);
  });
});
