import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  View,
} from 'react-native';

import { monthKey, monthRange, toIsoDate } from '@/core/dates';
import type { ContactTotals, PeriodSummary } from '@/db/repositories';
import { useMoney } from '@/lib/business';
import { useDates } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { type HomeSummaryCard, usePreferences } from '@/stores/preferences';

import { SummaryCard } from './SummaryCard';

const PAGES: readonly HomeSummaryCard[] = ['cashFlow', 'contacts'];
const GAP = 12;

type SummaryCarouselProps = {
  /** `2026-10` */
  month: string;
  cashFlow: Pick<PeriodSummary, 'incomeMinor' | 'expenseMinor' | 'netMinor'>;
  totals: ContactTotals;
  onMonthPress: () => void;
};

/**
 * Ana sayfa özet kartları (kullanıcı kararı, TestFlight geri bildirimi): sağa/sola kaydırılır, son görülen kart
 * hatırlanır. 1) Nakit akışı: seçilen ayın tahsilatları (giriş), ödemeleri (çıkış) ve farkı. 2) Cari bakiyesi:
 * seçilen ayın sonundaki alacak / borç; kasa ve banka hariç.
 */
export function SummaryCarousel({ month, cashFlow, totals, onMonthPress }: SummaryCarouselProps) {
  const { t } = useTranslation();
  const money = useMoney();
  const dates = useDates();
  const page = usePreferences((s) => s.homeSummaryCard);
  const setPage = usePreferences((s) => s.setHomeSummaryCard);
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);

  const isCurrentMonth = month === monthKey(toIsoDate());
  const range = monthRange(`${month}-01`);
  const monthLabel = dates.format(`${month}-01`, 'monthYear');
  const signedOrPlain = (minor: number) =>
    minor === 0 ? money.format(0) : money.formatSigned(minor);

  const openTransactions = (type: 'collection' | 'payment') =>
    router.push({
      pathname: '/transactions',
      params: { from: range.from, to: range.to, types: type },
    });

  const cards: Record<HomeSummaryCard, React.ReactNode> = {
    cashFlow: (
      <SummaryCard
        title={
          isCurrentMonth ? t('home.cashFlowNet') : t('home.cashFlowNetOf', { month: monthLabel })
        }
        amount={signedOrPlain(cashFlow.netMinor)}
        month={month}
        onMonthPress={onMonthPress}
        tiles={[
          {
            label: isCurrentMonth ? t('home.moneyInThisMonth') : t('home.moneyIn'),
            value: money.formatSigned(cashFlow.incomeMinor),
            tone: 'positive',
            onPress: () => openTransactions('collection'),
            accessibilityHint: t('home.moneyInHint'),
          },
          {
            label: isCurrentMonth ? t('home.moneyOutThisMonth') : t('home.moneyOut'),
            value: money.formatSigned(-cashFlow.expenseMinor),
            tone: 'negative',
            onPress: () => openTransactions('payment'),
            accessibilityHint: t('home.moneyOutHint'),
          },
        ]}
      />
    ),
    contacts: (
      <SummaryCard
        title={
          isCurrentMonth
            ? t('home.contactBalance')
            : t('home.contactBalanceAsOf', { date: dates.format(range.to, 'dayMonthLong') })
        }
        amount={signedOrPlain(totals.netMinor)}
        month={month}
        onMonthPress={onMonthPress}
        note={t('home.contactsOnlyNote')}
        tiles={[
          {
            label: t('home.receivable'),
            value: money.formatSigned(totals.receivableMinor),
            tone: 'positive',
          },
          {
            label: t('home.payable'),
            value: money.formatSigned(-totals.payableMinor),
            tone: 'negative',
          },
        ]}
      />
    ),
  };

  const index = PAGES.indexOf(page);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = Math.round(event.nativeEvent.layout.width);
    if (next !== width) setWidth(next);
  };

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = PAGES[Math.round(event.nativeEvent.contentOffset.x / (width + GAP))];
    if (next && next !== page) {
      haptics.selection();
      setPage(next);
    }
  };

  const goTo = (target: HomeSummaryCard) => {
    scrollRef.current?.scrollTo({ x: PAGES.indexOf(target) * (width + GAP), animated: true });
    setPage(target);
  };

  return (
    <View className="gap-2.5" onLayout={onLayout}>
      {width === 0 ? (
        // Genişlik ölçülene kadar seçili kart düz gösterilir (kaydırıcı sayfa genişliğini bilmeli).
        <View>{cards[page]}</View>
      ) : (
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={width + GAP}
          decelerationRate="fast"
          disableIntervalMomentum
          contentOffset={{ x: index * (width + GAP), y: 0 }}
          contentContainerStyle={{ gap: GAP }}
          onMomentumScrollEnd={onMomentumScrollEnd}
        >
          {PAGES.map((key) => (
            <View key={key} style={{ width }}>
              {cards[key]}
            </View>
          ))}
        </ScrollView>
      )}

      <View className="flex-row justify-center gap-1.5">
        {PAGES.map((key) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={
              key === 'cashFlow' ? t('home.cardCashFlow') : t('home.cardContacts')
            }
            accessibilityState={{ selected: key === page }}
            onPress={() => goTo(key)}
            hitSlop={10}
            className="py-1"
          >
            <View
              className={`h-2 rounded-full ${key === page ? 'w-5 bg-primary' : 'w-2 bg-separator'}`}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
