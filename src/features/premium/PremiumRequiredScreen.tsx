import { router, Stack } from 'expo-router';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { useColors } from '@/lib/theme';

import { PremiumTeaser } from './PremiumTeaser';

/**
 * Premium bir modal ekrana ücretsiz planda (ör. derin bağlantıyla) gelinirse ekranın yerine.
 * Normal girişler zaten önce paywall'u açar (`usePremiumGate`).
 */
export function PremiumRequiredScreen({ title }: { title: string }) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View className="flex-1 bg-background px-5 pt-4">
      <Stack.Screen
        options={{
          title,
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={() => router.back()}
              hitSlop={8}
              className="h-11 w-11 items-center justify-center active:opacity-70"
            >
              <X size={24} color={colors.primary} />
            </Pressable>
          ),
        }}
      />
      <PremiumTeaser feature="export" />
    </View>
  );
}
