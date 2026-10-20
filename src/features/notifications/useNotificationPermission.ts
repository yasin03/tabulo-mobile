import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AppState } from 'react-native';

import {
  getNotificationPermission,
  requestNotificationPermission,
  type NotificationPermission,
} from '@/platform/notifications';

/** Güncel izin durumu; kullanıcı Ayarlar'dan dönünce yenilenir. Bilinmiyorken `null`. */
export function useNotificationPermissionStatus(): NotificationPermission | null {
  const [status, setStatus] = useState<NotificationPermission | null>(null);
  useEffect(() => {
    let cancelled = false;
    const check = () =>
      void getNotificationPermission().then((value) => !cancelled && setStatus(value));
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);
  return status;
}

/**
 * Bildirim iznini ihtiyaç anında ister (8.6): ilk düzenli ödeme veya hatırlatıcı kaydedilirken.
 * Sistem penceresinden önce kısa bir açıklama gösterilir. Reddedildiyse tekrar sormaz; ilgili ekran
 * Ayarlar'a yönlendiren uyarıyı gösterir.
 * @returns İzin varsa `true`.
 */
export function useEnsureNotificationPermission() {
  const { t } = useTranslation();
  return useCallback(async (): Promise<boolean> => {
    const status = await getNotificationPermission();
    if (status !== 'undetermined') return status === 'granted';
    const accepted = await new Promise<boolean>((resolve) => {
      Alert.alert(t('notifications.permission.title'), t('notifications.permission.message'), [
        {
          text: t('notifications.permission.later'),
          style: 'cancel',
          onPress: () => resolve(false),
        },
        { text: t('common.continue'), onPress: () => resolve(true) },
      ]);
    });
    if (!accepted) return false;
    return (await requestNotificationPermission()) === 'granted';
  }, [t]);
}
