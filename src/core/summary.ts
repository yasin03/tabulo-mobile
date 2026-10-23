// Dışa aktarılan hareketlerin özeti (Excel "Dönem özeti", 10.2). Tanımlar raporlarla aynıdır (Faz 6):
// gelir = tahsilat, gider = ödeme, devir sayılır ama tutarı özete girmez; gider dağılımları yalnızca ödemelerden.

import type { MovementType } from './ledger';

export interface SummaryMovement {
  movementType: MovementType;
  amountMinor: number;
  transactionTypeId: string | null;
  transactionTypeName: string | null;
  subjectId: string | null;
  subjectName: string | null;
}

export interface CategorySum {
  /** `null`: tür/konu seçilmemiş hareketler. */
  id: string | null;
  name: string | null;
  totalMinor: number;
  count: number;
}

export interface MovementSummary {
  count: number;
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
  creditSalesMinor: number;
  creditPurchasesMinor: number;
  expensesByType: CategorySum[];
  expensesBySubject: CategorySum[];
}

function addTo(
  map: Map<string | null, CategorySum>,
  id: string | null,
  name: string | null,
  amount: number,
) {
  const entry = map.get(id) ?? { id, name, totalMinor: 0, count: 0 };
  entry.totalMinor += amount;
  entry.count += 1;
  map.set(id, entry);
}

const byTotal = (locale: string) => {
  const collator = new Intl.Collator(locale, { sensitivity: 'base' });
  return (a: CategorySum, b: CategorySum) =>
    b.totalMinor - a.totalMinor || collator.compare(a.name ?? '', b.name ?? '');
};

export function summarizeMovements(
  rows: readonly SummaryMovement[],
  locale = 'tr',
): MovementSummary {
  const totals: Record<MovementType, number> = {
    collection: 0,
    payment: 0,
    credit_sale: 0,
    credit_purchase: 0,
    opening: 0,
  };
  const types = new Map<string | null, CategorySum>();
  const subjects = new Map<string | null, CategorySum>();

  for (const row of rows) {
    totals[row.movementType] += row.amountMinor;
    if (row.movementType !== 'payment') continue;
    addTo(types, row.transactionTypeId, row.transactionTypeName, row.amountMinor);
    addTo(subjects, row.subjectId, row.subjectName, row.amountMinor);
  }

  const sort = byTotal(locale);
  return {
    count: rows.length,
    incomeMinor: totals.collection,
    expenseMinor: totals.payment,
    netMinor: totals.collection - totals.payment,
    creditSalesMinor: totals.credit_sale,
    creditPurchasesMinor: totals.credit_purchase,
    expensesByType: [...types.values()].sort(sort),
    expensesBySubject: [...subjects.values()].sort(sort),
  };
}
