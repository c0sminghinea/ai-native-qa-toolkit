import { Page, Locator } from '@playwright/test';
import { DEFAULT_BOOKING_PATH } from '../../ai-tools/tool-utils';

export const DEFAULT_HOST_NAME = process.env.HOST_NAME || 'Bailey Pumfleet';

export class BookingPage {
  readonly page: Page;
  readonly bookerContainer: Locator;
  readonly eventTitle: Locator;
  readonly eventMeta: Locator;
  readonly monthLabel: Locator;
  readonly prevMonthButton: Locator;
  readonly nextMonthButton: Locator;
  readonly timezoneSelect: Locator;
  readonly overlayCalendarSwitch: Locator;

  constructor(page: Page) {
    this.page = page;
    this.bookerContainer = page.getByTestId('booker-container');
    this.eventTitle = page.getByTestId('event-title');
    this.eventMeta = page.getByTestId('event-meta');
    this.monthLabel = page.getByTestId('selected-month-label');
    this.prevMonthButton = page.getByTestId('decrementMonth');
    this.nextMonthButton = page.getByTestId('incrementMonth');
    this.timezoneSelect = page.getByTestId('timezone-select');
    this.overlayCalendarSwitch = page.getByTestId('overlay-calendar-switch');
  }

  get availableDays(): Locator {
    return this.page.getByTestId('day').and(this.page.locator(':not([disabled])'));
  }

  get firstAvailableDay(): Locator {
    return this.availableDays.first();
  }

  get firstTimeSlot(): Locator {
    return this.page.getByTestId('time').first();
  }

  get nameField(): Locator {
    return this.page.getByLabel(/name/i).or(this.page.getByPlaceholder(/your name/i)).first();
  }

  get confirmButton(): Locator {
    return this.page.getByRole('button', { name: /confirm|book|schedule/i }).first();
  }

  get validationError(): Locator {
    return this.page.getByText(/required|please enter|invalid/i).first();
  }

  get timeToggle12h(): Locator {
    return this.page.getByText('12h');
  }

  get timeToggle24h(): Locator {
    return this.page.getByText('24h');
  }

  get durationLabel(): Locator {
    return this.page.getByText('15m');
  }

  async goto(): Promise<void> {
    await this.page.goto(DEFAULT_BOOKING_PATH);
  }

  async selectFirstAvailableDate(): Promise<void> {
    await this.firstAvailableDay.click();
  }

  /** Clicks the first available time slot. Returns false if no slot appears — not a hard failure. */
  async selectFirstAvailableTimeSlot(): Promise<boolean> {
    const appeared = await this.firstTimeSlot
      .waitFor({ state: 'visible', timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (appeared) await this.firstTimeSlot.click();
    return appeared;
  }

  /** Submits the booking form empty to trigger validation. Returns false if the form didn't load. */
  async submitEmptyBookingForm(): Promise<boolean> {
    const appeared = await this.confirmButton
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (appeared) await this.confirmButton.click();
    return appeared;
  }

  async isCalendarVisible(): Promise<boolean> {
    return this.monthLabel.isVisible();
  }
}