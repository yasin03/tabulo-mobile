import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { EMPTY_ACCOUNT_FORM } from '@/core/forms/account';
import { AccountForm } from '@/features/settings/AccountForm';

export default function NewAccountScreen() {
  const { t } = useTranslation();
  return (
    <>
      <Stack.Screen options={{ title: t('accounts.newTitle') }} />
      <AccountForm mode="new" initialValues={EMPTY_ACCOUNT_FORM} />
    </>
  );
}
