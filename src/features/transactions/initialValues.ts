import { toIsoDate } from '@/core/dates';
import { emptyTransactionForm, type TransactionFormValues } from '@/core/forms/transaction';
import type { MovementType } from '@/core/ledger';
import { loadTransactionDraft } from '@/stores/transactionDraft';

import type { TransactionFormData } from './useTransactionFormData';

/**
 * Yeni hareketin akıllı varsayılanları (6.4): bugünün tarihi, son kullanılan hesap (yoksa ilk aktif hesap),
 * "Genel" konusu, cari detayından açıldıysa o cari.
 */
export function newTransactionDefaults(
  data: TransactionFormData,
  movementType: MovementType,
  options: { lastAccountId: string | null; presetContactId?: string },
): TransactionFormValues {
  const activeAccounts = data.accounts.filter((a) => a.status === 'active');
  const account =
    activeAccounts.find((a) => a.id === options.lastAccountId) ?? activeAccounts[0] ?? null;
  const contact = data.contacts.find(
    (c) => c.id === options.presetContactId && c.status === 'active',
  );
  return {
    ...emptyTransactionForm(movementType, toIsoDate()),
    accountId: account?.id ?? '',
    subjectId: data.defaultSubject?.id ?? '',
    contactId: contact?.id ?? '',
  };
}

/**
 * Yarım kalan taslak bu açılışa uyuyorsa döner: aynı hareket tipi ve (cari detayından açıldıysa) aynı cari.
 * Başka bir tip seçildiyse taslak dokunulmadan bekler.
 */
export function matchingDraft(
  movementType: MovementType,
  presetContactId: string | undefined,
): TransactionFormValues | null {
  const draft = loadTransactionDraft();
  if (!draft || draft.movementType !== movementType) return null;
  if (presetContactId && draft.contactId !== presetContactId) return null;
  return draft;
}
