import type { ErrorBoundaryProps } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/brand/Logo';
import { AppText } from '@/components/ui/AppText';

/**
 * Beklenmeyen hatalarda gösterilir (8.4). Veriler etkilenmez; "Tekrar dene" ekranı yeniden kurar.
 * Kök düzenin sağlayıcılarının (HeroUI) dışında da render edilebilir: HeroUI bileşeni kullanma.
 */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  return (
    // SafeAreaView className'i uygulanmayabiliyor: zemin ve flex dıştaki View'da.
    <View className="flex-1 bg-background">
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <LogoMark size={56} />
          <AppText weight="extrabold" className="text-center text-[20px] leading-[28px]">
            {t('errors.title')}
          </AppText>
          <AppText className="text-center text-muted">{t('errors.description')}</AppText>
          <Pressable
            accessibilityRole="button"
            onPress={() => void retry()}
            className="mt-2 h-12 min-w-40 items-center justify-center rounded-[14px] bg-accent px-6 active:opacity-80"
          >
            <AppText weight="bold" className="text-[16px] text-accent-foreground">
              {t('common.retry')}
            </AppText>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
