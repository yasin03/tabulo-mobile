import * as Haptics from 'expo-haptics';

import { usePreferences } from '@/stores/preferences';

// Dokunsal geri bildirim (8.3); Ayarlar → Genel'den kapatılabilir.

const enabled = () => usePreferences.getState().hapticsEnabled;

export const haptics = {
  success: () => {
    if (enabled()) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  warning: () => {
    if (enabled()) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },
  error: () => {
    if (enabled()) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },
  selection: () => {
    if (enabled()) void Haptics.selectionAsync();
  },
};
