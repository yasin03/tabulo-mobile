import { Stack, useLocalSearchParams } from 'expo-router';
import { SearchX } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { recurringToFormValues } from '@/core/forms/recurring';
import { recurringPaymentsRepo } from '@/db';
import { useLiveQuery } from '@/db/useLiveQuery';
import { RecurringForm } from '@/features/recurring/RecurringForm';
import { useTransactionFormData } from '@/features/transactions/useTransactionFormData';
import { useLanguage } from '@/lib/i18n';

export default function EditRecurringScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useCallback(() => recurringPaymentsRepo.getById(id), [id]);
  const { data: live, error } = useLiveQuery(query);
  const { data } = useTransactionFormData();
  // Form ilk yüklenen kayıtla kurulur; arka plandaki güncellemeler (ör. bildirim kimliği) girilenleri ezmez.
  const [recurring, setRecurring] = useState(live);
  if (live && !recurring) setRecurring(live);

  return (
    <>
      <Stack.Screen options={{ title: t('recurring.editTitle') }} />
      {recurring && data ? (
        <RecurringForm
          key={recurring.id}
          mode="edit"
          data={data}
          recurringId={recurring.id}
          startDate={recurring.startDate}
          nextDueDate={recurring.nextDueDate}
          initialValues={recurringToFormValues(recurring, language)}
        />
      ) : error ? (
        <View className="flex-1 bg-background px-5 pt-4">
          <EmptyState icon={SearchX} title={t('errors.domain.notFound')} />
        </View>
      ) : (
        <View className="flex-1 bg-background" />
      )}
    </>
  );
}
