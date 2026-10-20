// Listelerde "Yukarı taşı / Aşağı taşı" (hesaplar, işlem türleri, konular). Sürükle-bırak yerine
// erişilebilir düğmeler; sonuç repository'nin `reorder` fonksiyonuna verilir.

/** `id`'yi `delta` kadar kaydırılmış yeni sıra; sınırdaysa `null`. */
export function moveId(ids: readonly string[], id: string, delta: -1 | 1): string[] | null {
  const index = ids.indexOf(id);
  const target = index + delta;
  if (index === -1 || target < 0 || target >= ids.length) return null;
  const next = [...ids];
  next[index] = ids[target]!;
  next[target] = id;
  return next;
}
