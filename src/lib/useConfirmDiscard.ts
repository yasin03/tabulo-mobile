import { useNavigation } from 'expo-router';
// SDK 57'de usePreventRemove `expo-router`'ın genel API'sinde yok (SDK 58'de `import { usePreventRemove } from 'expo-router'`).
// Native stack'in tanıdığı kopya Expo Router'ın içindeki React Navigation'dır; `beforeRemove` dinlemek native-stack'te
// desteklenmez ("removed natively but didn't get removed from JS state" hatası). SDK 58'e geçince importu değiştir.
import { usePreventRemove } from 'expo-router/build/react-navigation/core';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

/**
 * Kaydedilmemiş değişiklikle çıkılırken onay sorar (8.1): geri butonu, Android geri tuşu, iOS kaydırma.
 *
 * @param onDiscard Kullanıcı "Çık"ı seçince (ör. yarım kalan taslağı silmek için).
 * @returns `leave`: kayıttan sonra çağrılır; korumayı kapatır ve onay sormadan önceki ekrana döner.
 */
export function useConfirmDiscard(hasUnsavedChanges: boolean, onDiscard?: () => void) {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const [isLeaving, setLeaving] = useState(false);

  usePreventRemove(hasUnsavedChanges && !isLeaving, ({ data }) => {
    Alert.alert(t('unsaved.title'), t('unsaved.message'), [
      { text: t('unsaved.keepEditing'), style: 'cancel' },
      {
        text: t('unsaved.discard'),
        style: 'destructive',
        onPress: () => {
          onDiscard?.();
          navigation.dispatch(data.action);
        },
      },
    ]);
  });

  // Koruma bir sonraki çizimde kalkar; geri gitme ondan sonra yapılır.
  useEffect(() => {
    if (isLeaving) navigation.goBack();
  }, [isLeaving, navigation]);

  return useCallback(() => setLeaving(true), []);
}
