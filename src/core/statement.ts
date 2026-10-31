// Cari hesap ekstresi (PROMPT.md 10.1). İşletme defteri bakış açısı (kullanıcı kararı, Faz 7):
// Borç = carinin borçlandığı (veresiye satış, cariye ödeme, alacak devri), Alacak = tahsilat, veresiye alış, borç devri.
// Bakiye işaretsiz yazılır, yanında (B) / (A): (B) cari bize borçlu, (A) biz cariye borçluyuz.

import type { DateRange } from './dates';
import { contactDelta, type LedgerMovement } from './ledger';

/** Ekstre aralığı. Sınır verilmezse o yönde sınırsızdır ("Tümü"). */
export interface StatementRange {
  from?: string;
  to?: string;
}

export type StatementMovement = LedgerMovement & { id: string; date: string };

export type StatementRow<T extends StatementMovement> = T & {
  /** Borç sütunu (kuruş, ≥ 0). */
  debitMinor: number;
  /** Alacak sütunu (kuruş, ≥ 0). */
  creditMinor: number;
  /** Bu satır dahil yürüyen bakiye; + cari bize borçlu. */
  balanceMinor: number;
};

export interface Statement<T extends StatementMovement> {
  /** Aralıktan önceki hareketlerin bakiyesi ("Devreden bakiye"). */
  openingBalanceMinor: number;
  rows: StatementRow<T>[];
  totalDebitMinor: number;
  totalCreditMinor: number;
  closingBalanceMinor: number;
}

/** Bakiyenin yanındaki ek: `debit` (B), `credit` (A); sıfırda ek yok. */
export type BalanceSide = 'debit' | 'credit' | null;

export function balanceSide(balanceMinor: number): BalanceSide {
  if (balanceMinor > 0) return 'debit';
  if (balanceMinor < 0) return 'credit';
  return null;
}

/**
 * Hareketler kronolojik sırada (eskiden yeniye) verilmelidir.
 * Aralıktan önceki hareketler devreden bakiyeye, sonrakiler hiçbir yere girmez.
 * Peşin tahsilat/ödeme borç/alacak oluşturmadığı için ekstreye girmez (kullanıcı kararı).
 */
export function buildStatement<T extends StatementMovement>(
  chronological: readonly T[],
  range: StatementRange = {},
): Statement<T> {
  let openingBalanceMinor = 0;
  let running = 0;
  let totalDebitMinor = 0;
  let totalCreditMinor = 0;
  const rows: StatementRow<T>[] = [];

  for (const m of chronological) {
    if (m.isCash) continue;
    if (range.to && m.date > range.to) continue;
    const delta = contactDelta(m);
    if (range.from && m.date < range.from) {
      openingBalanceMinor += delta;
      continue;
    }
    if (rows.length === 0) running = openingBalanceMinor;
    running += delta;
    const debitMinor = delta > 0 ? delta : 0;
    const creditMinor = delta < 0 ? -delta : 0;
    totalDebitMinor += debitMinor;
    totalCreditMinor += creditMinor;
    rows.push({ ...m, debitMinor, creditMinor, balanceMinor: running });
  }

  return {
    openingBalanceMinor,
    rows,
    totalDebitMinor,
    totalCreditMinor,
    closingBalanceMinor: openingBalanceMinor + totalDebitMinor - totalCreditMinor,
  };
}

/**
 * Başlıkta gösterilecek tarih aralığı. Sınırsız başlangıçta ilk hareketin, sınırsız bitişte bugünün tarihi.
 * Hiç hareket yoksa başlangıç da bugündür.
 */
export function statementPeriod(
  chronological: readonly { date: string }[],
  range: StatementRange,
  today: string,
): DateRange {
  const to = range.to ?? today;
  const from = range.from ?? chronological[0]?.date ?? to;
  return { from: from <= to ? from : to, to };
}
