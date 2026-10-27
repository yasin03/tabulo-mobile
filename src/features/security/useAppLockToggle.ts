import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { haptics } from '@/lib/haptics';
import { authenticate, canUseAppLock } from '@/platform/localAuth';
import { usePreferences } from '@/stores/preferences';

/**
 * Uygulama kilidini açıp kapatır. İki yönde de önce kimlik doğrulanır: açarken kilidin gerçekten
 * çalıştığı görülür, kapatırken telefonu eline alan biri kilidi kaldıramaz.
 */
export function useAppLockToggle() {
  const { t } = useTranslation();
  const enabled = usePreferences((s) => s.appLockEnabled);
  const setEnabled = usePreferences((s) => s.setAppLockEnabled);
  const [isBusy, setBusy] = useState(false);

  const toggle = async (next: boolean) => {
    if (isBusy || next === enabled) return;
    setBusy(true);
    try {
      if (next && !(await canUseAppLock())) {
        Alert.alert(t('appLock.unavailableTitle'), t('appLock.unavailableMessage'));
        return;
      }
      const result = await authenticate({
        promptMessage: t(next ? 'appLock.enablePrompt' : 'appLock.disablePrompt'),
        cancelLabel: t('common.cancel'),
      });
      if (result === 'success') {
        setEnabled(next);
        haptics.success();
      } else if (result === 'unavailable') {
        Alert.alert(t('appLock.unavailableTitle'), t('appLock.unavailableMessage'));
      } else if (result === 'failed') {
        haptics.error();
      }
    } finally {
      setBusy(false);
    }
  };

  return { enabled, isBusy, toggle };
}
