// page-object.ts
export class BookingPagePO {
  constructor(private page: any) {}

  get pageHeader() {
    return this.page.getByText('Book a time to chat with Bailey');
  }

  get nameInput() {
    return this.page.getByTestId('name-input');
  }

  get emailInput() {
    return this.page.getByTestId('email-input');
  }

  get phoneNumberInput() {
    return this.page.getByTestId('phone-number-input');
  }

  get eventDurationSelect() {
    return this.page.getByTestId('event-duration-select');
  }

  get findTimeButton() {
    return this.page.getByText('Find a time');
  }

  get calendar() {
    try {
      return this.page.getByTestId('calendar');
    } catch {
      return this.page.getByRole('grid', { name: 'Calendar' });
    }
  }

  get timeSlots() {
    try {
      return this.page.getByTestId('time-slots');
    } catch {
      return this.page.getAllByRole('button', { name: /Select time/ });
    }
  }

  get bookButton() {
    try {
      return this.page.getByTestId('book-button');
    } catch {
      return this.page.getByText('Book');
    }
  }
}
