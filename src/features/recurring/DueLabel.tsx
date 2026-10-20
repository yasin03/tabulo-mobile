import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { dueStatus } from '@/core/recurrence';
import { cn } from '@/lib/cn';
import { useDates } from '@/lib/dates';

type DueLabelProps = { nextDueDate: string; today: string };

/**
 * Kalan gün etiketi (6.5): geçmişse kırmızı "Gecikti", 7 gün ve altıysa sarı "3 gün kaldı" / "Bugün",
 * daha uzaksa gri tarih.
 */
export function DueLabel({ nextDueDate, today }: DueLabelProps) {
  const { t } = useTranslation();
  const dates = useDates();
  const { days, tone } = dueStatus(nextDueDate, today);

  if (tone === 'later') {
    return (
      <AppText className="text-[12px] leading-[17px] text-muted">
        {t('recurring.due.later', { count: days, date: dates.format(nextDueDate, 'dayMonthLong') })}
      </AppText>
    );
  }

  const label =
    tone === 'overdue'
      ? t('recurring.due.overdue', { count: -days })
      : days === 0
        ? t('recurring.due.today')
        : t('recurring.due.inDays', { count: days });

  return (
    <View className="flex-row">
      <View
        className={cn(
          'rounded-full px-2 py-[2px]',
          tone === 'overdue' ? 'border border-negative' : 'bg-warning-bg',
        )}
      >
        <AppText
          weight="bold"
          maxFontSizeMultiplier={1.4}
          className={cn(
            'text-[12px] leading-[16px]',
            tone === 'overdue' ? 'text-negative' : 'text-warning-fg',
          )}
        >
          {label}
        </AppText>
      </View>
    </View>
  );
}
