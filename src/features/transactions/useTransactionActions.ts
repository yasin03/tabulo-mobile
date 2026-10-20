import { router } from 'expo-router';
import { useToast } from 'heroui-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { transactionsRepo } from '@/db';
import { errorMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';

type TransactionRef = { id: string };

/** Hareket listeleri ve detayında ortak eylemler: aç, düzenle, sil (+ 5 sn geri al, 5.1). */
export function useTransactionActions() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const open = useCallback((transaction: TransactionRef) => {
    router.push({ pathname: '/transaction/[id]', params: { id: transaction.id } });
  }, []);

  const edit = useCallback((transaction: TransactionRef) => {
    router.push({ pathname: '/transaction/[id]/edit', params: { id: transaction.id } });
  }, []);

  /** @returns Silindiyse `true`. */
  const remove = useCallback(
    async (transaction: TransactionRef): Promise<boolean> => {
      try {
        await transactionsRepo.softDelete(transaction.id);
        haptics.warning();
        toast.show({
          label: t('transactions.deleted'),
          actionLabel: t('common.undo'),
          duration: 5000,
          onActionPress: ({ hide }) => {
            void transactionsRepo.restore(transaction.id);
            hide();
          },
        });
        return true;
      } catch (error) {
        haptics.error();
        toast.show({ variant: 'danger', label: errorMessage(t, error) });
        return false;
      }
    },
    [t, toast],
  );

  return { open, edit, remove };
}
