// Uygulamanın veri erişim noktası: `import { contactsRepo } from '@/db'`.
// Testler bu dosyayı değil, `@/db/repositories` içindeki fabrikaları kullanır (expo-sqlite Node'da çalışmaz).

import { db } from './client';
import { createRepositories } from './repositories';

export const {
  accountsRepo,
  attachmentsRepo,
  backupRepo,
  businessProfileRepo,
  contactsRepo,
  dataResetRepo,
  recurringPaymentsRepo,
  remindersRepo,
  reportsRepo,
  sampleDataRepo,
  subjectsRepo,
  transactionTypesRepo,
  transactionsRepo,
} = createRepositories(db);

export type * from './types';
