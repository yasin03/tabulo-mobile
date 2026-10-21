import type { Db } from '../types';
import { createAccountsRepo } from './accounts';
import { createAttachmentsRepo } from './attachments';
import { createBusinessProfileRepo } from './businessProfile';
import { createContactsRepo } from './contacts';
import { createSubjectsRepo, createTransactionTypesRepo } from './definitions';
import { createRecurringPaymentsRepo } from './recurringPayments';
import { createRemindersRepo } from './reminders';
import { createReportsRepo } from './reports';
import { createTransactionsRepo } from './transactions';

export * from './accounts';
export * from './attachments';
export * from './businessProfile';
export * from './contacts';
export * from './definitions';
export * from './recurringPayments';
export * from './reminders';
export * from './reports';
export * from './transactions';

/** Ekranlar veriye yalnızca bu repository'ler üzerinden erişir (PROMPT.md Bölüm 9). */
export function createRepositories(db: Db) {
  return {
    accountsRepo: createAccountsRepo(db),
    attachmentsRepo: createAttachmentsRepo(db),
    businessProfileRepo: createBusinessProfileRepo(db),
    contactsRepo: createContactsRepo(db),
    recurringPaymentsRepo: createRecurringPaymentsRepo(db),
    remindersRepo: createRemindersRepo(db),
    reportsRepo: createReportsRepo(db),
    subjectsRepo: createSubjectsRepo(db),
    transactionTypesRepo: createTransactionTypesRepo(db),
    transactionsRepo: createTransactionsRepo(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
