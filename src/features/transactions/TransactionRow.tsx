import { Paperclip } from 'lucide-react-native';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { SwipeableRow } from '@/components/ui/SwipeableRow';
import { contactViewDisplay, generalDisplay, type AmountTone } from '@/core/ledger';
import type { TransactionListItem } from '@/db/repositories';
import { useMoney } from '@/lib/business';
import { cn } from '@/lib/cn';
import { useDates } from '@/lib/dates';
import { useColors } from '@/lib/theme';

import { MOVEMENT_STYLE } from './movementStyle';

export type TransactionRowItem = TransactionListItem & { runningBalanceMinor?: number };

const TONE_CLASS: Record<AmountTone, string> = {
  positive: 'text-positive',
  negative: 'text-negative',
  neutral: 'text-foreground',
};

type TransactionRowProps = {
  item: TransactionRowItem;
  /** `contact`: cari detayı (işaret cari etkisi, yürüyen bakiye); `general`: tüm hareketler (cari adı görünür). */
  variant: 'contact' | 'general';
  isFirst: boolean;
  isLast: boolean;
  inset?: boolean;
  onPress: (item: TransactionRowItem) => void;
  onLongPress: (item: TransactionRowItem) => void;
  onEdit: (item: TransactionRowItem) => void;
  onDelete: (item: TransactionRowItem) => void;
};

/**
 * Hareket satırı (client-detail.html): simge, başlık (açıklama veya tür), tip · tarih, sağda işaretli tutar
 * ve cari detayında o anki yürüyen bakiye. Sola kaydır → Sil, sağa kaydır → Düzenle (8.3).
 */
export const TransactionRow = memo(function TransactionRow({
  item,
  variant,
  isFirst,
  isLast,
  inset,
  onPress,
  onLongPress,
  onEdit,
  onDelete,
}: TransactionRowProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const money = useMoney();
  const dates = useDates();

  const style = MOVEMENT_STYLE[item.movementType];
  const Icon = style.icon;
  const movementLabel = t(`movementTypes.${item.movementType}`);
  const title = item.description || item.transactionTypeName || movementLabel;
  const subtitle = [
    title === movementLabel ? null : movementLabel,
    item.isCash ? t('transactionForm.cash') : null,
    variant === 'general' ? item.contactName : null,
    dates.day(item.date),
  ]
    .filter(Boolean)
    .join(' · ');

  const display = variant === 'contact' ? contactViewDisplay(item) : generalDisplay(item);
  const amount = money.formatSigned(display.sign * item.amountMinor);
  const balance =
    item.runningBalanceMinor === undefined
      ? null
      : item.runningBalanceMinor < 0
        ? money.formatSigned(item.runningBalanceMinor)
        : money.format(item.runningBalanceMinor);

  return (
    <SwipeableRow
      isFirst={isFirst}
      isLast={isLast}
      inset={inset}
      onEdit={() => onEdit(item)}
      onDelete={() => onDelete(item)}
    >
      <Pressable
        onPress={() => onPress(item)}
        onLongPress={() => onLongPress(item)}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityLabel={[
          title,
          subtitle,
          amount,
          balance ? t('transactions.runningBalance', { amount: balance }) : null,
          item.attachmentCount > 0
            ? t('transactions.attachmentCount', { count: item.attachmentCount })
            : null,
        ]
          .filter(Boolean)
          .join(', ')}
        accessibilityHint={t('transactions.actionsHint')}
        accessibilityActions={[
          { name: 'edit', label: t('common.edit') },
          { name: 'delete', label: t('common.delete') },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'edit') onEdit(item);
          if (event.nativeEvent.actionName === 'delete') onDelete(item);
        }}
        className={cn(
          'min-h-16 flex-row items-center gap-3 bg-surface px-[14px] py-3 active:bg-surface-secondary',
          !isFirst && 'border-t border-separator',
        )}
      >
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface-secondary">
          <Icon size={20} color={colors[style.color]} strokeWidth={2} />
        </View>
        <View className="flex-1 gap-0.5">
          <AppText weight="bold" numberOfLines={1}>
            {title}
          </AppText>
          <View className="flex-row items-center gap-1">
            <AppText numberOfLines={1} className="shrink text-[12px] leading-[17px] text-muted">
              {subtitle}
            </AppText>
            {item.attachmentCount > 0 ? <Paperclip size={12} color={colors.muted} /> : null}
          </View>
        </View>
        <View className="max-w-[48%] items-end gap-0.5">
          <AppText
            weight="extrabold"
            numberOfLines={1}
            className={cn('text-[15px]', TONE_CLASS[display.tone])}
          >
            {amount}
          </AppText>
          {balance ? (
            <AppText numberOfLines={1} className="text-[11px] leading-[16px] text-muted">
              {t('transactions.runningBalance', { amount: balance })}
            </AppText>
          ) : null}
        </View>
      </Pressable>
    </SwipeableRow>
  );
});
