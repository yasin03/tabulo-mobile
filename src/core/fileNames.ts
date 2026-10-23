// Dışa aktarılan dosyaların adları (10.1: `Ekstre_<CariAdi>_<YYYY-AA-GG>.pdf`).
// Ad ASCII'ye indirgenir: bazı Android uygulamaları ve e-posta istemcileri Türkçe harfli dosya adlarını bozuyor.

const TURKISH_ASCII: Record<string, string> = {
  ç: 'c',
  Ç: 'C',
  ğ: 'g',
  Ğ: 'G',
  ı: 'i',
  İ: 'I',
  ö: 'o',
  Ö: 'O',
  ş: 's',
  Ş: 'S',
  ü: 'u',
  Ü: 'U',
};

const MAX_PART_LENGTH = 60;

/** Dosya adına girecek parça: Türkçe harfler ASCII, boşluklar `_`, diğer işaretler atılır. */
export function fileNamePart(value: string): string {
  return value
    .replace(/[çÇğĞıİöÖşŞüÜ]/g, (ch) => TURKISH_ASCII[ch] ?? ch)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX_PART_LENGTH)
    .replace(/_+$/, '');
}

/** `Ekstre` + `Ahmet Yılmaz` + `2026-10-21` + `pdf` → `Ekstre_Ahmet_Yilmaz_2026-10-21.pdf`. Boş parçalar atlanır. */
export function exportFileName(parts: readonly string[], extension: 'pdf' | 'xlsx'): string {
  const name = parts
    .map((part) => (/^\d{4}-\d{2}-\d{2}$/.test(part) ? part : fileNamePart(part)))
    .filter(Boolean)
    .join('_');
  return `${name || 'Tabulo'}.${extension}`;
}
