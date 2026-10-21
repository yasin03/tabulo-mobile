import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans';
import { Line, useFont, vec } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PixelRatio, View } from 'react-native';
import { useAnimatedReaction, useDerivedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { BarGroup, CartesianChart, useChartPressState } from 'victory-native';

import { AppText } from '@/components/ui/AppText';
import { compactAmount } from '@/core/money';
import {
  formatBucket,
  formatBucketAxis,
  formatPeriod,
  type BucketTotals,
  type Period,
} from '@/core/periods';
import { useMoney } from '@/lib/business';
import { useDates } from '@/lib/dates';
import { useColors } from '@/lib/theme';

type IncomeExpenseChartProps = {
  period: Period;
  buckets: readonly BucketTotals[];
  incomeMinor: number;
  expenseMinor: number;
};

const CHART_HEIGHT = 220;
/** Eksende en fazla bu kadar etiket; fazlası atlanarak gösterilir (ör. ayın günleri: 1, 7, 13…). */
const MAX_X_LABELS = 7;
/** Eksen yazısı telefonun yazı boyutuyla büyür ama grafiği taşırmayacak kadar. */
const MAX_FONT_SCALE = 1.3;

/**
 * Gelir-gider sütun grafiği (7.9): dönemin alt kırılımına göre (yıl → aylar, ay/hafta → günler).
 * Basılı tutup sürükleyince seçilen dilimin tutarları başlıkta görünür. Renkler temadan (4.4).
 */
export function IncomeExpenseChart({
  period,
  buckets,
  incomeMinor,
  expenseMinor,
}: IncomeExpenseChartProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const money = useMoney();
  const dates = useDates();
  const fontSize = 11 * Math.min(PixelRatio.getFontScale(), MAX_FONT_SCALE);
  const font = useFont(PlusJakartaSans_600SemiBold, fontSize);

  const { state, isActive } = useChartPressState({ x: 0, y: { income: 0, expense: 0 } });
  const [pressedIndex, setPressedIndex] = useState(-1);
  useAnimatedReaction(
    () => state.matchedIndex.value,
    (index, previous) => {
      if (index !== previous) scheduleOnRN(setPressedIndex, index);
    },
  );

  const data = useMemo(
    () =>
      buckets.map((bucket, index) => ({
        x: index,
        income: bucket.incomeMinor,
        expense: bucket.expenseMinor,
      })),
    [buckets],
  );
  const axisLabels = useMemo(
    () => buckets.map((bucket) => formatBucketAxis(bucket, period, dates.locale)),
    [buckets, period, dates.locale],
  );
  const tickValues = useMemo(() => {
    const step = Math.ceil(buckets.length / MAX_X_LABELS);
    return buckets.map((_, index) => index).filter((index) => index % step === 0);
  }, [buckets]);

  const selected = isActive ? buckets[pressedIndex] : undefined;
  const shownIncome = selected ? selected.incomeMinor : incomeMinor;
  const shownExpense = selected ? selected.expenseMinor : expenseMinor;

  const yLabel = (minor: number) => {
    const { value, unit } = compactAmount(Math.round(minor), money);
    return t(`reports.compact.${unit}`, { value });
  };

  return (
    <View className="gap-3 rounded-[18px] border border-border bg-surface p-4">
      <View className="gap-1">
        <AppText
          weight="extrabold"
          accessibilityRole="header"
          className="text-[17px] leading-[24px]"
        >
          {t('reports.chart.title')}
        </AppText>
        <AppText className="text-[13px] leading-[18px] text-muted">
          {selected ? formatBucket(selected, dates.locale) : t('reports.chart.hint')}
        </AppText>
      </View>

      <View className="flex-row flex-wrap gap-x-5 gap-y-1">
        <Legend color={colors.positive} label={t('reports.summary.income')}>
          <AppText weight="extrabold" className="text-[15px] text-positive">
            {money.formatSigned(shownIncome)}
          </AppText>
        </Legend>
        <Legend color={colors.negative} label={t('reports.summary.expense')}>
          <AppText weight="extrabold" className="text-[15px] text-negative">
            {money.formatSigned(-shownExpense)}
          </AppText>
        </Legend>
      </View>

      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('reports.chart.a11y', {
          period: formatPeriod(period, dates.locale),
          income: money.format(incomeMinor),
          expense: money.format(expenseMinor),
        })}
        style={{ height: CHART_HEIGHT }}
      >
        <CartesianChart
          data={data}
          xKey="x"
          yKeys={['income', 'expense']}
          domain={{ y: [0] }}
          domainPadding={{ left: 14, right: 14, top: 12 }}
          padding={{ bottom: 4 }}
          frame={{ lineWidth: 0 }}
          chartPressState={state}
          // Sayfa kaydırması bozulmasın: grafik ancak basılı tutunca devreye girer.
          chartPressConfig={{ pan: { activateAfterLongPress: 150 } }}
          xAxis={{
            font,
            tickValues,
            // Varsayılan tickCount (5) tickValues'u seyreltir; hepsi görünsün.
            tickCount: tickValues.length,
            labelColor: colors.muted,
            lineWidth: 0,
            formatXLabel: (index) => axisLabels[index] ?? '',
          }}
          yAxis={[
            {
              font,
              tickCount: 4,
              labelColor: colors.muted,
              lineColor: colors.border,
              formatYLabel: yLabel,
            },
          ]}
        >
          {({ points, chartBounds }) => (
            <>
              {isActive ? (
                <PressIndicator
                  x={state.x.position}
                  top={chartBounds.top}
                  bottom={chartBounds.bottom}
                  color={colors.muted}
                />
              ) : null}
              <BarGroup
                chartBounds={chartBounds}
                betweenGroupPadding={0.3}
                withinGroupPadding={0.12}
                roundedCorners={{ topLeft: 3, topRight: 3 }}
              >
                <BarGroup.Bar points={points.income} color={colors.positive} />
                <BarGroup.Bar points={points.expense} color={colors.negative} />
              </BarGroup>
            </>
          )}
        </CartesianChart>
      </View>
    </View>
  );
}

function Legend({
  color,
  label,
  children,
}: {
  color: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center gap-2">
      <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <AppText className="text-[13px] text-muted">{label}</AppText>
      {children}
    </View>
  );
}

/** Basılı tutulan dilimin dikey çizgisi. */
function PressIndicator({
  x,
  top,
  bottom,
  color,
}: {
  x: SharedValue<number>;
  top: number;
  bottom: number;
  color: string;
}) {
  const start = useDerivedValue(() => vec(x.value, top));
  const end = useDerivedValue(() => vec(x.value, bottom));
  return <Line p1={start} p2={end} color={color} strokeWidth={1} opacity={0.6} />;
}
