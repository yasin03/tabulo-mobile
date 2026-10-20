import { router } from 'expo-router';
import { useToast } from 'heroui-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { recurringPaymentsRepo } from '@/db';
import type { RecurringPaymentListItem } from '@/db/repositories';
import { errorMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';

type RecurringRef = Pick<RecurringPaymentListItem, 'id' | 'status'>;

/** Düzenli ödeme listelerinde ortak eylemler: öde, düzenle, pasife/aktife al, sil (+ 5 sn geri al). */
export function useRecurringActions() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const pay = useCallback((item: RecurringRef) => {
    router.push({ pathname: '/recurring/[id]/pay', params: { id: item.id } });
  }, []);

  const edit = useCallback((item: RecurringRef) => {
    router.push({ pathname: '/recurring/[id]', params: { id: item.id } });
  }, []);

  const toggleStatus = useCallback(
    async (item: RecurringRef) => {
      try {
        await recurringPaymentsRepo.setStatus(
          item.id,
          item.status === 'active' ? 'passive' : 'active',
        );
        haptics.success();
      } catch (error) {
        haptics.error();
        toast.show({ variant: 'danger', label: errorMessage(t, error) });
      }
    },
    [t, toast],
  );

  const remove = useCallback(
    async (item: RecurringRef) => {
      try {
        await recurringPaymentsRepo.softDelete(item.id);
        haptics.warning();
        toast.show({
          label: t('recurring.deleted'),
          actionLabel: t('common.undo'),
          duration: 5000,
          onActionPress: ({ hide }) => {
            void recurringPaymentsRepo.restore(item.id);
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

  return { pay, edit, toggleStatus, remove };
}
