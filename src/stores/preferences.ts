import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

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
  setTheme: (theme: ThemePreference) => void;
  setLanguage: (language: Language) => void;
  setLastAccountId: (id: string) => void;
  setDefaultRemindTime: (time: string) => void;
  setLastBackupDate: (date: string) => void;
};

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      theme: 'system',
      language: null,
      lastAccountId: null,
      defaultRemindTime: '09:00',
      lastBackupDate: null,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setLastAccountId: (lastAccountId) => set({ lastAccountId }),
      setDefaultRemindTime: (defaultRemindTime) => set({ defaultRemindTime }),
      setLastBackupDate: (lastBackupDate) => set({ lastBackupDate }),
    }),
    {
      name: 'preferences',
      version: 1,
      storage: createJSONStorage(() => mmkvStateStorage),
      partialize: ({ theme, language, lastAccountId, defaultRemindTime, lastBackupDate }) => ({
        theme,
        language,
        lastAccountId,
        defaultRemindTime,
        lastBackupDate,
      }),
    },
  ),
);
