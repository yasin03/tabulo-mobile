import { router } from 'expo-router';
import { useToast } from 'heroui-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { remindersRepo } from '@/db';
import { errorMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';

type ReminderRef = { id: string };

/** Hatırlatıcı eylemleri: düzenle, tamamlandı (+ geri al), sil (+ geri al). */
export function useReminderActions() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const edit = useCallback((reminder: ReminderRef) => {
    router.push({ pathname: '/reminders/[id]', params: { id: reminder.id } });
  }, []);

  const complete = useCallback(
    async (reminder: ReminderRef) => {
      try {
        await remindersRepo.setStatus(reminder.id, 'done');
        haptics.success();
        toast.show({
          label: t('reminders.completed'),
          actionLabel: t('common.undo'),
          duration: 5000,
          onActionPress: ({ hide }) => {
            void remindersRepo.setStatus(reminder.id, 'pending');
            hide();
          },
        });
      } catch (error) {
        haptics.error();
        toast.show({ variant: 'danger', label: errorMessage(t, error) });
      }
    },
    [t, toast],
  );

  const remove = useCallback(
    async (reminder: ReminderRef) => {
      try {
        await remindersRepo.softDelete(reminder.id);
        haptics.warning();
        toast.show({
          label: t('reminders.deleted'),
          actionLabel: t('common.undo'),
          duration: 5000,
          onActionPress: ({ hide }) => {
            void remindersRepo.restore(reminder.id);
            hide();
          },
        });
      } catch (error) {
        haptics.error();
        toast.show({ variant: 'danger', label: errorMessage(t, error) });
      }
    },
    [t, toast],
  );

  return { edit, complete, remove };
}
