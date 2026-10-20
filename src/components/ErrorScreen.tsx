import type { ErrorBoundaryProps } from 'expo-router';
import { Button } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/brand/Logo';
import { AppText } from '@/components/ui/AppText';

/** Beklenmeyen hatalarda gösterilir (8.4). Veriler etkilenmez; "Tekrar dene" ekranı yeniden kurar. */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center gap-4 px-8">
        <LogoMark size={56} />
        <AppText weight="extrabold" className="text-center text-[20px] leading-[28px]">
          {t('errors.title')}
        </AppText>
        <AppText className="text-center text-muted">{t('errors.description')}</AppText>
        <Button variant="primary" size="lg" className="mt-2 min-w-40" onPress={() => void retry()}>
          <Button.Label>{t('common.retry')}</Button.Label>
        </Button>
      </View>
    </SafeAreaView>
  );
}
