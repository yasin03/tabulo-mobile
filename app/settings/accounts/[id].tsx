import { Stack, useLocalSearchParams } from 'expo-router';
import { SearchX } from 'lucide-react-native';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { accountToFormValues } from '@/core/forms/account';
import { accountsRepo } from '@/db';
import { useLiveQuery } from '@/db/useLiveQuery';
import { AccountForm } from '@/features/settings/AccountForm';
import { useLanguage } from '@/lib/i18n';

export default function EditAccountScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useCallback(() => accountsRepo.getById(id), [id]);
  const { data: account, error } = useLiveQuery(query);

  return (
    <>
      <Stack.Screen options={{ title: t('accounts.editTitle') }} />
      {account ? (
        // Form ilk yüklenen değerlerle kurulur; arka plandaki güncellemeler girilen metni ezmez.
        <AccountForm
          key={account.id}
          mode="edit"
          accountId={account.id}
          isActive={account.status === 'active'}
          initialValues={accountToFormValues(account, language)}
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
