import { router } from 'expo-router';
import { useCallback } from 'react';

import {
  resolvePremium,
  subscriptionTerm,
  type PremiumFeature,
  type SubscriptionTerm,
} from '@/config/plans';
import { usePremiumStore } from '@/stores/premium';

/** Premium açık mı (6.8)? Geliştirmede Ayarlar → Geliştirici'deki anahtar önce gelir. */
export function useIsPremium(): boolean {
  return usePremiumStore((s) =>
    resolvePremium(
      { entitled: s.entitled, expiresAt: s.expiresAt, willRenew: s.willRenew },
      __DEV__ ? s.override : 'auto',
      Date.now(),
    ),
  );
}

/**
 * Gerçek aboneliğin yenilenme / bitiş tarihi (geliştirici anahtarı bunu değiştirmez).
 * Ücretsiz, süresi geçmiş veya ömür boyu ise `null`.
 */
export function useSubscriptionTerm(): SubscriptionTerm | null {
  // Seçici ilkel değer döner (her render'da yeni nesne, zustand'da sonsuz döngü yapar).
  const kind = usePremiumStore((s) => subscriptionTerm(s, Date.now())?.kind ?? null);
  const at = usePremiumStore((s) => s.expiresAt);
  return kind && at !== null ? { kind, at } : null;
}

/** Paywall'u açar; `feature` ekranın başlığında neden açıldığını söyler. */
export function openPaywall(feature?: PremiumFeature) {
  router.push({ pathname: '/paywall', params: feature ? { feature } : {} });
}

/**
 * Premium özellik kapısı: Premium ise `true`; değilse paywall'u açar ve `false` döner.
 * Mevcut veriye dokunulmaz; yalnızca yeni ekleme / Premium eylem engellenir.
 */
export function usePremiumGate() {
  const isPremium = useIsPremium();
  return useCallback(
    (feature: PremiumFeature): boolean => {
      if (isPremium) return true;
      openPaywall(feature);
      return false;
    },
    [isPremium],
  );
}
