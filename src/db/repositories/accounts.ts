// Hesaplar (Kasa / Banka). Bakiye saklanmaz: açılış bakiyesi + hareketlerden hesaplanır (5.1).

import { and, asc, eq, isNull, lte, max, sql, type SQL } from 'drizzle-orm';

import { DomainError } from '@/core/errors';
import type { Currency } from '@/core/money';

import { accountDeltaSql, liveTransactions, sumOrZero } from '../ledgerSql';
import { accounts, type ACCOUNT_TYPES, transactions } from '../schema';
import type { Account, Db, Status } from '../types';
import { definedOnly, emptyToNull, requireName, requireRow } from './shared';

export type AccountType = (typeof ACCOUNT_TYPES)[number];
export type AccountWithBalance = Account & { balanceMinor: number };

export interface AccountInput {
  name: string;
  type: AccountType;
  bankName?: string | null;
  iban?: string | null;
  openingBalanceMinor?: number;
  currency?: Currency;
}

export function createAccountsRepo(db: Db) {
  const a = accounts;
  const live = (...conditions: (SQL | undefined)[]) => and(isNull(a.deletedAt), ...conditions);

  /**
   * Hesap başına hareket etkisi toplamı; hesaplara LEFT JOIN ile bağlanır.
   * (İlişkili alt sorgu kullanılmaz: Drizzle tek tablolu sorguda sütunları tablo adı olmadan yazar.)
   */
  function withBalance(asOf?: string) {
    const stats = db
      .select({
        accountId: transactions.accountId,
        delta: sumOrZero(accountDeltaSql()).as('delta'),
      })
      .from(transactions)
      .where(liveTransactions(asOf ? lte(transactions.date, asOf) : undefined))
      .groupBy(transactions.accountId)
      .as('account_stats');
    const balanceMinor =
      sql<number>`${a.openingBalanceMinor} + COALESCE(${stats.delta}, 0)`.mapWith(Number);
    return db
      .select({ account: a, balanceMinor })
      .from(a)
      .leftJoin(stats, eq(stats.accountId, a.id));
  }

  function getSync(id: string): Account {
    return requireRow(
      db
        .select()
        .from(a)
        .where(live(eq(a.id, id)))
        .all()[0],
    );
  }

  function assertOpeningBalance(value: number | undefined) {
    if (value !== undefined && !Number.isSafeInteger(value)) {
      throw new RangeError('Açılış bakiyesi kuruş cinsinden tam sayı olmalı');
    }
  }

  return {
    /** Varsayılan: yalnızca aktif hesaplar. */
    async list(options?: { includePassive?: boolean }): Promise<Account[]> {
      return db
        .select()
        .from(a)
        .where(live(options?.includePassive ? undefined : eq(a.status, 'active')))
        .orderBy(asc(a.sortOrder), asc(a.name))
        .all();
    },

    /** `asOf` verilirse o günün sonundaki bakiye (raporlar: dönem sonu). */
    async listWithBalances(options?: {
      includePassive?: boolean;
      asOf?: string;
    }): Promise<AccountWithBalance[]> {
      return withBalance(options?.asOf)
        .where(live(options?.includePassive ? undefined : eq(a.status, 'active')))
        .orderBy(asc(a.sortOrder), asc(a.name))
        .all()
        .map((row) => ({ ...row.account, balanceMinor: row.balanceMinor }));
    },

    async getById(id: string): Promise<Account> {
      return getSync(id);
    },

    async balance(id: string): Promise<number> {
      return requireRow(
        withBalance()
          .where(live(eq(a.id, id)))
          .all()[0],
      ).balanceMinor;
    },

    async create(input: AccountInput): Promise<string> {
      const name = requireName(input.name);
      assertOpeningBalance(input.openingBalanceMinor);
      return db.transaction((tx) => {
        const last = tx
          .select({ value: max(a.sortOrder) })
          .from(a)
          .where(live())
          .all()[0];
        return tx
          .insert(a)
          .values({
            name,
            type: input.type,
            bankName: emptyToNull(input.bankName),
            iban: emptyToNull(input.iban),
            openingBalanceMinor: input.openingBalanceMinor ?? 0,
            currency: input.currency,
            sortOrder: (last?.value ?? -1) + 1,
          })
          .returning({ id: a.id })
          .all()[0]!.id;
      });
    },

    async update(id: string, patch: Partial<AccountInput>): Promise<void> {
      getSync(id);
      assertOpeningBalance(patch.openingBalanceMinor);
      db.update(a)
        .set(
          definedOnly({
            ...patch,
            name: patch.name === undefined ? undefined : requireName(patch.name),
            bankName: emptyToNull(patch.bankName),
            iban: emptyToNull(patch.iban),
          }),
        )
        .where(eq(a.id, id))
        .run();
    },

    async setStatus(id: string, status: Status): Promise<void> {
      getSync(id);
      db.update(a).set({ status }).where(eq(a.id, id)).run();
    },

    async reorder(orderedIds: readonly string[]): Promise<void> {
      db.transaction((tx) => {
        orderedIds.forEach((id, index) => {
          tx.update(a).set({ sortOrder: index }).where(eq(a.id, id)).run();
        });
      });
    },

    /** Hareketi olan hesap silinemez; yalnızca pasife alınır. */
    async softDelete(id: string): Promise<void> {
      getSync(id);
      const used = db
        .select({ id: transactions.id })
        .from(transactions)
        .where(liveTransactions(eq(transactions.accountId, id)))
        .limit(1)
        .all()[0];
      if (used) throw new DomainError('accountHasTransactions');
      db.update(a).set({ deletedAt: new Date() }).where(eq(a.id, id)).run();
    },

    async restore(id: string): Promise<void> {
      db.update(a).set({ deletedAt: null }).where(eq(a.id, id)).run();
    },

    async countActive(): Promise<Record<AccountType, number>> {
      const rows = db
        .select({ type: a.type, count: sql<number>`COUNT(*)`.mapWith(Number) })
        .from(a)
        .where(live(eq(a.status, 'active')))
        .groupBy(a.type)
        .all();
      const counts: Record<AccountType, number> = { cash: 0, bank: 0 };
      for (const row of rows) counts[row.type] = row.count;
      return counts;
    },
  };
}

export type AccountsRepo = ReturnType<typeof createAccountsRepo>;
