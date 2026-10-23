// Raporlar (7.9). Gelir = tahsilatlar, gider = ödemeler (şemadaki örnek rapor sorguları); devir rapora girmez.
// Dönem kırılımları (hafta/ay/yıl) src/core/periods.ts'de günlük toplamlardan hesaplanır.

import { asc, between, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';

import type { DateRange } from '@/core/dates';
import type { MovementType } from '@/core/ledger';
import type { DailyIncomeExpense } from '@/core/periods';

import { liveTransactions, sumOrZero } from '../ledgerSql';
import { accounts, subjects, transactions, transactionTypes, type ACCOUNT_TYPES } from '../schema';
import type { Db } from '../types';

export interface PeriodSummary {
  /** Tahsilatlar. */
  incomeMinor: number;
  /** Ödemeler. */
  expenseMinor: number;
  /** Gelir − gider. */
  netMinor: number;
  creditSalesMinor: number;
  creditPurchasesMinor: number;
  /** Dönemdeki hareket sayısı (devir dahil). */
  transactionCount: number;
}

/** İşlem türü veya konuya göre gider toplamı. `id` boşsa tür/konu seçilmemiş hareketlerdir. */
export interface CategoryTotal {
  id: string | null;
  name: string | null;
  totalMinor: number;
  count: number;
}

/** Kasa veya banka hesaplarının dönem içi para hareketi (tüm hesaplar türüne göre toplanır). */
export interface AccountTypeFlow {
  type: (typeof ACCOUNT_TYPES)[number];
  /** Tahsilatlar. */
  inMinor: number;
  /** Ödemeler. */
  outMinor: number;
  /** Giriş − çıkış. */
  netMinor: number;
}

const t = transactions;

function inRange(range: DateRange, ...conditions: (SQL | undefined)[]) {
  return liveTransactions(between(t.date, range.from, range.to), ...conditions);
}

const amountOf = (type: MovementType) =>
  sumOrZero(sql<number>`CASE WHEN ${t.movementType} = ${type} THEN ${t.amountMinor} ELSE 0 END`);

export function createReportsRepo(db: Db) {
  /** Tahsilat veya ödemelerin işlem türüne göre toplamı ve adedi. */
  function totalsByType(range: DateRange, movementType: 'collection' | 'payment') {
    const totalMinor = sumOrZero(sql<number>`${t.amountMinor}`);
    return db
      .select({
        id: t.transactionTypeId,
        name: transactionTypes.name,
        totalMinor,
        count: sql<number>`COUNT(*)`.mapWith(Number),
      })
      .from(t)
      .leftJoin(transactionTypes, eq(transactionTypes.id, t.transactionTypeId))
      .where(inRange(range, eq(t.movementType, movementType)))
      .groupBy(t.transactionTypeId, transactionTypes.name)
      .orderBy(desc(totalMinor), asc(transactionTypes.name))
      .all();
  }

  return {
    /** Dönem özet kartları. */
    async summary(range: DateRange): Promise<PeriodSummary> {
      const row = db
        .select({
          incomeMinor: amountOf('collection'),
          expenseMinor: amountOf('payment'),
          creditSalesMinor: amountOf('credit_sale'),
          creditPurchasesMinor: amountOf('credit_purchase'),
          transactionCount: sql<number>`COUNT(*)`.mapWith(Number),
        })
        .from(t)
        .where(inRange(range))
        .all()[0];
      const summary = row ?? {
        incomeMinor: 0,
        expenseMinor: 0,
        creditSalesMinor: 0,
        creditPurchasesMinor: 0,
        transactionCount: 0,
      };
      return { ...summary, netMinor: summary.incomeMinor - summary.expenseMinor };
    },

    /** Gün gün gelir ve gider (yalnızca hareket olan günler, tarih sırasında). */
    async dailyIncomeExpense(range: DateRange): Promise<DailyIncomeExpense[]> {
      return db
        .select({
          date: t.date,
          incomeMinor: amountOf('collection'),
          expenseMinor: amountOf('payment'),
        })
        .from(t)
        .where(inRange(range, inArray(t.movementType, ['collection', 'payment'])))
        .groupBy(t.date)
        .orderBy(asc(t.date))
        .all();
    },

    /** İşlem türüne göre gider dağılımı (büyükten küçüğe). */
    async expensesByType(range: DateRange): Promise<CategoryTotal[]> {
      return totalsByType(range, 'payment');
    },

    /** İşlem türüne göre gelir (tahsilat) dağılımı (büyükten küçüğe). */
    async incomeByType(range: DateRange): Promise<CategoryTotal[]> {
      return totalsByType(range, 'collection');
    },

    /**
     * Kasa ve banka hesaplarının dönem içi girişi, çıkışı ve neti (hesap türüne göre; pasif hesaplar dahil).
     * Hareketi olmayan tür de sıfırla gelir: önce kasa, sonra banka.
     */
    async cashFlowByAccountType(range: DateRange): Promise<AccountTypeFlow[]> {
      const rows = db
        .select({
          type: accounts.type,
          inMinor: amountOf('collection'),
          outMinor: amountOf('payment'),
        })
        .from(t)
        .innerJoin(accounts, eq(accounts.id, t.accountId))
        .where(inRange(range))
        .groupBy(accounts.type)
        .all();
      return (['cash', 'bank'] as const).map((type) => {
        const row = rows.find((r) => r.type === type);
        const inMinor = row?.inMinor ?? 0;
        const outMinor = row?.outMinor ?? 0;
        return { type, inMinor, outMinor, netMinor: inMinor - outMinor };
      });
    },

    /** Konuya göre gider dağılımı ("Araç için ne harcadım?"). */
    async expensesBySubject(range: DateRange): Promise<CategoryTotal[]> {
      const totalMinor = sumOrZero(sql<number>`${t.amountMinor}`);
      return db
        .select({
          id: t.subjectId,
          name: subjects.name,
          totalMinor,
          count: sql<number>`COUNT(*)`.mapWith(Number),
        })
        .from(t)
        .leftJoin(subjects, eq(subjects.id, t.subjectId))
        .where(inRange(range, eq(t.movementType, 'payment')))
        .groupBy(t.subjectId, subjects.name)
        .orderBy(desc(totalMinor), asc(subjects.name))
        .all();
    },
  };
}

export type ReportsRepo = ReturnType<typeof createReportsRepo>;
