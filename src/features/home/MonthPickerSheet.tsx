import { BottomSheet, Button } from 'heroui-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { cn } from '@/lib/cn';
import { useDates } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { useColors } from '@/lib/theme';

type MonthPickerSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** En yeniden eskiye seçilebilir aylar (`2026-10`, `2026-09`…). */
  months: readonly string[];
  value: string;
  onChange: (month: string) => void;
};

/** Özet kartının ay seçicisi: ‹ Ekim 2026 › ve "Bu ay". Değişiklik hemen uygulanır. */
export function MonthPickerSheet({
  isOpen,
  onOpenChange,
  months,
  value,
  onChange,
}: MonthPickerSheetProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const dates = useDates();
  const index = Math.max(0, months.indexOf(value));
  const newer = months[index - 1];
  const older = months[index + 1];
  const current = months[0];

  const go = (month: string | undefined) => {
    if (!month) return;
    haptics.selection();
    onChange(month);
  };

  const arrow = (month: string | undefined, label: string, Icon: typeof ChevronLeft) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !month }}
      disabled={!month}
      onPress={() => go(month)}
      className={cn(
        'h-12 w-12 items-center justify-center rounded-[14px] border border-border bg-surface active:opacity-70',
        !month && 'opacity-40',
      )}
    >
      <Icon size={22} color={colors.primary} />
    </Pressable>
  );

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content>
          <View className="gap-4 px-1" style={{ paddingBottom: insets.bottom + 8 }}>
            <BottomSheet.Title className="font-extrabold text-[18px]">
              {t('home.monthPicker')}
            </BottomSheet.Title>
            <View className="flex-row items-center gap-3">
              {arrow(older, t('home.previousMonth'), ChevronLeft)}
              <AppText
                weight="extrabold"
                accessibilityLiveRegion="polite"
                className="flex-1 text-center text-[18px]"
              >
                {dates.format(`${value}-01`, 'monthYear')}
              </AppText>
              {arrow(newer, t('home.nextMonth'), ChevronRight)}
            </View>
            <Button
              variant="secondary"
              size="lg"
              className="h-12"
              isDisabled={value === current}
              onPress={() => go(current)}
            >
              <Button.Label>{t('home.thisMonth')}</Button.Label>
            </Button>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
