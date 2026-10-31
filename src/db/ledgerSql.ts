// MOVEMENT_EFFECT'ten üretilen SQL ifadeleri. Bakiyeler saklanmaz, her sorguda bunlarla hesaplanır (5.1).
// src/core/ledger.ts'deki contactEffect / accountEffect ile birebir aynı sonucu verir (testlerle doğrulanır).

import { and, isNull, sql, type SQL } from 'drizzle-orm';

import { MOVEMENT_EFFECT, MOVEMENT_TYPES, transactions } from './schema';

/** Hareketin cari bakiyesine kuruş cinsinden etkisi (+ cari bize borçlu). Peşin hareketin etkisi yok. */
export function contactDeltaSql(): SQL<number> {
  const cases = MOVEMENT_TYPES.map((type) => {
    const effect = MOVEMENT_EFFECT[type].contact;
    if (type === 'opening') {
      // Devir: yönü openingDirection belirler (payable ise ters).
      return sql`WHEN ${type} THEN CASE ${transactions.openingDirection} WHEN 'payable' THEN ${sql.raw(String(-effect))} ELSE ${sql.raw(String(effect))} END`;
    }
    return sql`WHEN ${type} THEN ${sql.raw(String(effect))}`;
  });
  return sql<number>`(CASE WHEN ${transactions.isCash} = 1 THEN 0 ELSE CASE ${transactions.movementType} ${sql.join(cases, sql` `)} ELSE 0 END END) * ${transactions.amountMinor}`;
}

/** Hareketin kasa/banka bakiyesine kuruş cinsinden etkisi (+ para girişi). */
export function accountDeltaSql(): SQL<number> {
  const cases = MOVEMENT_TYPES.map(
    (type) => sql`WHEN ${type} THEN ${sql.raw(String(MOVEMENT_EFFECT[type].account))}`,
  );
  return sql<number>`(CASE ${transactions.movementType} ${sql.join(cases, sql` `)} ELSE 0 END) * ${transactions.amountMinor}`;
}

/** SUM(...) boş kümede NULL döner; 0'a çevirip sayı olarak eşler. */
export function sumOrZero(expression: SQL<number>): SQL<number> {
  return sql<number>`COALESCE(SUM(${expression}), 0)`.mapWith(Number);
}

/** Silinmemiş hareketler (+ ek koşullar). */
export function liveTransactions(...conditions: (SQL | undefined)[]) {
  return and(isNull(transactions.deletedAt), ...conditions);
}
