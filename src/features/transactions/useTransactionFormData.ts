import { useCallback } from 'react';

import { accountsRepo, contactsRepo, subjectsRepo, transactionTypesRepo } from '@/db';
import { useLiveQuery } from '@/db/useLiveQuery';
import { useLanguage } from '@/lib/i18n';

/**
 * Hareket formunun seçim listeleri. Pasif kayıtlar da gelir: düzenlenen eski hareketin pasif carisi/hesabı
 * görünmeye devam etmeli; yeni seçimde form yalnızca aktifleri listeler (6.2).
 */
export function useTransactionFormData() {
  const language = useLanguage();
  const query = useCallback(async () => {
    const [accounts, contacts, transactionTypes, subjects, defaultSubject] = await Promise.all([
      accountsRepo.list({ includePassive: true }),
      contactsRepo.list({ status: 'all', sort: 'name', locale: language === 'tr' ? 'tr' : 'en' }),
      transactionTypesRepo.list({ includePassive: true }),
      subjectsRepo.list({ includePassive: true }),
      subjectsRepo.findDefault(),
    ]);
    return { accounts, contacts, transactionTypes, subjects, defaultSubject };
  }, [language]);
  return useLiveQuery(query);
}

export type TransactionFormData = NonNullable<ReturnType<typeof useTransactionFormData>['data']>;
