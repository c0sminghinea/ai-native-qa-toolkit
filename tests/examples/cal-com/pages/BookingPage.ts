import { Page, Locator } from '@playwright/test';
import { SELECTORS, TARGET, DEFAULT_BOOKING_PATH } from '../../../../ai-tools/selectors';

/**
 * Example page object for the bundled cal.com demo. Selector strings come
 * from {@link SELECTORS} (overridable via `selectors.json` produced by
 * `discover-selectors.ts`), so re-pointing the toolkit at another booking
 * app does not require editing this file.
 */
export const DEFAULT_HOST_NAME = TARGET.hostName;

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
    this.bookerContainer = page.getByTestId(SELECTORS.BOOKER_CONTAINER);
    this.eventTitle = page.getByTestId(SELECTORS.EVENT_TITLE);
    this.eventMeta = page.getByTestId(SELECTORS.EVENT_META);
    this.monthLabel = page.getByTestId(SELECTORS.MONTH_LABEL);
    this.prevMonthButton = page.getByTestId(SELECTORS.PREV_MONTH);
    this.nextMonthButton = page.getByTestId(SELECTORS.NEXT_MONTH);
    this.timezoneSelect = page.getByTestId(SELECTORS.TIMEZONE_SELECT);
    this.overlayCalendarSwitch = page.getByTestId(SELECTORS.OVERLAY_CALENDAR_SWITCH);
  }

  get availableDays(): Locator {
    return this.page.getByTestId(SELECTORS.DAY).and(this.page.locator(':not([disabled])'));
  }

  get firstAvailableDay(): Locator {
    return this.availableDays.first();
  }

  get firstTimeSlot(): Locator {
    return this.page.getByTestId(SELECTORS.TIME).first();
  }

  get nameField(): Locator {
    return this.page
      .getByLabel(/name/i)
      .or(this.page.getByPlaceholder(/your name/i))
      .first();
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
}
