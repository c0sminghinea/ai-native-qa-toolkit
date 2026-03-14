import { Page, Locator } from '@playwright/test';

export class BookingPage {
  readonly page: Page;
  readonly eventTitle: Locator;
  readonly eventMeta: Locator;
  readonly monthLabel: Locator;
  readonly nextMonthButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.eventTitle = page.getByTestId('event-title');
    this.eventMeta = page.getByTestId('event-meta');
    this.monthLabel = page.getByText('March 2026');
    this.nextMonthButton = page.getByRole('button', { name: 'Go to next month' });
  }

  async goto() {
    await this.page.goto('https://cal.com/bailey/chat');
  }

  async selectDate(day: string) {
    await this.page.getByRole('button', { name: day, exact: true }).click();
  }

  async getHostName(): Promise<string | null> {
    return this.eventMeta.getByText('Bailey Pumfleet').textContent();
  }

  async isCalendarVisible(): Promise<boolean> {
    return this.monthLabel.isVisible();
  }
}