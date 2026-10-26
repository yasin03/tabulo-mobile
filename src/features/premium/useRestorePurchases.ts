import { useToast } from 'heroui-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { haptics } from '@/lib/haptics';
import { restorePurchases } from '@/platform/purchases';
import { usePremiumStore } from '@/stores/premium';

/** "Satın alımları geri yükle" (paywall ve Ayarlar). @returns Premium açıldıysa `true`. */
export function useRestorePurchases() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const setStatus = usePremiumStore((s) => s.setStatus);

  return useCallback(async (): Promise<boolean> => {
    try {
      const status = await restorePurchases();
      setStatus(status);
      if (status.entitled) {
        haptics.success();
        toast.show({ variant: 'success', label: t('premium.restored') });
        return true;
      }
      Alert.alert(t('premium.restoreNoneTitle'), t('premium.restoreNoneMessage'));
    } catch (error) {
      if (__DEV__) console.warn('[restore purchases]', error);
      haptics.error();
      toast.show({ variant: 'danger', label: t('premium.restoreFailed') });
    }
    return false;
  }, [setStatus, t, toast]);
}
