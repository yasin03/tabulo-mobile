import { CalendarClock, CircleCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import type { ActionSheetItem } from '@/components/ui/ActionSheet';
import { AppText } from '@/components/ui/AppText';
import { MoneyText } from '@/components/ui/MoneyText';
import { dueStatus } from '@/core/recurrence';
import type { RecurringPaymentListItem } from '@/db/repositories';
import { cn } from '@/lib/cn';
import { useColors } from '@/lib/theme';

import { DueLabel } from './DueLabel';

type RecurringRowProps = {
  item: RecurringPaymentListItem;
  today: string;
  isFirst: boolean;
  onPress: (item: RecurringPaymentListItem) => void;
  onLongPress?: (item: RecurringPaymentListItem) => void;
  /** Tam listede "Ödendi" düğmesi (6.5); ana sayfada yok. */
  onPay?: (item: RecurringPaymentListItem) => void;
  /** Tam listede sıklık · hesap satırı. */
  showDetails?: boolean;
  /** Uzun basma menüsündeki eylemler; ekran okuyucuya da eylem olarak sunulur. */
  menuItems?: readonly ActionSheetItem[];
};

/** Düzenli ödeme satırı (home.html "Yaklaşan ödemeler"): simge, başlık, kalan gün, tutar. */
export function RecurringRow({
  item,
  today,
  isFirst,
  onPress,
  onLongPress,
  onPay,
  showDetails = false,
  menuItems,
}: RecurringRowProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const isActive = item.status === 'active';
  const isSoon = isActive && dueStatus(item.nextDueDate, today).tone !== 'later';
  const details = [
    t(`recurring.every.${item.frequency}`, { count: item.interval }),
    item.contactName ?? item.accountName,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={menuItems ? t('contacts.actions.hint') : undefined}
      accessibilityActions={menuItems?.map((x) => ({ name: x.key, label: x.label }))}
      onAccessibilityAction={(event) =>
        menuItems?.find((x) => x.key === event.nativeEvent.actionName)?.onPress()
      }
      onPress={() => onPress(item)}
      onLongPress={onLongPress ? () => onLongPress(item) : undefined}
      delayLongPress={350}
      className={cn(
        'min-h-16 flex-row items-center gap-3 bg-surface px-[14px] py-3 active:bg-surface-secondary',
        !isFirst && 'border-t border-separator',
      )}
    >
      <View
        className={cn(
          'h-10 w-10 items-center justify-center rounded-xl',
          isSoon ? 'bg-warning-bg' : 'bg-surface-secondary',
        )}
      >
        <CalendarClock size={20} color={isSoon ? colors['warning-fg'] : colors.primary} />
      </View>
      <View className="flex-1 gap-1">
        <AppText weight="bold" numberOfLines={1} className={cn(!isActive && 'text-muted')}>
          {item.title}
        </AppText>
        {isActive ? (
          <DueLabel nextDueDate={item.nextDueDate} today={today} />
        ) : (
          <AppText className="text-[12px] leading-[17px] text-muted">
            {t(item.isFinished ? 'recurring.finished' : 'contacts.passiveTag')}
          </AppText>
        )}
        {showDetails && details ? (
          <AppText numberOfLines={1} className="text-[12px] leading-[17px] text-muted">
            {details}
          </AppText>
        ) : null}
      </View>
      <View className="items-end gap-1.5">
        <MoneyText
          minor={item.amountMinor}
          className={cn('text-[15px]', item.movementType === 'collection' && 'text-positive')}
        />
        {onPay && isActive ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.title}: ${t(`recurring.pay.${item.movementType}`)}`}
            onPress={() => onPay(item)}
            hitSlop={6}
            className="min-h-9 flex-row items-center gap-1 rounded-full border-2 border-accent px-3 active:opacity-70"
          >
            <CircleCheck size={15} color={colors['warning-fg']} strokeWidth={2.4} />
            <AppText weight="bold" maxFontSizeMultiplier={1.3} className="text-[13px]">
              {t(`recurring.pay.${item.movementType}`)}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}
