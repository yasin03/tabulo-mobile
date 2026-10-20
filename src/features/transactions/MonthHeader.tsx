import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useDates } from '@/lib/dates';

/** Listelerde ay başlığı: `EKİM 2026` (client-detail.html). */
export function MonthHeader({ month }: { month: string }) {
  const dates = useDates();
  return (
    <View className="px-5 pb-2 pt-4">
      <AppText
        weight="bold"
        accessibilityRole="header"
        maxFontSizeMultiplier={1.4}
        className="text-[13px] leading-[18px] tracking-[0.5px] text-muted"
      >
        {dates.format(`${month}-01`, 'monthYear').toLocaleUpperCase(dates.locale)}
      </AppText>
    </View>
  );
}
