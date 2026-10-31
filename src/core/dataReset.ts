// Verileri silme (Ayarlar → Veriler): kullanıcı hangi veri gruplarının silineceğini seçer.
// Hareketler carilere, hesaplara ve tanımlara bağlıdır (yabancı anahtar); bunlardan biri seçilirse hareketler
// de silinir. Silinen hesaplar / tanımlar yerine varsayılanlar (Kasa + Banka, hazır türler) yeniden eklenir.

export const DATA_CATEGORIES = [
  'transactions',
  'contacts',
  'definitions',
  'accounts',
  'settings',
] as const;
export type DataCategory = (typeof DATA_CATEGORIES)[number];

/** Silinmeleri için önce hareketlerin silinmesi gereken gruplar. */
const NEEDS_TRANSACTIONS: readonly DataCategory[] = ['contacts', 'definitions', 'accounts'];

export interface DataSelection {
  /** Gerçekte silinecek gruplar (`DATA_CATEGORIES` sırasında). */
  categories: DataCategory[];
  /** Hareketler kullanıcı seçmeden, başka bir seçim yüzünden siliniyor mu? */
  transactionsForced: boolean;
}

export function resolveDataSelection(selected: Iterable<DataCategory>): DataSelection {
  const chosen = new Set(selected);
  const transactionsForced = NEEDS_TRANSACTIONS.some((category) => chosen.has(category));
  if (transactionsForced) chosen.add('transactions');
  return {
    categories: DATA_CATEGORIES.filter((category) => chosen.has(category)),
    transactionsForced,
  };
}

/**
 * Yazarak onay ("Verileri Sil"): baştaki/sondaki ve çoklu boşluklar, büyük/küçük harf önemsizdir
 * (Türkçe kurallarıyla: "verileri sil" ve "VERİLERİ SİL" de kabul edilir).
 */
export function matchesConfirmPhrase(input: string, phrase: string, locale: string): boolean {
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase(locale);
  return normalize(input) !== '' && normalize(input) === normalize(phrase);
}
