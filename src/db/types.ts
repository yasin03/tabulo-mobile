import type { SQLiteAsyncDatabase, SQLiteAsyncTransaction } from 'drizzle-orm/sqlite-core';

import type * as schema from './schema';

/**
 * Repository'lerin beklediği veritabanı tipi. Uygulamada expo-sqlite, testlerde node:sqlite sürücüsü
 * verilir; ikisi de senkron ('sync') çalışır. Bu yüzden transaction gövdeleri senkron yazılır
 * (`.run()`, `.all()`).
 *
 * `.get()` KULLANMA: Drizzle'ın expo-sqlite sürücüsü `.get()`te ifadeyi ilk satırda bırakıp sıfırlamıyor;
 * bağlantıda "devam eden" ifade kalınca sonraki COMMIT "SQL statements in progress" ile başarısız olur.
 * Tek satır için `.all()[0]` (seçimde gerekiyorsa `.limit(1)`). ESLint bunu src/db'de engeller.
 */
export type Db = SQLiteAsyncDatabase<'sync', any>;
export type Tx = SQLiteAsyncTransaction<'sync', any, any>;
export type DbOrTx = Db | Tx;

export type Status = (typeof schema.STATUS)[number];

export type BusinessProfile = typeof schema.businessProfile.$inferSelect;
export type Contact = typeof schema.contacts.$inferSelect;
export type Account = typeof schema.accounts.$inferSelect;
export type TransactionType = typeof schema.transactionTypes.$inferSelect;
export type Subject = typeof schema.subjects.$inferSelect;
export type Transaction = typeof schema.transactions.$inferSelect;
export type Attachment = typeof schema.attachments.$inferSelect;
export type RecurringPayment = typeof schema.recurringPayments.$inferSelect;
export type Reminder = typeof schema.reminders.$inferSelect;
export type ReminderStatus = (typeof schema.REMINDER_STATUSES)[number];
