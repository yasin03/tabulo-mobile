import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { cn } from '@/lib/cn';
import type { PlanOption } from '@/platform/purchases';

type PlanCardProps = {
  plan: PlanOption;
  isSelected: boolean;
  onPress: () => void;
};

/** Paywall'da seçilebilir paket kartı: dönem, mağaza fiyatı, yıllıkta aylık karşılığı. */
export function PlanCard({ plan, isSelected, onPress }: PlanCardProps) {
  const { t } = useTranslation();
  const title = t(plan.period === 'annual' ? 'premium.annual' : 'premium.monthly');
  const priceText = t(plan.period === 'annual' ? 'premium.perYear' : 'premium.perMonth', {
    price: plan.price,
  });
  const detail =
    plan.pricePerMonth && plan.period === 'annual'
      ? t('premium.monthlyEquivalent', { price: plan.pricePerMonth })
      : null;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={[title, priceText, detail].filter(Boolean).join(', ')}
      onPress={onPress}
      className={cn(
        'min-h-[72px] flex-row items-center gap-3 rounded-[18px] border-2 bg-surface px-4 py-3 active:opacity-80',
        isSelected ? 'border-accent' : 'border-border',
      )}
    >
      <View
        className={cn(
          'h-6 w-6 items-center justify-center rounded-full border-2',
          isSelected ? 'border-accent' : 'border-border',
        )}
      >
        {isSelected ? <View className="h-3 w-3 rounded-full bg-accent" /> : null}
      </View>
      <View className="flex-1 gap-0.5">
        <View className="flex-row flex-wrap items-center gap-2">
          <AppText weight="bold" className="text-[16px]">
            {title}
          </AppText>
          {plan.freeTrialPeriod ? (
            <View className="rounded-full bg-warning-bg px-2 py-0.5">
              <AppText weight="bold" className="text-[11px] text-warning-fg">
                {t('premium.freeTrial')}
              </AppText>
            </View>
          ) : null}
        </View>
        {detail ? <AppText className="text-[13px] text-muted">{detail}</AppText> : null}
      </View>
      <AppText weight="extrabold" className="text-right text-[15px]">
        {priceText}
      </AppText>
    </Pressable>
  );
}
