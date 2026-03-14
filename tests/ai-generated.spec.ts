import { test, expect } from '@playwright/test';

class ChatPage {
  private page: any;

  constructor(page: any) {
    this.page = page;
  }

  get bookerContainer() {
    return this.page.getByTestId('booker-container');
  }

  get overlayCalendarSwitch() {
    return this.page.getByTestId('overlay-calendar-switch');
  }

  get toggleGroupItemMonthView() {
    return this.page.getByRole('button', { name: '$Switch to monthly view' });
  }

  get toggleGroupItemWeekView() {
    return this.page.getByRole('button', { name: '$Switch to weekly view' });
  }

  get toggleGroupItemColumnView() {
    return this.page.getByRole('button', { name: '$Switch to column view' });
  }

  get calendarIcon() {
    return this.page.getByTestId('calendar-icon');
  }

  get grid3x3Icon() {
    return this.page.getByTestId('grid-3x3-icon');
  }

  get columns3Icon() {
    return this.page.getByTestId('columns-3-icon');
  }

  get eventMeta() {
    return this.page.getByTestId('event-meta');
  }

  get avatarHref() {
    return this.page.getByTestId('avatar-href');
  }

  get avatar() {
    return this.page.getByTestId('avatar');
  }

  get eventTitle() {
    return this.page.getByTestId('event-title');
  }

  get eventMetaDescription() {
    return this.page.getByTestId('event-meta-description');
  }

  get eventMetaCurrentTimezone() {
    return this.page.getByTestId('event-meta-current-timezone');
  }

  get timezoneSelect() {
    return this.page.getByTestId('timezone-select');
  }

  get selectedMonthLabel() {
    return this.page.getByTestId('selected-month-label');
  }

  get decrementMonth() {
    return this.page.getByRole('button', { name: '' });
  }

  get incrementMonth() {
    return this.page.getByRole('button', { name: '' });
  }

  dayButton(dayNumber: string) {
    return this.page.getByRole('button', { name: dayNumber });
  }

  get toggleGroupItemHmma() {
    return this.page.getByRole('button', { name: '12h' });
  }

  get toggleGroupItemHhmm() {
    return this.page.getByRole('button', { name: '24h' });
  }

 timeButton(time: string) {
    return this.page.getByRole('button', { name: time });
  }
}

test.describe('Chat Page', () => {
  test('loads correctly', async ({ page }) => {
    const chatPage = new ChatPage(page);
    await page.goto('https://i.cal.com/bailey/chat?user=bailey&type=chat&orgRedirection=true');
    await expect(chatPage.bookerContainer).toBeVisible();
  });

  test('contains required elements', async ({ page }) => {
    const chatPage = new ChatPage(page);
    await page.goto('https://i.cal.com/bailey/chat?user=bailey&type=chat&orgRedirection=true');
    await expect(chatPage.bookerContainer).toBeVisible();
    await expect(chatPage.eventMeta).toBeVisible();
    await expect(chatPage.eventTitle).toBeVisible();
    await expect(chatPage.eventMetaDescription).toBeVisible();
  });

  test('click date button', async ({ page }) => {
    const chatPage = new ChatPage(page);
    await page.goto('https://i.cal.com/bailey/chat?user=bailey&type=chat&orgRedirection=true');
    await chatPage.dayButton('20').click();
    await expect(chatPage.bookerContainer).toBeVisible();
  });

  test('click time slot button', async ({ page }) => {
    const chatPage = new ChatPage(page);
    await page.goto('https://i.cal.com/bailey/chat?user=bailey&type=chat&orgRedirection=true');
    await chatPage.timeButton('10:00pm').click();
    await expect(chatPage.bookerContainer).toBeVisible();
  });

  test('works correctly on mobile', async ({ page }) => {
    const chatPage = new ChatPage(page);
    await page.goto('https://i.cal.com/bailey/chat?user=bailey&type=chat&orgRedirection=true');
    await page.evaluate('_ => _.window.innerWidth = 480');
    await page.evaluate('_ => _.window.innerHeight = 640');
    await expect(chatPage.bookerContainer).toBeVisible();
  });
});