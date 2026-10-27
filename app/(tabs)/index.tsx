import { router } from 'expo-router';
import { Button } from 'heroui-native';
import { Bell, Plus, ReceiptText } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { Logo } from '@/components/brand/Logo';
import { AppText } from '@/components/ui/AppText';
import { EmptyState } from '@/components/ui/EmptyState';
import { ListSkeleton } from '@/components/ui/ListSkeleton';
import { TabScreen } from '@/components/ui/TabScreen';
import { monthKey, monthRange, monthsBetween } from '@/core/dates';
import {
  accountsRepo,
  contactsRepo,
  recurringPaymentsRepo,
  remindersRepo,
  transactionsRepo,
} from '@/db';
import type { TransactionListItem } from '@/db/repositories';
import { useLiveQuery } from '@/db/useLiveQuery';
import { AccountBalances } from '@/features/home/AccountBalances';
import { DueReceivableRow } from '@/features/home/DueReceivableRow';
import { MonthPickerSheet } from '@/features/home/MonthPickerSheet';
import { QuickActions } from '@/features/home/QuickActions';
import { SectionHeader } from '@/features/home/SectionHeader';
import { SummaryCard } from '@/features/home/SummaryCard';
import { RecurringRow } from '@/features/recurring/RecurringRow';
import { useRecurringActions } from '@/features/recurring/useRecurringActions';
import { TransactionActionSheet } from '@/features/transactions/TransactionActionSheet';
import { TransactionRow } from '@/features/transactions/TransactionRow';
import { useTransactionActions } from '@/features/transactions/useTransactionActions';
import { haptics } from '@/lib/haptics';
import { useColors } from '@/lib/theme';
import { useToday } from '@/lib/useToday';

const RECENT_LIMIT = 5;
const DUE_LIMIT = 5;
const UPCOMING_LIMIT = 3;
/** Ay seçicide en fazla geriye gidilecek ay sayısı. */
const MAX_MONTHS = 36;

/** Ana sayfa (7.2, home.html). */
export default function HomeScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const actions = useTransactionActions();
  const recurringActions = useRecurringActions();
  const today = useToday();
  const currentMonth = monthKey(today);
  const [month, setMonth] = useState(currentMonth);
  const [isMonthPickerOpen, setMonthPickerOpen] = useState(false);
  const [selected, setSelected] = useState<TransactionListItem | null>(null);

  const asOf = monthRange(`${month}-01`).to;
  const query = useCallback(async () => {
    const [totals, accounts, due, recent, firstDate, upcoming, dueReminders] = await Promise.all([
      contactsRepo.totals(asOf),
      accountsRepo.listWithBalances(),
      transactionsRepo.dueReceivables(today),
      transactionsRepo.search({ limit: RECENT_LIMIT }),
      transactionsRepo.firstDate(),
      recurringPaymentsRepo.list({ activeOnly: true }),
      remindersRepo.countDue(today),
    ]);
    return { totals, accounts, due, recent, firstDate, upcoming, dueReminders };
  }, [asOf, today]);
  const { data, isRefreshing, refresh } = useLiveQuery(query);

  const firstDate = data?.firstDate ?? null;
  const months = useMemo(() => {
    const first = firstDate ? monthKey(firstDate) : currentMonth;
    return monthsBetween(first < currentMonth ? first : currentMonth, currentMonth).slice(
      0,
      MAX_MONTHS,
    );
  }, [firstDate, currentMonth]);

  const openActions = useCallback((tx: TransactionListItem) => {
    haptics.selection();
    setSelected(tx);
  }, []);

  const dueReminders = data?.dueReminders ?? 0;

  return (
    <TabScreen
      header={<Logo />}
      isRefreshing={isRefreshing}
      onRefresh={refresh}
      right={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            dueReminders > 0
              ? t('home.remindersDue', { count: dueReminders })
              : t('home.notifications')
          }
          onPress={() => router.push('/reminders')}
          className="h-11 w-11 items-center justify-center rounded-[14px] border border-border bg-surface active:opacity-70"
        >
          <Bell size={22} color={colors.primary} strokeWidth={2} />
          {dueReminders > 0 ? (
            <View className="absolute -right-1.5 -top-1.5 h-5 min-w-5 items-center justify-center rounded-full border-2 border-background bg-negative px-1">
              <AppText
                weight="extrabold"
                maxFontSizeMultiplier={1.2}
                className="text-[11px] leading-3.25 text-primary-foreground"
              >
                {dueReminders > 9 ? '9+' : dueReminders}
              </AppText>
            </View>
          ) : null}
        </Pressable>
      }
    >
      <SummaryCard
        month={month}
        asOf={asOf}
        totals={data?.totals ?? { receivableMinor: 0, payableMinor: 0, netMinor: 0 }}
        onMonthPress={() => setMonthPickerOpen(true)}
      />

      {data && data.accounts.length > 0 ? <AccountBalances accounts={data.accounts} /> : null}

      <QuickActions />

      {data && data.upcoming.length > 0 ? (
        <View className="gap-2.5">
          <SectionHeader
            title={t('home.upcomingPayments')}
            onSeeAll={() => router.push('/recurring')}
            seeAllLabel={
              data.upcoming.length > UPCOMING_LIMIT
                ? t('home.seeAllCount', { count: data.upcoming.length })
                : undefined
            }
          />
          <View className="overflow-hidden rounded-[18px] border border-border bg-surface">
            {data.upcoming.slice(0, UPCOMING_LIMIT).map((item, index) => (
              <RecurringRow
                key={item.id}
                item={item}
                today={today}
                isFirst={index === 0}
                onPress={recurringActions.pay}
              />
            ))}
          </View>
        </View>
      ) : null}

      {data && data.due.length > 0 ? (
        <View className="gap-2.5">
          <SectionHeader
            title={t('home.dueReceivables')}
            onSeeAll={
              data.due.length > DUE_LIMIT ? () => router.push('/due-receivables') : undefined
            }
            seeAllLabel={t('home.seeAllCount', { count: data.due.length })}
          />
          <View className="overflow-hidden rounded-[18px] border border-border bg-surface">
            {data.due.slice(0, DUE_LIMIT).map((item, index) => (
              <DueReceivableRow
                key={`${item.contactId}-${item.transactionId ?? index}`}
                item={item}
                isFirst={index === 0}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View className="gap-2.5">
        <SectionHeader
          title={t('home.recent')}
          onSeeAll={data && data.recent.length > 0 ? () => router.push('/transactions') : undefined}
        />
        {data && data.recent.length > 0 ? (
          <View>
            {data.recent.map((item, index) => (
              <TransactionRow
                key={item.id}
                item={item}
                variant="general"
                inset={false}
                isFirst={index === 0}
                isLast={index === data.recent.length - 1}
                onPress={actions.open}
                onLongPress={openActions}
                onEdit={actions.edit}
                onDelete={(tx) => void actions.remove(tx)}
              />
            ))}
          </View>
        ) : !data ? (
          <ListSkeleton rows={4} />
        ) : (
          <EmptyState
            icon={ReceiptText}
            title={t('home.empty.title')}
            description={t('home.empty.description')}
            action={
              <Button
                variant="primary"
                className="mt-2 min-h-12"
                onPress={() =>
                  router.push({ pathname: '/transaction/new', params: { type: 'collection' } })
                }
              >
                <Plus size={18} color={colors['accent-foreground']} strokeWidth={2.4} />
                <Button.Label>{t('tabs.add')}</Button.Label>
              </Button>
            }
          />
        )}
      </View>

      <MonthPickerSheet
        isOpen={isMonthPickerOpen}
        onOpenChange={setMonthPickerOpen}
        months={months}
        value={month}
        onChange={setMonth}
      />
      <TransactionActionSheet transaction={selected} onClose={() => setSelected(null)} />
    </TabScreen>
  );
}
