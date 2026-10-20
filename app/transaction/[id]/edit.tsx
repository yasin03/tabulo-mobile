import { Stack, useLocalSearchParams } from 'expo-router';
import { SearchX } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { transactionToFormValues } from '@/core/forms/transaction';
import { transactionsRepo } from '@/db';
import type { TransactionDetail } from '@/db/repositories';
import { useLiveQuery } from '@/db/useLiveQuery';
import { TransactionForm } from '@/features/transactions/TransactionForm';
import {
  useTransactionFormData,
  type TransactionFormData,
} from '@/features/transactions/useTransactionFormData';
import { useLanguage } from '@/lib/i18n';

export default function EditTransactionScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useCallback(() => transactionsRepo.getDetail(id), [id]);
  const { data: transaction, error } = useLiveQuery(query);
  const { data } = useTransactionFormData();

  if (error && !transaction) {
    return (
      <View className="flex-1 bg-background px-5 pt-4">
        <Stack.Screen options={{ title: t('transactionForm.editTitle') }} />
        <EmptyState icon={SearchX} title={t('errors.domain.notFound')} />
      </View>
    );
  }
  if (!transaction || !data) return <View className="flex-1 bg-background" />;
  return <InitialForm key={transaction.id} transaction={transaction} data={data} />;
}

/** Form ilk yüklenen değerlerle kurulur; arka plandaki güncellemeler girilen metni ezmez. */
function InitialForm({
  transaction,
  data,
}: {
  transaction: TransactionDetail;
  data: TransactionFormData;
}) {
  const language = useLanguage();
  const [snapshot] = useState(() => ({
    values: transactionToFormValues(transaction, language),
    attachments: transaction.attachments,
  }));
  return (
    <TransactionForm
      mode="edit"
      transactionId={transaction.id}
      data={data}
      initialValues={snapshot.values}
      existingAttachments={snapshot.attachments}
    />
  );
}
