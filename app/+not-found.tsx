import { Link, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-background p-5">
      <Stack.Screen options={{ title: t('notFound.title') }} />
      <AppText weight="bold" className="text-[18px]">
        {t('notFound.title')}
      </AppText>
      <Link href="/" className="min-h-11 py-3">
        <AppText weight="bold" className="text-primary">
          {t('notFound.goHome')}
        </AppText>
      </Link>
    </View>
  );
}
