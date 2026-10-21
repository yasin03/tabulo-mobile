import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import {
  canGoForward,
  changeUnit,
  containsDate,
  formatPeriod,
  PERIOD_UNITS,
  periodContaining,
  shiftPeriod,
  type Period,
  type WeekStart,
} from '@/core/periods';
import { cn } from '@/lib/cn';
import { useDates } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { useColors } from '@/lib/theme';

type PeriodSelectorProps = {
  period: Period;
  today: string;
  weekStart: WeekStart;
  onChange: (period: Period) => void;
  /** "Özel" seçilince veya özel aralığın başlığına dokununca aralık seçici açılır. */
  onCustomPress: () => void;
};

/** Raporların dönem seçicisi (7.9): Gün / Hafta / Ay / Yıl / Özel ve ‹ dönem › okları. */
export function PeriodSelector({
  period,
  today,
  weekStart,
  onChange,
  onCustomPress,
}: PeriodSelectorProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const dates = useDates();
  const label = formatPeriod(period, dates.locale);
  const canForward = canGoForward(period, today);
  const isCustom = period.unit === 'custom';
  const fixedUnit = period.unit === 'custom' ? null : period.unit;
  const isCurrent = containsDate(period, today);

  const go = (direction: -1 | 1) => {
    haptics.selection();
    onChange(shiftPeriod(period, direction));
  };

  const arrow = (direction: -1 | 1) => {
    const disabled = direction === 1 && !canForward;
    const Icon = direction === 1 ? ChevronRight : ChevronLeft;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={direction === 1 ? t('reports.next') : t('reports.previous')}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => go(direction)}
        className={cn(
          'h-12 w-12 items-center justify-center rounded-[14px] border border-border bg-surface active:opacity-70',
          disabled && 'opacity-40',
        )}
      >
        <Icon size={22} color={colors.primary} />
      </Pressable>
    );
  };

  return (
    <View className="gap-3">
      <SegmentedControl
        accessibilityLabel={t('reports.unitLabel')}
        options={PERIOD_UNITS.map((unit) => ({ value: unit, label: t(`reports.units.${unit}`) }))}
        value={period.unit}
        onChange={(unit) => {
          if (unit === 'custom') onCustomPress();
          else onChange(changeUnit(period, unit, today, weekStart));
        }}
      />

      <View className="flex-row items-center gap-3">
        {arrow(-1)}
        {isCustom ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('reports.changeRange', { period: label })}
            onPress={onCustomPress}
            className="min-h-12 flex-1 flex-row items-center justify-center gap-2 active:opacity-70"
          >
            <CalendarRange size={18} color={colors.primary} strokeWidth={2.2} />
            <AppText
              weight="extrabold"
              accessibilityLiveRegion="polite"
              className="shrink text-center text-[16px] leading-[22px] text-primary"
            >
              {label}
            </AppText>
          </Pressable>
        ) : (
          <AppText
            weight="extrabold"
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
            className="flex-1 text-center text-[17px] leading-[24px]"
          >
            {label}
          </AppText>
        )}
        {arrow(1)}
      </View>

      {fixedUnit && !isCurrent ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            haptics.selection();
            onChange(periodContaining(fixedUnit, today, weekStart));
          }}
          hitSlop={8}
          className="min-h-11 items-center justify-center self-center px-3 active:opacity-70"
        >
          <AppText weight="bold" className="text-[13px] text-primary">
            {t(`reports.backToCurrent.${fixedUnit}`)}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
