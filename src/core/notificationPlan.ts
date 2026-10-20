// Hangi yerel bildirimlerin kurulu olması gerektiğini hesaplar (6.5, 6.6, 8.4). Bildirimi kurmak
// src/platform/notifications.ts'in işidir; burası yalnızca "ne zaman, hangi kayıt için" sorusunu cevaplar.

import { isScheduleFinished, reminderDate } from './recurrence';

/** iOS en fazla 64 bekleyen yerel bildirim tutar; pay bırakılır, en yakın olanlar kurulur. */
export const MAX_SCHEDULED_NOTIFICATIONS = 60;

export interface RecurringForPlan {
  id: string;
  nextDueDate: string;
  endDate: string | null;
  remindDaysBefore: number;
  remindTime: string;
}

export interface ReminderForPlan {
  id: string;
  remindDate: string;
  remindTime: string;
}

export type PlannedNotification =
  | { kind: 'recurring'; identifier: string; refId: string; date: string; time: string }
  | { kind: 'reminder'; identifier: string; refId: string; date: string; time: string };

/** Bildirim kimliği kayıttan türetilir: yeniden kurmak aynı bildirimi değiştirir, kopya oluşmaz. */
export function notificationIdentifier(kind: PlannedNotification['kind'], refId: string): string {
  return `${kind}-${refId}`;
}

/**
 * Kurulması gereken bildirimler, en yakından uzağa. Zamanı geçmiş olanlar kurulmaz
 * (geciken ödeme uygulamada "Gecikti" olarak görünür). Yalnızca aktif düzenli ödemeler ve bekleyen
 * hatırlatıcılar verilmelidir.
 *
 * @param now Yerel `{ date: 'YYYY-AA-GG', time: 'SS:DD' }`.
 */
export function planNotifications(input: {
  recurring: readonly RecurringForPlan[];
  reminders: readonly ReminderForPlan[];
  now: { date: string; time: string };
  limit?: number;
}): PlannedNotification[] {
  const nowKey = `${input.now.date}T${input.now.time}`;
  const planned: PlannedNotification[] = [];

  for (const r of input.recurring) {
    if (isScheduleFinished(r.nextDueDate, r.endDate)) continue;
    planned.push({
      kind: 'recurring',
      identifier: notificationIdentifier('recurring', r.id),
      refId: r.id,
      date: reminderDate(r.nextDueDate, r.remindDaysBefore),
      time: r.remindTime,
    });
  }
  for (const r of input.reminders) {
    planned.push({
      kind: 'reminder',
      identifier: notificationIdentifier('reminder', r.id),
      refId: r.id,
      date: r.remindDate,
      time: r.remindTime,
    });
  }

  return planned
    .filter((p) => `${p.date}T${p.time}` > nowKey)
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
    .slice(0, input.limit ?? MAX_SCHEDULED_NOTIFICATIONS);
}
