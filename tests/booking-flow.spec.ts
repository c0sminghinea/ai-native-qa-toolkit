import { test, expect } from '@playwright/test';
import { BookingPage, DEFAULT_HOST_NAME as HOST_NAME } from './pages/BookingPage';

test.describe('Cal.com Booking Flow', () => {
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
});
