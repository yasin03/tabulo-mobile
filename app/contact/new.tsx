import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ContactForm } from '@/features/contacts/ContactForm';

export default function NewContactScreen() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('contactForm.newTitle') }} />
      <ContactForm mode="new" />
    </>
  );
}
