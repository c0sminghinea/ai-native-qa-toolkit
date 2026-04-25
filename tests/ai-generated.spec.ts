import { test, expect } from '@playwright/test';
import { BookingPage, DEFAULT_HOST_NAME } from './pages/BookingPage';

test.describe('Chat Page', () => {
  let bookingPage: BookingPage;

  test.beforeEach(async ({ page }) => {
    bookingPage = new BookingPage(page);
    await bookingPage.goto();
  });

  test('should load chat page with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(new RegExp(DEFAULT_HOST_NAME));
  });

  test('should display key booking elements', async () => {
    await expect(bookingPage.bookerContainer).toBeVisible();
    await expect(bookingPage.eventTitle).toBeVisible();
    await expect(bookingPage.eventMeta).toBeVisible();
    await expect(bookingPage.monthLabel).toBeVisible();
    await expect(bookingPage.timezoneSelect).toBeVisible();
    await expect(bookingPage.overlayCalendarSwitch).toBeVisible();
  });

  test('should display calendar with selectable days', async () => {
    await expect(bookingPage.firstAvailableDay).toBeVisible();
    const count = await bookingPage.availableDays.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should show time slots after clicking a day', async () => {
    await bookingPage.selectFirstAvailableDate();
    await expect(bookingPage.firstTimeSlot).toBeVisible({ timeout: 8000 });
  });

  test('should advance calendar to next month', async () => {
    const initialMonth = await bookingPage.monthLabel.textContent();
    await bookingPage.nextMonthButton.click();
    await expect(bookingPage.monthLabel).not.toHaveText(initialMonth!);
  });

  test('should go back to previous month', async () => {
    await bookingPage.nextMonthButton.click();
    const forwardMonth = await bookingPage.monthLabel.textContent();
    await bookingPage.prevMonthButton.click();
    await expect(bookingPage.monthLabel).not.toHaveText(forwardMonth!);
  });

  test('should display 12h / 24h toggle after date selection', async () => {
    await bookingPage.selectFirstAvailableDate();
    await expect(bookingPage.timeToggle12h).toBeVisible({ timeout: 8000 });
    await expect(bookingPage.timeToggle24h).toBeVisible({ timeout: 8000 });
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await bookingPage.goto();
    await expect(bookingPage.bookerContainer).toBeVisible();
    await expect(bookingPage.eventTitle).toBeVisible();
  });

  test('should open booking form after selecting a time slot', async () => {
    await bookingPage.selectFirstAvailableDate();
    const slotSelected = await bookingPage.selectFirstAvailableTimeSlot();
    if (!slotSelected) {
      test.skip(true, 'No time slots available — skipping form check');
      return;
    }
    await expect(bookingPage.nameField).toBeVisible({ timeout: 5000 });
  });
});
