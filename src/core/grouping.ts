// Listelerde aya göre gruplama (cari detayı, tüm hareketler). FlashList'e tek düz dizi olarak verilir.

import { monthKey } from './dates';

export type MonthListItem<T> =
  | { kind: 'month'; key: string; month: string }
  | { kind: 'row'; key: string; item: T; isFirst: boolean; isLast: boolean };

/**
 * Tarihe göre sıralı kayıtları ay başlıklarıyla düz listeye çevirir.
 * `isFirst` / `isLast`, kart görünümünde köşe yuvarlaklığı için ay içindeki konumdur.
 */
export function groupByMonth<T extends { id: string; date: string }>(
  items: readonly T[],
): MonthListItem<T>[] {
  const result: MonthListItem<T>[] = [];
  items.forEach((item, index) => {
    const month = monthKey(item.date);
    const previous = items[index - 1];
    const next = items[index + 1];
    const isFirst = !previous || monthKey(previous.date) !== month;
    const isLast = !next || monthKey(next.date) !== month;
    if (isFirst) result.push({ kind: 'month', key: `month-${month}`, month });
    result.push({ kind: 'row', key: item.id, item, isFirst, isLast });
  });
  return result;
}
