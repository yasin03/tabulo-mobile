import { router } from 'expo-router';
import { ChartColumn, Share } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { EmptyState } from '@/components/ui/EmptyState';
import { TabScreen } from '@/components/ui/TabScreen';
import type { MovementType } from '@/core/ledger';
import {
  customPeriod,
  periodBuckets,
  periodContaining,
  totalsByBucket,
  weekStartFor,
  type Period,
} from '@/core/periods';
import { accountsRepo, reportsRepo } from '@/db';
import type { CategoryTotal } from '@/db/repositories';
import { useLiveQuery } from '@/db/useLiveQuery';
import { BarList, type BarListItem } from '@/features/reports/BarList';
import { CustomRangeSheet } from '@/features/reports/CustomRangeSheet';
import { IncomeExpenseChart } from '@/features/reports/IncomeExpenseChart';
import { PeriodSelector } from '@/features/reports/PeriodSelector';
import { ReportSummary } from '@/features/reports/ReportSummary';
import { useMoney } from '@/lib/business';
import { useDates } from '@/lib/dates';
import { useColors } from '@/lib/theme';
import { useToday } from '@/lib/useToday';

/**
 * Raporlar (7.9): dönem seçici, özet kartları, gelir-gider grafiği, işlem türü ve konuya göre gider,
 * dönem sonundaki hesap bakiyeleri. Grafikler Premium'dur; kilit Faz 9'da (şimdilik herkese açık).
 */
export default function ReportsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const money = useMoney();
  const dates = useDates();
  const today = useToday();
  const weekStart = weekStartFor(dates.locale);
  const [period, setPeriod] = useState<Period>(() => periodContaining('month', today, 1));
  const [rangeSheet, setRangeSheet] = useState({ isOpen: false, key: 0 });

  // Hesap bakiyeleri dönem sonundaki durumdur; dönem sürüyorsa bugün.
  const asOf = period.to < today ? period.to : today;
  const { from, to } = period;
  const query = useCallback(async () => {
    const range = { from, to };
    const [summary, daily, byType, bySubject, accounts] = await Promise.all([
      reportsRepo.summary(range),
      reportsRepo.dailyIncomeExpense(range),
      reportsRepo.expensesByType(range),
      reportsRepo.expensesBySubject(range),
      accountsRepo.listWithBalances({ asOf }),
    ]);
    return { summary, daily, byType, bySubject, accounts };
  }, [from, to, asOf]);
  const { data, isRefreshing, refresh } = useLiveQuery(query);

  const buckets = useMemo(
    () => totalsByBucket(periodBuckets(period, weekStart), data?.daily ?? []),
    [period, weekStart, data?.daily],
  );

  const openTransactions = useCallback(
    (params: {
      types?: readonly MovementType[];
      transactionTypeId?: string;
      subjectId?: string;
      accountId?: string;
    }) => {
      router.push({
        pathname: '/transactions',
        params: {
          from,
          to,
          ...(params.types ? { types: params.types.join(',') } : {}),
          ...(params.transactionTypeId ? { transactionTypeId: params.transactionTypeId } : {}),
          ...(params.subjectId ? { subjectId: params.subjectId } : {}),
          ...(params.accountId ? { accountId: params.accountId } : {}),
        },
      });
    },
    [from, to],
  );

  const categoryItems = (
    rows: readonly CategoryTotal[],
    emptyName: string,
    filterKey: 'transactionTypeId' | 'subjectId',
  ): BarListItem[] => {
    const total = rows.reduce((sum, row) => sum + row.totalMinor, 0);
    const max = rows[0]?.totalMinor ?? 0;
    return rows.map((row) => {
      const name = row.name ?? emptyName;
      const amount = money.formatSigned(-row.totalMinor);
      const percent = total > 0 ? Math.max(1, Math.round((row.totalMinor / total) * 100)) : 0;
      const id = row.id;
      return {
        key: id ?? 'none',
        label: name,
        amount,
        ratio: max > 0 ? row.totalMinor / max : 0,
        detail: t('reports.percent', { value: percent }),
        tone: 'negative',
        accessibilityLabel: t('reports.rowA11y', { name, amount, percent }),
        onPress: id ? () => openTransactions({ types: ['payment'], [filterKey]: id }) : undefined,
      };
    });
  };

  const accountItems = (): BarListItem[] => {
    const accounts = data?.accounts ?? [];
    const max = Math.max(0, ...accounts.map((account) => Math.abs(account.balanceMinor)));
    return accounts.map((account) => ({
      key: account.id,
      label: account.name,
      amount: money.formatSigned(account.balanceMinor),
      ratio: max > 0 ? Math.abs(account.balanceMinor) / max : 0,
      tone: account.balanceMinor < 0 ? 'negative' : 'positive',
      accessibilityLabel: `${account.name}: ${money.formatSigned(account.balanceMinor)}`,
      onPress: () => router.push({ pathname: '/transactions', params: { accountId: account.id } }),
    }));
  };

  const summary = data?.summary;
  const hasTransactions = (summary?.transactionCount ?? 0) > 0;
  const hasCashFlow = !!summary && (summary.incomeMinor > 0 || summary.expenseMinor > 0);

  return (
    <TabScreen
      title={t('tabs.reports')}
      isRefreshing={isRefreshing}
      onRefresh={refresh}
      right={
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: '/export/report',
              params: { source: 'report', unit: period.unit, from, to },
            })
          }
          className="min-h-11 flex-row items-center gap-1.5 rounded-[14px] border border-border bg-surface px-3 active:opacity-70"
        >
          <Share size={18} color={colors.primary} strokeWidth={2.2} />
          <AppText weight="bold" maxFontSizeMultiplier={1.4} className="text-[14px] text-primary">
            {t('reports.export')}
          </AppText>
        </Pressable>
      }
    >
      <PeriodSelector
        period={period}
        today={today}
        weekStart={weekStart}
        onChange={setPeriod}
        onCustomPress={() => setRangeSheet(({ key }) => ({ isOpen: true, key: key + 1 }))}
      />

      {summary ? (
        <ReportSummary summary={summary} onOpen={(types) => openTransactions({ types })} />
      ) : null}

      {data && !hasTransactions ? (
        <EmptyState
          icon={ChartColumn}
          title={t('reports.empty.title')}
          description={t('reports.empty.description')}
        />
      ) : null}

      {data && hasTransactions ? (
        <>
          {hasCashFlow && buckets.length > 1 ? (
            <IncomeExpenseChart
              period={period}
              buckets={buckets}
              incomeMinor={data.summary.incomeMinor}
              expenseMinor={data.summary.expenseMinor}
            />
          ) : null}
          <BarList
            title={t('reports.byType')}
            items={categoryItems(data.byType, t('reports.noType'), 'transactionTypeId')}
            emptyText={t('reports.noExpenses')}
          />
          <BarList
            title={t('reports.bySubject')}
            items={categoryItems(data.bySubject, t('reports.noSubject'), 'subjectId')}
            emptyText={t('reports.noExpenses')}
          />
        </>
      ) : null}

      {data && data.accounts.length > 0 ? (
        <BarList
          title={t('reports.accounts')}
          subtitle={t('reports.accountsAsOf', { date: dates.format(asOf, 'full') })}
          items={accountItems()}
          emptyText=""
        />
      ) : null}

      <CustomRangeSheet
        key={rangeSheet.key}
        isOpen={rangeSheet.isOpen}
        onClose={() => setRangeSheet((prev) => ({ ...prev, isOpen: false }))}
        initial={period}
        onApply={(range) => setPeriod(customPeriod(range.from, range.to))}
      />
    </TabScreen>
  );
}
