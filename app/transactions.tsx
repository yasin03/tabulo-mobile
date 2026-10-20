import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams } from 'expo-router';
import { SearchField } from 'heroui-native';
import { ReceiptText, SearchX, SlidersHorizontal } from 'lucide-react-native';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { EmptyState } from '@/components/ui/EmptyState';
import { groupByMonth } from '@/core/grouping';
import { transactionsRepo } from '@/db';
import type { TransactionListItem } from '@/db/repositories';
import { useLiveQuery } from '@/db/useLiveQuery';
import {
  activeFilterCount,
  EMPTY_FILTERS,
  toSearchFilter,
  type TransactionFilters,
} from '@/features/transactions/filters';
import { MonthHeader } from '@/features/transactions/MonthHeader';
import { TransactionActionSheet } from '@/features/transactions/TransactionActionSheet';
import { TransactionFilterSheet } from '@/features/transactions/TransactionFilterSheet';
import { TransactionRow } from '@/features/transactions/TransactionRow';
import { useTransactionActions } from '@/features/transactions/useTransactionActions';
import { useTransactionFormData } from '@/features/transactions/useTransactionFormData';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { useColors } from '@/lib/theme';

const countAll = () => transactionsRepo.count();

/** Tüm hareketler (7.8): dönem, hareket tipi, hesap, işlem türü, konu, cari filtreleri; açıklama/belge no araması. */
export default function TransactionsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const actions = useTransactionActions();

  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  // Ana sayfadaki hesap kartından açılınca o hesaba filtreli başlar.
  const params = useLocalSearchParams<{ accountId?: string }>();
  const [filters, setFilters] = useState<TransactionFilters>(() => ({
    ...EMPTY_FILTERS,
    accountId: params.accountId ?? '',
  }));
  const [isFilterOpen, setFilterOpen] = useState(false);
  const [selected, setSelected] = useState<TransactionListItem | null>(null);
  const { data: formData } = useTransactionFormData();

  const query = useCallback(
    () => transactionsRepo.search(toSearchFilter(filters, deferredSearch)),
    [filters, deferredSearch],
  );
  const { data: rows = [], isLoading, isRefreshing, refresh } = useLiveQuery(query);
  const { data: total = 0 } = useLiveQuery(countAll);
  const items = useMemo(() => groupByMonth(rows), [rows]);
  const filterCount = activeFilterCount(filters);

  const openActions = useCallback((tx: TransactionListItem) => {
    haptics.selection();
    setSelected(tx);
  }, []);

  const hasNoTransactions = !isLoading && total === 0;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: t('transactions.title') }} />

      {hasNoTransactions ? null : (
        <View className="flex-row items-center gap-2 px-5 pb-2 pt-3">
          <SearchField value={search} onChange={setSearch} className="flex-1">
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input
                placeholder={t('transactions.searchPlaceholder')}
                autoCorrect={false}
                returnKeyType="search"
                className="min-h-12"
              />
              <SearchField.ClearButton />
            </SearchField.Group>
          </SearchField>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              filterCount > 0
                ? t('transactionFilters.buttonActive', { count: filterCount })
                : t('transactionFilters.title')
            }
            onPress={() => setFilterOpen(true)}
            className={cn(
              'h-12 w-12 items-center justify-center rounded-xl border active:opacity-70',
              filterCount > 0 ? 'border-primary bg-primary' : 'border-border bg-surface',
            )}
          >
            <SlidersHorizontal
              size={20}
              color={filterCount > 0 ? colors['primary-foreground'] : colors.primary}
            />
            {filterCount > 0 ? (
              <View className="absolute -right-1.5 -top-1.5 h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1">
                <AppText
                  weight="extrabold"
                  maxFontSizeMultiplier={1.2}
                  className="text-[11px] leading-[14px] text-accent-foreground"
                >
                  {filterCount}
                </AppText>
              </View>
            ) : null}
          </Pressable>
        </View>
      )}

      <FlashList
        data={items}
        keyExtractor={(item) => item.key}
        getItemType={(item) => item.kind}
        maintainVisibleContentPosition={{ disabled: true }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshing={isRefreshing}
        onRefresh={refresh}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        renderItem={({ item }) =>
          item.kind === 'month' ? (
            <MonthHeader month={item.month} />
          ) : (
            <TransactionRow
              item={item.item}
              variant="general"
              isFirst={item.isFirst}
              isLast={item.isLast}
              onPress={actions.open}
              onLongPress={openActions}
              onEdit={actions.edit}
              onDelete={(tx) => void actions.remove(tx)}
            />
          )
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View className="px-5 pt-3">
              {hasNoTransactions ? (
                <EmptyState
                  icon={ReceiptText}
                  title={t('transactions.empty.title')}
                  description={t('transactions.empty.description')}
                />
              ) : (
                <EmptyState
                  icon={SearchX}
                  title={t('contacts.noResults.title')}
                  description={t('contacts.noResults.description')}
                />
              )}
            </View>
          )
        }
      />

      <TransactionFilterSheet
        isOpen={isFilterOpen}
        onClose={() => setFilterOpen(false)}
        value={filters}
        onApply={setFilters}
        data={formData}
      />
      <TransactionActionSheet transaction={selected} onClose={() => setSelected(null)} />
    </View>
  );
}
