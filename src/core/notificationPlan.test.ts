import { planNotifications } from './notificationPlan';

const now = { date: '2026-10-20', time: '10:00' };

describe('planNotifications', () => {
  it('düzenli ödeme: sonraki tarihten N gün önce, ayarlı saatte', () => {
    const plan = planNotifications({
      recurring: [
        {
          id: 'r1',
          nextDueDate: '2026-11-01',
          endDate: null,
          remindDaysBefore: 3,
          remindTime: '09:00',
        },
      ],
      reminders: [],
      now,
    });
    expect(plan).toEqual([
      {
        kind: 'recurring',
        identifier: 'recurring-r1',
        refId: 'r1',
        date: '2026-10-29',
        time: '09:00',
      },
    ]);
  });

  it('zamanı geçmiş ve bitmiş olanları atlar, yakından uzağa sıralar', () => {
    const plan = planNotifications({
      recurring: [
        {
          id: 'past',
          nextDueDate: '2026-10-20',
          endDate: null,
          remindDaysBefore: 0,
          remindTime: '09:59',
        },
        {
          id: 'later',
          nextDueDate: '2026-10-20',
          endDate: null,
          remindDaysBefore: 0,
          remindTime: '10:01',
        },
        {
          id: 'ended',
          nextDueDate: '2026-12-01',
          endDate: '2026-11-30',
          remindDaysBefore: 0,
          remindTime: '09:00',
        },
      ],
      reminders: [
        { id: 'm1', remindDate: '2026-10-21', remindTime: '08:00' },
        { id: 'now', remindDate: '2026-10-20', remindTime: '10:00' },
      ],
      now,
    });
    expect(plan.map((p) => p.identifier)).toEqual(['recurring-later', 'reminder-m1']);
  });

  it('en fazla `limit` kadar (iOS 64 sınırı)', () => {
    const reminders = Array.from({ length: 80 }, (_, i) => ({
      id: `m${i}`,
      remindDate: '2026-11-01',
      remindTime: `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`,
    }));
    const plan = planNotifications({ recurring: [], reminders, now });
    expect(plan).toHaveLength(60);
    expect(plan[0]!.refId).toBe('m0');
  });
});
