import { Stack } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { businessToFormValues } from '@/core/forms/business';
import { BusinessForm } from '@/features/settings/BusinessForm';
import { useBusinessProfile } from '@/lib/business';

export default function BusinessProfileScreen() {
  const { t } = useTranslation();
  const profile = useBusinessProfile();
  // Form ilk açılıştaki değerlerle kurulur; kayıt sonrası canlı güncelleme girilen metni ezmez.
  const [initial] = useState(() => ({
    values: businessToFormValues(profile),
    logoUri: profile.logoUri,
  }));
  return (
    <>
      <Stack.Screen options={{ title: t('settings.businessProfile') }} />
      <BusinessForm initialValues={initial.values} logoUri={initial.logoUri} />
    </>
  );
}
