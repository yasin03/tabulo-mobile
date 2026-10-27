import { addDays, toIsoDate } from '@/core/dates';

import { accounts, contacts, subjects, transactions, transactionTypes } from '../schema';
import type { Db } from '../types';

export interface SampleDataOptions {
  contacts: number;
  transactions: number;
  /** Hareket tarihleri bugünden bu kadar gün geriye yayılır. */
  days?: number;
  /** Aynı tohum aynı veriyi üretir (testler için). */
  seed?: number;
}

const FIRST = [
  'Ahmet',
  'Ayşe',
  'Mehmet',
  'Fatma',
  'Mustafa',
  'Zeynep',
  'Emre',
  'Elif',
  'Can',
  'Selin',
];
const LAST = ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Aydın', 'Öztürk', 'Arslan'];
const CITIES = ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Konya'];

/** Küçük, tohumlanabilir rastgele sayı üreteci (mulberry32). */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Performans denemesi için örnek veri (Faz 10: 1.000+ cari, 10.000+ hareket). Yalnızca geliştirme
 * ekranından ve testlerden çağrılır; tek transaction'da toplu ekler.
 */
export function createSampleDataRepo(db: Db) {
  return {
    async insert(options: SampleDataOptions): Promise<void> {
      const rand = random(options.seed ?? 42);
      const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]!;
      const days = options.days ?? 730;
      const today = toIsoDate(new Date());

      db.transaction((tx) => {
        const accountIds = tx
          .select({ id: accounts.id })
          .from(accounts)
          .all()
          .map((r) => r.id);
        const typeRows = tx
          .select({ id: transactionTypes.id, direction: transactionTypes.direction })
          .from(transactionTypes)
          .all();
        const incomeTypes = typeRows.filter((r) => r.direction === 'income').map((r) => r.id);
        const expenseTypes = typeRows.filter((r) => r.direction === 'expense').map((r) => r.id);
        const subjectIds = tx
          .select({ id: subjects.id })
          .from(subjects)
          .all()
          .map((r) => r.id);
        if (accountIds.length === 0) return;

        const contactIds: string[] = [];
        for (let i = 0; i < options.contacts; i++) {
          const company = rand() < 0.3;
          const name = company
            ? `${pick(LAST)} ${pick(['Ticaret', 'Gıda', 'İnşaat', 'Tekstil'])} Ltd. Şti. ${i + 1}`
            : `${pick(FIRST)} ${pick(LAST)} ${i + 1}`;
          const [row] = tx
            .insert(contacts)
            .values({
              personType: company ? 'company' : 'individual',
              role: pick(['customer', 'customer', 'supplier', 'both'] as const),
              name,
              city: pick(CITIES),
              phone: `+90532${String(1_000_000 + i).slice(-7)}`,
            })
            .returning({ id: contacts.id })
            .all();
          contactIds.push(row!.id);
        }

        const BATCH = 500;
        let batch: (typeof transactions.$inferInsert)[] = [];
        for (let i = 0; i < options.transactions; i++) {
          const date = addDays(today, -Math.floor(rand() * days));
          const amountMinor = 100 * (10 + Math.floor(rand() * 20_000));
          const kind = rand();
          const contactId = contactIds.length > 0 ? pick(contactIds) : null;
          if (kind < 0.35) {
            batch.push({
              movementType: 'collection',
              accountId: pick(accountIds),
              contactId,
              transactionTypeId: incomeTypes.length ? pick(incomeTypes) : null,
              subjectId: subjectIds.length ? pick(subjectIds) : null,
              date,
              amountMinor,
            });
          } else if (kind < 0.65) {
            batch.push({
              movementType: 'payment',
              accountId: pick(accountIds),
              contactId: rand() < 0.5 ? contactId : null,
              transactionTypeId: expenseTypes.length ? pick(expenseTypes) : null,
              subjectId: subjectIds.length ? pick(subjectIds) : null,
              date,
              amountMinor,
            });
          } else if (contactId) {
            const sale = kind < 0.9;
            batch.push({
              movementType: sale ? 'credit_sale' : 'credit_purchase',
              contactId,
              date,
              dueDate: rand() < 0.6 ? addDays(date, 30) : null,
              amountMinor,
            });
          }
          if (batch.length >= BATCH) {
            tx.insert(transactions).values(batch).run();
            batch = [];
          }
        }
        if (batch.length > 0) tx.insert(transactions).values(batch).run();
      });
    },
  };
}
