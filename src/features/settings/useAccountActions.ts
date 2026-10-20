import { router } from 'expo-router';
import { useToast } from 'heroui-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { canAddActiveAccount } from '@/config/plans';
import { isDomainError } from '@/core/errors';
import { moveId } from '@/core/order';
import { accountsRepo, type Account } from '@/db';
import type { AccountType } from '@/db/repositories';
import { errorMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { useIsPremium } from '@/lib/premium';

type AccountRef = Pick<Account, 'id' | 'name' | 'status' | 'type'>;

/**
 * Ücretsiz plan sınırı (6.8): 1 aktif kasa + 1 aktif banka. Yeni hesap eklerken / pasif hesabı aktife alırken.
 * Sınırdaysa açıklama gösterir ve `false` döner (paywall Faz 9'da).
 */
export function useAccountLimit() {
  const { t } = useTranslation();
  const isPremium = useIsPremium();

  return useCallback(
    async (type: AccountType): Promise<boolean> => {
      if (canAddActiveAccount(type, await accountsRepo.countActive(), isPremium)) return true;
      haptics.warning();
      Alert.alert(t('accounts.limit.title'), t(`accounts.limit.${type}`), [
        { text: t('common.ok') },
      ]);
      return false;
    },
    [isPremium, t],
  );
}

/** Hesap listesi eylemleri: düzenle, sırala, pasife/aktife al, sil (+ 5 sn geri al). */
export function useAccountActions(orderedIds: readonly string[]) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const ensureCanActivate = useAccountLimit();

  const showError = useCallback(
    (error: unknown) => {
      haptics.error();
      toast.show({ variant: 'danger', label: errorMessage(t, error) });
    },
    [t, toast],
  );

  const edit = useCallback((account: AccountRef) => {
    router.push({ pathname: '/settings/accounts/[id]', params: { id: account.id } });
  }, []);

  const move = useCallback(
    async (account: AccountRef, delta: -1 | 1) => {
      const next = moveId(orderedIds, account.id, delta);
      if (!next) return;
      haptics.selection();
      try {
        await accountsRepo.reorder(next);
      } catch (error) {
        showError(error);
      }
    },
    [orderedIds, showError],
  );

  const toggleStatus = useCallback(
    async (account: AccountRef) => {
      const next = account.status === 'active' ? 'passive' : 'active';
      if (next === 'active' && !(await ensureCanActivate(account.type))) return;
      try {
        await accountsRepo.setStatus(account.id, next);
        haptics.success();
        toast.show({
          variant: 'success',
          label: t(next === 'active' ? 'contacts.activated' : 'contacts.deactivated', {
            name: account.name,
          }),
        });
      } catch (error) {
        showError(error);
      }
    },
    [ensureCanActivate, showError, t, toast],
  );

  const remove = useCallback(
    async (account: AccountRef) => {
      try {
        await accountsRepo.softDelete(account.id);
        haptics.warning();
        toast.show({
          label: t('contacts.deleted', { name: account.name }),
          actionLabel: t('common.undo'),
          duration: 5000,
          onActionPress: ({ hide }) => {
            void accountsRepo.restore(account.id);
            hide();
          },
        });
      } catch (error) {
        if (isDomainError(error, 'accountHasTransactions')) {
          haptics.warning();
          Alert.alert(t('accounts.deleteBlocked.title'), t('accounts.deleteBlocked.message'), [
            { text: t('common.cancel'), style: 'cancel' },
            ...(account.status === 'active'
              ? [
                  {
                    text: t('contacts.actions.deactivate'),
                    onPress: () => void toggleStatus(account),
                  },
                ]
              : []),
          ]);
          return;
        }
        showError(error);
      }
    },
    [showError, t, toast, toggleStatus],
  );

  return { edit, move, toggleStatus, remove };
}
