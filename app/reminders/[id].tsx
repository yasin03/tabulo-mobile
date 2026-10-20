import { Stack, useLocalSearchParams } from 'expo-router';
import { SearchX } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { contactsRepo, remindersRepo } from '@/db';
import { useLiveQuery } from '@/db/useLiveQuery';
import { ReminderForm } from '@/features/reminders/ReminderForm';

export default function EditReminderScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useCallback(async () => {
    const reminder = await remindersRepo.getById(id);
    return { reminder, contact: await contactsRepo.getById(reminder.contactId) };
  }, [id]);
  const { data: live, error } = useLiveQuery(query);
  // Form ilk yüklenen kayıtla kurulur (bildirim kimliği yazılınca yeniden kurulmasın).
  const [data, setData] = useState(live);
  if (live && !data) setData(live);

  return (
    <>
      <Stack.Screen options={{ title: t('reminders.editTitle') }} />
      {data ? (
        <ReminderForm
          mode="edit"
          reminderId={data.reminder.id}
          contact={data.contact}
          initialValues={{
            remindDate: data.reminder.remindDate,
            remindTime: data.reminder.remindTime,
            note: data.reminder.note ?? '',
          }}
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
