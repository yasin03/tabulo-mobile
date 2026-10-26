import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { PremiumCache, PremiumOverride } from '@/config/plans';
import { mmkvStateStorage } from '@/lib/storage';

type PremiumState = PremiumCache & {
  /** Geliştirici anahtarı (6.8); yalnızca `__DEV__`'de okunur. */
  override: PremiumOverride;
  setStatus: (status: PremiumCache) => void;
  setOverride: (override: PremiumOverride) => void;
};

/**
 * Son bilinen abonelik durumu MMKV'de: açılışta Premium kullanıcı bir an kilitli ekran görmez,
 * internetsizken de karar verilebilir. Doğrusu her zaman RevenueCat'ten gelir (`PremiumSync`).
 */
export const usePremiumStore = create<PremiumState>()(
  persist(
    (set) => ({
      entitled: false,
      expiresAt: null,
      willRenew: false,
      override: 'auto',
      setStatus: ({ entitled, expiresAt, willRenew }) => set({ entitled, expiresAt, willRenew }),
      setOverride: (override) => set({ override }),
    }),
    {
      name: 'premium',
      version: 1,
      storage: createJSONStorage(() => mmkvStateStorage),
      partialize: ({ entitled, expiresAt, willRenew, override }) => ({
        entitled,
        expiresAt,
        willRenew,
        override,
      }),
    },
  ),
);
