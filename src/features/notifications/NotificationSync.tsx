import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';

import { localDateTime, toIsoDate, toTimeOfDay } from '@/core/dates';
import { notificationIdentifier, planNotifications } from '@/core/notificationPlan';
import { recurringPaymentsRepo, remindersRepo } from '@/db';
import { useMoney } from '@/lib/business';
import { useDates } from '@/lib/dates';
import {
  configureNotifications,
  getNotificationPermission,
  syncLocalNotifications,
  type LocalNotification,
} from '@/platform/notifications';

/** Bu tablolar değişince bildirimler yeniden hesaplanır (cari adı ve para birimi metinde geçer). */
const WATCHED_TABLES = new Set(['recurring_payments', 'reminders', 'contacts', 'business_profile']);
const DEBOUNCE_MS = 500;

/**
 * Düzenli ödeme ve hatırlatıcı bildirimlerini veritabanıyla eşitler (6.5, 8.4): açılışta, uygulama ön plana
 * gelince, ilgili kayıtlar değişince ve dil / para birimi değişince. Eksik bildirim kurulur, artık
 * gerekmeyen iptal edilir. Ekrana bir şey çizmez.
 */
export function NotificationSync() {
  const { t } = useTranslation();
  const money = useMoney();
  const dates = useDates();
  const running = useRef(false);
  const rerun = useRef(false);

  useEffect(() => {
    configureNotifications(t('notifications.channel'));
  }, [t]);

  useEffect(() => {
    const amountText = money.format;
    const dateText = (iso: string) => dates.format(iso, 'dayMonthLong');

    const sync = async () => {
      if (running.current) {
        rerun.current = true;
        return;
      }
      running.current = true;
      try {
        const [recurring, reminders, permission] = await Promise.all([
          recurringPaymentsRepo.list({ activeOnly: true }),
          remindersRepo.listPending(),
          getNotificationPermission(),
        ]);
        const plan = planNotifications({
          recurring,
          reminders,
          now: { date: toIsoDate(), time: toTimeOfDay() },
        });
        const recurringById = new Map(recurring.map((r) => [r.id, r]));
        const reminderById = new Map(reminders.map((r) => [r.id, r]));

        const notifications: LocalNotification[] = plan.map((p) => {
          const date = localDateTime(p.date, p.time);
          if (p.kind === 'recurring') {
            const r = recurringById.get(p.refId)!;
            const kind = r.movementType === 'collection' ? 'collection' : 'payment';
            const amount = amountText(r.amountMinor);
            const body =
              r.remindDaysBefore === 0
                ? t(`notifications.${kind}.today`, { amount })
                : r.remindDaysBefore === 1
                  ? t(`notifications.${kind}.tomorrow`, { amount })
                  : t(`notifications.${kind}.inDays`, {
                      amount,
                      count: r.remindDaysBefore,
                      date: dateText(r.nextDueDate),
                    });
            return {
              identifier: p.identifier,
              date,
              title: r.title,
              body,
              url: `/recurring/${r.id}/pay`,
            };
          }
          const reminder = reminderById.get(p.refId)!;
          return {
            identifier: p.identifier,
            date,
            title: t('notifications.reminder.title', { name: reminder.contactName }),
            body: reminder.note ?? t('notifications.reminder.body'),
            url: `/contact/${reminder.contactId}`,
          };
        });

        const canSchedule = permission === 'granted';
        await syncLocalNotifications(notifications, { canSchedule });

        // Kurulu bildirimin kimliği kayda yazılır (yalnızca değiştiyse; değişiklik olayı döngüye girmez).
        const scheduled = new Set(canSchedule ? plan.map((p) => p.identifier) : []);
        for (const r of recurring) {
          const id = notificationIdentifier('recurring', r.id);
          await recurringPaymentsRepo.setNotificationId(r.id, scheduled.has(id) ? id : null);
        }
        for (const r of reminders) {
          const id = notificationIdentifier('reminder', r.id);
          await remindersRepo.setNotificationId(r.id, scheduled.has(id) ? id : null);
        }
      } catch (error) {
        if (__DEV__) console.warn('Bildirim senkronizasyonu başarısız', error);
      } finally {
        running.current = false;
        if (rerun.current) {
          rerun.current = false;
          void sync();
        }
      }
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void sync(), DEBOUNCE_MS);
    };

    void sync();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') schedule();
    });
    const db = addDatabaseChangeListener((event) => {
      if (WATCHED_TABLES.has(event.tableName)) schedule();
    });
    return () => {
      clearTimeout(timer);
      appState.remove();
      db.remove();
    };
  }, [t, money, dates]);

  return null;
}
