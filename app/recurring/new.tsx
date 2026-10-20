import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { emptyRecurringForm, type RecurringFormValues } from '@/core/forms/recurring';
import { RecurringForm } from '@/features/recurring/RecurringForm';
import { useTransactionFormData } from '@/features/transactions/useTransactionFormData';
import { useToday } from '@/lib/useToday';
import { usePreferences } from '@/stores/preferences';

/** Yeni düzenli ödeme. Varsayılanlar: aylık, bugün, son kullanılan hesap, "Genel" konusu, 1 gün önce. */
export default function NewRecurringScreen() {
  const { t } = useTranslation();
  const today = useToday();
  const { data } = useTransactionFormData();
  const lastAccountId = usePreferences((s) => s.lastAccountId);
  const remindTime = usePreferences((s) => s.defaultRemindTime);

  // Form ilk yüklenen değerlerle bir kez kurulur.
  const [initialValues, setInitialValues] = useState<RecurringFormValues | null>(null);
  if (data && !initialValues) {
    const active = data.accounts.filter((a) => a.status === 'active');
    const account = active.find((a) => a.id === lastAccountId) ?? active[0];
    setInitialValues({
      ...emptyRecurringForm(today, remindTime),
      accountId: account?.id ?? '',
      subjectId: data.defaultSubject?.id ?? '',
    });
  }

  return (
    <>
      <Stack.Screen options={{ title: t('recurring.newTitle') }} />
      {data && initialValues ? (
        <RecurringForm mode="new" data={data} initialValues={initialValues} />
      ) : (
        <View className="flex-1 bg-background" />
      )}
    </>
  );
}
