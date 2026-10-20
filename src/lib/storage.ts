import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

/** Küçük ayarlar için tek MMKV örneği (dil, tema, onboarding vb.). Veriler SQLite'tadır. */
export const storage = createMMKV({ id: 'tabulo-settings' });

/** zustand `persist` için MMKV adaptörü. */
export const mmkvStateStorage: StateStorage = {
  getItem: (name) => storage.getString(name) ?? null,
  setItem: (name, value) => storage.set(name, value),
  removeItem: (name) => {
    storage.remove(name);
  },
};
