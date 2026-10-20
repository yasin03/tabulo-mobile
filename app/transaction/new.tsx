import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { MOVEMENT_TYPES } from '@/db/schema';
import type { MovementType } from '@/core/ledger';
import { matchingDraft, newTransactionDefaults } from '@/features/transactions/initialValues';
import { TransactionForm } from '@/features/transactions/TransactionForm';
import {
  useTransactionFormData,
  type TransactionFormData,
} from '@/features/transactions/useTransactionFormData';
import { usePreferences } from '@/stores/preferences';

function isMovementType(value: unknown): value is MovementType {
  return (MOVEMENT_TYPES as readonly unknown[]).includes(value);
}

/** Yeni hareket (modal). Parametreler: `type` (hareket tipi), `contactId` (cari detayından açıldıysa). */
export default function NewTransactionScreen() {
  const params = useLocalSearchParams<{ type?: string; contactId?: string }>();
  const movementType: MovementType = isMovementType(params.type) ? params.type : 'collection';
  const presetContactId = params.contactId || undefined;
  const { data } = useTransactionFormData();
  // Taslak yalnızca açılışta bir kez okunur.
  const [draft] = useState(() => matchingDraft(movementType, presetContactId));

  if (!data) return <View className="flex-1 bg-background" />;

  // Varsayılanlar ilk veriyle bir kez kurulur; sonraki canlı güncellemeler girilen değerleri ezmez.
  return (
    <InitialForm
      data={data}
      movementType={movementType}
      presetContactId={presetContactId}
      draft={draft}
    />
  );
}

function InitialForm({
  data,
  movementType,
  presetContactId,
  draft,
}: {
  data: TransactionFormData;
  movementType: MovementType;
  presetContactId?: string;
  draft: ReturnType<typeof matchingDraft>;
}) {
  const [initialValues] = useState(() =>
    newTransactionDefaults(data, movementType, {
      lastAccountId: usePreferences.getState().lastAccountId,
      presetContactId,
    }),
  );
  return (
    <TransactionForm
      mode="new"
      data={data}
      initialValues={initialValues}
      restoredDraft={draft}
      presetContactId={presetContactId}
    />
  );
}
