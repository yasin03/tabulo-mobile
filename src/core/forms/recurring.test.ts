import {
  createPaymentFormSchema,
  createRecurringFormSchema,
  emptyRecurringForm,
} from './recurring';
import { createReminderFormSchema } from './reminder';

const schema = createRecurringFormSchema({ language: 'tr' });
const valid = {
  ...emptyRecurringForm('2026-10-20', '09:00'),
  title: ' Dükkan  kirası ',
  amount: '8.500',
  accountId: 'a1',
};

const messages = (result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) => Object.fromEntries((result.error?.issues ?? []).map((i) => [String(i.path[0]), i.message]));

describe('düzenli ödeme formu', () => {
  it('geçerli girişi dönüştürür', () => {
    const result = schema.safeParse(valid);
    expect(result.success && result.data).toEqual(
      expect.objectContaining({
        title: 'Dükkan kirası',
        amountMinor: 850000,
        accountId: 'a1',
        contactId: null,
        endDate: null,
        frequency: 'monthly',
        interval: 1,
      }),
    );
  });

  it('zorunlu alanlar, aralık, bitiş tarihi, saat', () => {
    const result = schema.safeParse({
      ...valid,
      title: '',
      amount: '0',
      accountId: '',
      interval: 13,
      endDate: '2026-10-01',
      remindTime: '25:00',
    });
    expect(messages(result)).toEqual({
      title: 'validation.required',
      amount: 'validation.amount.notPositive',
      accountId: 'validation.required',
      interval: 'validation.intervalInvalid',
      endDate: 'validation.endBeforeStart',
      remindTime: 'validation.timeInvalid',
    });
  });
});

describe('ödendi formu', () => {
  it('tutar, tarih, hesap', () => {
    const pay = createPaymentFormSchema({ language: 'en' });
    expect(pay.safeParse({ amount: '1,250.50', date: '2026-10-20', accountId: 'a1' }).data).toEqual(
      {
        amountMinor: 125050,
        date: '2026-10-20',
        accountId: 'a1',
      },
    );
    expect(messages(pay.safeParse({ amount: '', date: 'x', accountId: '' }))).toEqual({
      amount: 'validation.amount.empty',
      date: 'validation.dateInvalid',
      accountId: 'validation.required',
    });
  });
});

describe('hatırlatıcı formu', () => {
  const reminder = createReminderFormSchema({ now: { date: '2026-10-20', time: '10:00' } });

  it('geçmiş zaman kabul edilmez', () => {
    expect(
      messages(reminder.safeParse({ remindDate: '2026-10-20', remindTime: '10:00', note: '' })),
    ).toEqual({
      remindTime: 'validation.timeInPast',
    });
  });

  it('notu kırpar, boşsa null', () => {
    expect(
      reminder.safeParse({ remindDate: '2026-10-21', remindTime: '09:00', note: '  ' }).data,
    ).toEqual({
      remindDate: '2026-10-21',
      remindTime: '09:00',
      note: null,
    });
  });
});
