import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { LockTimeout } from '@/core/appLock';
import type { Language } from '@/core/i18n';
import { mmkvStateStorage } from '@/lib/storage';

export type ThemePreference = 'light' | 'dark' | 'system';
/** Ana sayfada son görülen özet kartı. */
export type HomeSummaryCard = 'cashFlow' | 'contacts';

type PreferencesState = {
  theme: ThemePreference;
  /** null: henüz seçilmedi, cihaz dili kullanılır. */
  language: Language | null;
  /** Hareket formunda varsayılan hesap: son kullanılan (6.4). */
  lastAccountId: string | null;
  /** Yeni düzenli ödeme ve hatırlatıcıda varsayılan saat (`SS:DD`, Ayarlar → Bildirimler). */
  defaultRemindTime: string;
  /** Son yedeğin alındığı gün (`YYYY-AA-GG`); 30 günden eskiyse Ayarlar'da hatırlatılır (10.3). */
  lastBackupDate: string | null;
  /** İlk açılış ekranları tamamlandı mı (7.1). */
  onboardingDone: boolean;
  /** Dokunsal geri bildirim (8.3); Ayarlar'dan kapatılabilir. */
  hapticsEnabled: boolean;
  /** Uygulama kilidi (8.5), varsayılan kapalı. */
  appLockEnabled: boolean;
  /** Arka planda bu süre kaldıktan sonra kilit istenir. */
  appLockTimeout: LockTimeout;
  /** Son uygulamalar ekranında içeriği gizle (8.5); Android'de bu sırada ekran görüntüsü alınamaz. */
  privacyScreen: boolean;
  /** Ana sayfa özet kartlarından son görülen (kaydırınca değişir). */
  homeSummaryCard: HomeSummaryCard;
  setTheme: (theme: ThemePreference) => void;
  setLanguage: (language: Language) => void;
  setLastAccountId: (id: string) => void;
  setDefaultRemindTime: (time: string) => void;
  setLastBackupDate: (date: string) => void;
  completeOnboarding: () => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setAppLockEnabled: (enabled: boolean) => void;
  setAppLockTimeout: (timeout: LockTimeout) => void;
  setPrivacyScreen: (enabled: boolean) => void;
  setHomeSummaryCard: (card: HomeSummaryCard) => void;
  /** Ayarları varsayılana döndürür (Ayarlar → Verileri sil); ilk açılış ve son yedek tarihi korunur. */
  resetSettings: () => void;
};

type PersistedPreferences = Pick<
  PreferencesState,
  | 'theme'
  | 'language'
  | 'lastAccountId'
  | 'defaultRemindTime'
  | 'lastBackupDate'
  | 'onboardingDone'
  | 'hapticsEnabled'
  | 'appLockEnabled'
  | 'appLockTimeout'
  | 'privacyScreen'
  | 'homeSummaryCard'
>;

const DEFAULT_SETTINGS = {
  theme: 'system',
  language: null,
  lastAccountId: null,
  defaultRemindTime: '09:00',
  hapticsEnabled: true,
  appLockEnabled: false,
  appLockTimeout: 'immediate',
  privacyScreen: true,
  homeSummaryCard: 'cashFlow',
} satisfies Omit<PersistedPreferences, 'lastBackupDate' | 'onboardingDone'>;

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      lastBackupDate: null,
      onboardingDone: false,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setLastAccountId: (lastAccountId) => set({ lastAccountId }),
      setDefaultRemindTime: (defaultRemindTime) => set({ defaultRemindTime }),
      setLastBackupDate: (lastBackupDate) => set({ lastBackupDate }),
      completeOnboarding: () => set({ onboardingDone: true }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      setAppLockEnabled: (appLockEnabled) => set({ appLockEnabled }),
      setAppLockTimeout: (appLockTimeout) => set({ appLockTimeout }),
      setPrivacyScreen: (privacyScreen) => set({ privacyScreen }),
      setHomeSummaryCard: (homeSummaryCard) => set({ homeSummaryCard }),
      resetSettings: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'preferences',
      version: 2,
      storage: createJSONStorage(() => mmkvStateStorage),
      // Sürüm 1 kaydı olan (Faz 10 öncesi kurulmuş) uygulama zaten kullanılıyordur: ilk açılış ekranları atlanır.
      migrate: (persisted, version) => {
        const state = persisted as Partial<PersistedPreferences>;
        return version < 2 ? { ...state, onboardingDone: true } : state;
      },
      partialize: (s): PersistedPreferences => ({
        theme: s.theme,
        language: s.language,
        lastAccountId: s.lastAccountId,
        defaultRemindTime: s.defaultRemindTime,
        lastBackupDate: s.lastBackupDate,
        onboardingDone: s.onboardingDone,
        hapticsEnabled: s.hapticsEnabled,
        appLockEnabled: s.appLockEnabled,
        appLockTimeout: s.appLockTimeout,
        privacyScreen: s.privacyScreen,
        homeSummaryCard: s.homeSummaryCard,
      }),
    },
  ),
);
