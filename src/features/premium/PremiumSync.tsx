import { useEffect } from 'react';
import { AppState } from 'react-native';

import {
  configurePurchases,
  fetchPremiumStatus,
  subscribeToPremiumStatus,
} from '@/platform/purchases';
import { usePremiumStore } from '@/stores/premium';

/**
 * Abonelik durumunu RevenueCat ile eşitler (6.8): açılışta, ön plana gelince ve SDK bir değişiklik
 * bildirince. İnternet yoksa saklanan son durum geçerli kalır. Ekrana bir şey çizmez.
 */
export function PremiumSync() {
  useEffect(() => {
    if (!configurePurchases()) return;
    const { setStatus } = usePremiumStore.getState();

    const refresh = () => {
      fetchPremiumStatus()
        .then(setStatus)
        .catch((error: unknown) => {
          if (__DEV__) console.warn('[premium]', error);
        });
    };

    refresh();
    const unsubscribe = subscribeToPremiumStatus(setStatus);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      unsubscribe();
      appState.remove();
    };
  }, []);

  return null;
}
