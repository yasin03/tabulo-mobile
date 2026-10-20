import { Stack, useLocalSearchParams } from 'expo-router';
import { CalendarCheck, SearchX } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { formatAmountForInput } from '@/core/money';
import { accountsRepo, recurringPaymentsRepo } from '@/db';
import { useLiveQuery } from '@/db/useLiveQuery';
import { PaymentForm } from '@/features/recurring/PaymentForm';
import { useLanguage } from '@/lib/i18n';
import { useToday } from '@/lib/useToday';
import { usePreferences } from '@/stores/preferences';

/** "Ödendi" ekranı (modal). Bildirime dokununca da burası açılır. */
export default function PayRecurringScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const today = useToday();
  const lastAccountId = usePreferences((s) => s.lastAccountId);
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useCallback(async () => {
    const [recurring, accounts] = await Promise.all([
      recurringPaymentsRepo.getDetail(id),
      accountsRepo.list(),
    ]);
    return { recurring, accounts };
  }, [id]);
  const { data: live, error } = useLiveQuery(query);
  // Kaydedince sonraki tarih değişir; ekran kapanırken ilk yüklenen kayıt gösterilmeye devam eder.
  const [data, setData] = useState(live);
  if (live && !data) setData(live);

  if (!data) {
    return (
      <View className="flex-1 bg-background px-5 pt-4">
        <Stack.Screen options={{ title: t('recurring.title') }} />
        {error ? <EmptyState icon={SearchX} title={t('errors.domain.notFound')} /> : null}
      </View>
    );
  }

  const { recurring, accounts } = data;
  if (recurring.status !== 'active') {
    return (
      <View className="flex-1 bg-background px-5 pt-4">
        <Stack.Screen options={{ title: recurring.title }} />
        <EmptyState
          icon={CalendarCheck}
          title={t(recurring.isFinished ? 'recurring.finished' : 'contacts.passiveTag')}
          description={t('errors.domain.recurringEnded')}
        />
      </View>
    );
  }

  const account =
    accounts.find((a) => a.id === recurring.accountId) ??
    accounts.find((a) => a.id === lastAccountId) ??
    accounts[0];

  return (
    <PaymentForm
      recurring={recurring}
      accounts={accounts}
      today={today}
      initialValues={{
        amount: formatAmountForInput(recurring.amountMinor, language),
        date: today,
        accountId: account?.id ?? '',
      }}
    />
  );
}
