// Yarım kalan hareket girişi (8.1): uygulama arka plana atılsa veya kapansa da kaybolmaz.
// Yalnızca yeni hareket formunda tutulur; kayıtta veya bilinçli "Çık" seçiminde silinir.
// Belgeler taslağa girmez (geçici klasördeki dosyalar sistem tarafından silinebilir).

import { MOVEMENT_TYPES } from '@/db/schema';
import type { TransactionFormValues } from '@/core/forms/transaction';
import { storage } from '@/lib/storage';

const KEY = 'transaction-draft';

export function loadTransactionDraft(): TransactionFormValues | null {
  const raw = storage.getString(KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as TransactionFormValues;
    if (!(MOVEMENT_TYPES as readonly string[]).includes(value.movementType)) return null;
    return value;
  } catch {
    return null;
  }
}

export function saveTransactionDraft(values: TransactionFormValues) {
  storage.set(KEY, JSON.stringify(values));
}

export function clearTransactionDraft() {
  storage.remove(KEY);
}
