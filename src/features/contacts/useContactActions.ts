import { router } from 'expo-router';
import { useToast } from 'heroui-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { canAddActiveContact, FREE_LIMITS } from '@/config/plans';
import { isDomainError } from '@/core/errors';
import { contactsRepo, type Contact } from '@/db';
import { errorMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { useIsPremium } from '@/lib/premium';

type ContactRef = Pick<Contact, 'id' | 'name' | 'status'>;

/**
 * Ücretsiz plan sınırı (6.8): yeni aktif cari eklemeden / pasif cariyi aktife almadan önce çağrılır.
 * Sınırdaysa nazik bir açıklama gösterir ve `false` döner. Mevcut veriye asla dokunulmaz.
 * (Paywall Faz 9'da buraya bağlanacak.)
 */
export function useContactLimit() {
  const { t } = useTranslation();
  const isPremium = useIsPremium();

  return useCallback(async (): Promise<boolean> => {
    if (canAddActiveContact(await contactsRepo.countActive(), isPremium)) return true;
    haptics.warning();
    Alert.alert(
      t('contacts.limit.title'),
      t('contacts.limit.message', { count: FREE_LIMITS.activeContacts }),
      [{ text: t('common.ok') }],
    );
    return false;
  }, [isPremium, t]);
}

/** Cari listesi ve detayında ortak eylemler: aç, düzenle, pasife/aktife al, sil (+ 5 sn geri al). */
export function useContactActions() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const ensureCanActivate = useContactLimit();

  const showError = useCallback(
    (error: unknown) => {
      haptics.error();
      toast.show({ variant: 'danger', label: errorMessage(t, error) });
    },
    [t, toast],
  );

  const open = useCallback((contact: ContactRef) => {
    router.push({ pathname: '/contact/[id]', params: { id: contact.id } });
  }, []);

  const edit = useCallback((contact: ContactRef) => {
    router.push({ pathname: '/contact/[id]/edit', params: { id: contact.id } });
  }, []);

  const toggleStatus = useCallback(
    async (contact: ContactRef) => {
      const next = contact.status === 'active' ? 'passive' : 'active';
      if (next === 'active' && !(await ensureCanActivate())) return;
      try {
        await contactsRepo.setStatus(contact.id, next);
        haptics.success();
        toast.show({
          variant: 'success',
          label: t(next === 'active' ? 'contacts.activated' : 'contacts.deactivated', {
            name: contact.name,
          }),
        });
      } catch (error) {
        showError(error);
      }
    },
    [ensureCanActivate, showError, t, toast],
  );

  /** @returns Silindiyse `true`. */
  const remove = useCallback(
    async (contact: ContactRef): Promise<boolean> => {
      try {
        await contactsRepo.softDelete(contact.id);
        haptics.warning();
        toast.show({
          label: t('contacts.deleted', { name: contact.name }),
          actionLabel: t('common.undo'),
          duration: 5000,
          onActionPress: ({ hide }) => {
            void contactsRepo.restore(contact.id);
            hide();
          },
        });
        return true;
      } catch (error) {
        if (isDomainError(error, 'contactHasTransactions')) {
          haptics.warning();
          Alert.alert(t('contacts.deleteBlocked.title'), t('contacts.deleteBlocked.message'), [
            { text: t('common.cancel'), style: 'cancel' },
            ...(contact.status === 'active'
              ? [
                  {
                    text: t('contacts.actions.deactivate'),
                    onPress: () => void toggleStatus(contact),
                  },
                ]
              : []),
          ]);
          return false;
        }
        showError(error);
        return false;
      }
    },
    [showError, t, toast, toggleStatus],
  );

  return { open, edit, toggleStatus, remove };
}
