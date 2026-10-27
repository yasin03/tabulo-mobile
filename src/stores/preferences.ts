import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { LockTimeout } from '@/core/appLock';
import type { Language } from '@/core/i18n';
import { mmkvStateStorage } from '@/lib/storage';

export type ThemePreference = 'light' | 'dark' | 'system';

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
>;

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: null,
      lastAccountId: null,
      defaultRemindTime: '09:00',
      lastBackupDate: null,
      onboardingDone: false,
      hapticsEnabled: true,
      appLockEnabled: false,
      appLockTimeout: 'immediate',
      privacyScreen: true,
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
      }),
    },
  ),
);
