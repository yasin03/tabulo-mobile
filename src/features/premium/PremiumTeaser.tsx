import { Button } from 'heroui-native';
import { Lock } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { openPaywall } from '@/lib/premium';
import { useColors } from '@/lib/theme';

/** Kilitli Premium alanının yerine: kısa tanıtım + "Premium'a geç" (7.9, 6.8). */
export function PremiumTeaser({ feature }: { feature: 'charts' | 'export' }) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View className="items-center gap-3 rounded-[18px] border border-border bg-surface px-6 py-8">
      <View className="h-14 w-14 items-center justify-center rounded-2xl bg-warning-bg">
        <Lock size={24} color={colors['warning-fg']} strokeWidth={2.2} />
      </View>
      <AppText weight="bold" className="text-center text-[17px] leading-[24px]">
        {t(`premium.teaser.${feature}.title`)}
      </AppText>
      <AppText className="text-center text-[13px] leading-[19px] text-muted">
        {t(`premium.teaser.${feature}.description`)}
      </AppText>
      <Button variant="primary" className="self-stretch" onPress={() => openPaywall(feature)}>
        <Button.Label>{t('premium.upgrade')}</Button.Label>
      </Button>
    </View>
  );
}
