import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { contactToFormValues } from '@/core/forms/contact';
import { contactsRepo } from '@/db';
import { useLiveQuery } from '@/db/useLiveQuery';
import { ContactForm } from '@/features/contacts/ContactForm';
import { SearchX } from 'lucide-react-native';

export default function EditContactScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useCallback(() => contactsRepo.getById(id), [id]);
  const { data: contact, error } = useLiveQuery(query);

  return (
    <>
      <Stack.Screen options={{ title: t('contactForm.editTitle') }} />
      {contact ? (
        // Form ilk yüklenen değerlerle kurulur; arka plandaki güncellemeler girilen metni ezmez.
        <ContactForm
          key={contact.id}
          mode="edit"
          contactId={contact.id}
          initialValues={contactToFormValues(contact)}
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
