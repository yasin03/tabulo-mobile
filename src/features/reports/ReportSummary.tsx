import { HandCoins, ShoppingCart, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import type { MovementType } from '@/core/ledger';
import type { PeriodSummary } from '@/db/repositories';
import { cn } from '@/lib/cn';
import { useMoney } from '@/lib/business';
import { useColors } from '@/lib/theme';

type ReportSummaryProps = {
  summary: PeriodSummary;
  /** Kutucuğa dokununca o hareket tipindeki dönem hareketleri açılır. */
  onOpen: (types: readonly MovementType[]) => void;
};

/**
 * Dönem özet kartları (7.9): Net, Gelir (tahsilatlar), Gider (ödemeler); altında veresiye satış ve alış.
 * Lacivert kart ana sayfadaki özet kartıyla aynı dildedir.
 */
export function ReportSummary({ summary, onOpen }: ReportSummaryProps) {
  const { t } = useTranslation();
  const money = useMoney();

  const tile = (label: string, minor: number, tone: string, types: readonly MovementType[]) => {
    const amount = money.formatSigned(minor);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('reports.summary.openList', { label, amount })}
        onPress={() => onOpen(types)}
        className="flex-1 gap-1 rounded-[14px] bg-summary-tile p-3 active:opacity-70"
      >
        <AppText className="text-[13px] leading-[18px] text-summary-muted">{label}</AppText>
        <AppText
          weight="extrabold"
          adjustsFontSizeToFit
          numberOfLines={1}
          className={cn('text-[18px] leading-[24px]', tone)}
        >
          {amount}
        </AppText>
      </Pressable>
    );
  };

  return (
    <View className="gap-[10px]">
      <View className="gap-4 rounded-[22px] bg-summary p-5">
        <View className="flex-row items-center justify-between gap-3">
          <AppText className="flex-1 text-[14px] leading-[20px] text-summary-muted">
            {t('reports.summary.net')}
          </AppText>
          <AppText className="text-[13px] leading-[18px] text-summary-muted">
            {t('reports.summary.transactionCount', { count: summary.transactionCount })}
          </AppText>
        </View>
        <AppText
          weight="extrabold"
          adjustsFontSizeToFit
          numberOfLines={1}
          className="text-[34px] leading-[42px] tracking-[-0.7px] text-summary-foreground"
        >
          {money.formatSigned(summary.netMinor)}
        </AppText>
        <View className="flex-row gap-[10px]">
          {tile(t('reports.summary.income'), summary.incomeMinor, 'text-summary-positive', [
            'collection',
          ])}
          {tile(t('reports.summary.expense'), -summary.expenseMinor, 'text-summary-negative', [
            'payment',
          ])}
        </View>
      </View>

      <View className="flex-row gap-[10px]">
        <CreditTile
          icon={HandCoins}
          label={t('reports.summary.creditSales')}
          amount={money.formatSigned(summary.creditSalesMinor)}
          onPress={() => onOpen(['credit_sale'])}
        />
        <CreditTile
          icon={ShoppingCart}
          label={t('reports.summary.creditPurchases')}
          amount={money.formatSigned(-summary.creditPurchasesMinor)}
          onPress={() => onOpen(['credit_purchase'])}
        />
      </View>
    </View>
  );
}

/** Veresiye toplamı: para akışı olmadığı için nötr renk, işaret cari bakiyesine etkidir. */
function CreditTile({
  icon: Icon,
  label,
  amount,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  amount: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('reports.summary.openList', { label, amount })}
      onPress={onPress}
      className="flex-1 gap-2 rounded-[18px] border border-border bg-surface p-3.5 active:opacity-70"
    >
      <View className="h-8 w-8 items-center justify-center rounded-[10px] bg-surface-secondary">
        <Icon size={17} color={colors.primary} strokeWidth={2.2} />
      </View>
      <AppText className="text-[13px] leading-[18px] text-muted">{label}</AppText>
      <AppText
        weight="extrabold"
        adjustsFontSizeToFit
        numberOfLines={1}
        className="text-[16px] leading-[22px]"
      >
        {amount}
      </AppText>
    </Pressable>
  );
}
