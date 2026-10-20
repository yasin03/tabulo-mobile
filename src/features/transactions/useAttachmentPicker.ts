import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking } from 'react-native';

import { haptics } from '@/lib/haptics';
import {
  cameraPermission,
  pickPdfs,
  pickPhotos,
  requestCameraPermission,
  takePhoto,
  type PendingAttachment,
} from '@/platform/attachments';

export type AttachmentSource = 'camera' | 'library' | 'pdf';

/**
 * Belge seçme (6.4). Kamera izni ihtiyaç anında, önce kısa bir açıklamayla istenir;
 * reddedilmişse telefon Ayarlar'ına yönlendirilir (8.6). Galeri ve PDF seçicileri izin gerektirmez.
 */
export function useAttachmentPicker() {
  const { t } = useTranslation();

  const askCamera = useCallback(async (): Promise<boolean> => {
    const status = await cameraPermission();
    if (status === 'granted') return true;

    if (status === 'denied') {
      haptics.warning();
      Alert.alert(t('attachments.cameraDenied.title'), t('attachments.cameraDenied.message'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('attachments.openSettings'), onPress: () => void Linking.openSettings() },
      ]);
      return false;
    }

    const proceed = await new Promise<boolean>((resolve) => {
      Alert.alert(t('attachments.cameraPrompt.title'), t('attachments.cameraPrompt.message'), [
        { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
        { text: t('common.continue'), onPress: () => resolve(true) },
      ]);
    });
    return proceed && (await requestCameraPermission());
  }, [t]);

  return useCallback(
    async (source: AttachmentSource): Promise<PendingAttachment[]> => {
      try {
        if (source === 'camera') return (await askCamera()) ? await takePhoto() : [];
        if (source === 'library') return await pickPhotos();
        return await pickPdfs();
      } catch (error) {
        if (__DEV__) console.warn(error);
        haptics.error();
        Alert.alert(t('attachments.pickFailed'));
        return [];
      }
    },
    [askCamera, t],
  );
}
