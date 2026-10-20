import { ChevronDown } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { monthKey, toIsoDate } from '@/core/dates';
import type { ContactTotals } from '@/db/repositories';
import { useMoney } from '@/lib/business';
import { useDates } from '@/lib/dates';
import { useColors } from '@/lib/theme';

type SummaryCardProps = {
  /** `2026-10` */
  month: string;
  /** Seçilen ayın son günü (bakiye bu günün sonundaki durumdur). */
  asOf: string;
  totals: ContactTotals;
  onMonthPress: () => void;
};

/**
 * Ana sayfa özet kartı (7.2, home.html): net bakiye = toplam alacak − toplam borç; ay seçici (kullanıcı kararı:
 * seçilen ayın sonundaki durum). Kart iki temada da lacivert; yeşil/kırmızı tonlar açık tutulur.
 */
export function SummaryCard({ month, asOf, totals, onMonthPress }: SummaryCardProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const money = useMoney();
  const dates = useDates();
  const isCurrentMonth = month === monthKey(toIsoDate());
  const monthLabel = dates.format(`${month}-01`, 'monthYear');

  const net =
    totals.netMinor < 0 ? money.formatSigned(totals.netMinor) : money.format(totals.netMinor);

  return (
    <View className="gap-4 rounded-[22px] bg-summary p-5">
      <View className="flex-row items-center justify-between gap-3">
        <AppText className="flex-1 text-[14px] leading-[20px] text-summary-muted">
          {isCurrentMonth
            ? t('home.netBalance')
            : t('home.netBalanceAsOf', { date: dates.format(asOf, 'dayMonthLong') })}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.selectMonth', { month: monthLabel })}
          onPress={onMonthPress}
          hitSlop={8}
          className="min-h-8 flex-row items-center gap-1 rounded-full bg-accent px-[10px] py-1 active:opacity-80"
        >
          <AppText
            weight="bold"
            maxFontSizeMultiplier={1.4}
            className="text-[13px] leading-[18px] text-accent-foreground"
          >
            {monthLabel}
          </AppText>
          <ChevronDown size={14} color={colors['accent-foreground']} strokeWidth={2.6} />
        </Pressable>
      </View>

      <AppText
        weight="extrabold"
        accessibilityRole="header"
        adjustsFontSizeToFit
        numberOfLines={1}
        className="text-[36px] leading-[44px] tracking-[-0.7px] text-summary-foreground"
      >
        {net}
      </AppText>

      <View className="flex-row gap-[10px]">
        <View className="flex-1 gap-1 rounded-[14px] bg-summary-tile p-3">
          <AppText className="text-[13px] leading-[18px] text-summary-muted">
            {t('home.receivable')}
          </AppText>
          <AppText
            weight="extrabold"
            adjustsFontSizeToFit
            numberOfLines={1}
            className="text-[18px] leading-[24px] text-summary-positive"
          >
            {money.formatSigned(totals.receivableMinor)}
          </AppText>
        </View>
        <View className="flex-1 gap-1 rounded-[14px] bg-summary-tile p-3">
          <AppText className="text-[13px] leading-[18px] text-summary-muted">
            {t('home.payable')}
          </AppText>
          <AppText
            weight="extrabold"
            adjustsFontSizeToFit
            numberOfLines={1}
            className="text-[18px] leading-[24px] text-summary-negative"
          >
            {money.formatSigned(-totals.payableMinor)}
          </AppText>
        </View>
      </View>
    </View>
  );
}
