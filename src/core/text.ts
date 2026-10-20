// Metin yardımcıları: Türkçe duyarlı arama, sıralama ve baş harfler.

const FOLD_MAP: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
};

/**
 * Arama için katlama: büyük/küçük harf ve Türkçe karakter farkı yok sayılır.
 * `Şahin` / `ŞAHİN` / `sahin` → `sahin`; `IŞIK` → `isik`.
 */
export function foldForSearch(value: string): string {
  return value
    .replace(/I/g, 'ı')
    .replace(/İ/g, 'i')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[çğıöşü]/g, (c) => FOLD_MAP[c] ?? c)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Aranan ifadenin tüm kelimeleri (sırası fark etmeksizin) metinlerden birinde geçiyor mu? */
export function matchesSearch(
  query: string,
  ...haystacks: readonly (string | null | undefined)[]
): boolean {
  const terms = foldForSearch(query).split(' ').filter(Boolean);
  if (terms.length === 0) return true;
  const text = foldForSearch(haystacks.filter(Boolean).join(' '));
  return terms.every((term) => text.includes(term));
}

/** Avatar baş harfleri: `Ahmet Yılmaz` → `AY`, `demir` → `D`, `İsmail Işık` → `İI`. */
export function initials(name: string, locale = 'tr'): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toLocaleUpperCase(locale);
}
