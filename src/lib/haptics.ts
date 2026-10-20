import * as Haptics from 'expo-haptics';

// Dokunsal geri bildirim (8.3). Ayarlardan kapatma seçeneği Faz 10'da buraya bağlanacak.

export const haptics = {
  success: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warning: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  selection: () => void Haptics.selectionAsync(),
};
