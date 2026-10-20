import { Stack, useLocalSearchParams } from 'expo-router';
import { SearchX } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { addDays, toIsoDate } from '@/core/dates';
import { contactsRepo } from '@/db';
import { useLiveQuery } from '@/db/useLiveQuery';
import { ReminderForm } from '@/features/reminders/ReminderForm';
import { usePreferences } from '@/stores/preferences';

/** Cari detayındaki "Hatırlat" (6.6). Varsayılan: yarın, ayarlardaki hatırlatma saati. */
export default function NewReminderScreen() {
  const { t } = useTranslation();
  const { contactId } = useLocalSearchParams<{ contactId: string }>();
  const remindTime = usePreferences((s) => s.defaultRemindTime);
  const query = useCallback(() => contactsRepo.getById(contactId), [contactId]);
  const { data: contact, error } = useLiveQuery(query);
  const [initialValues] = useState(() => ({
    remindDate: addDays(toIsoDate(), 1),
    remindTime,
    note: '',
  }));

  return (
    <>
      <Stack.Screen options={{ title: t('reminders.newTitle') }} />
      {contact ? (
        <ReminderForm mode="new" contact={contact} initialValues={initialValues} />
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
