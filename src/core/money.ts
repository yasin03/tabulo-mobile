// Tutar ayrıştırma ve biçimlendirme (PROMPT.md 6.1).
// Tutarlar her yerde kuruş cinsinden TAM SAYI'dır; burada float ile para hesabı yapılmaz.

import type { Language } from './i18n';

export const CURRENCIES = ['TRY', 'GBP', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = 'TRY';

/** Girilebilecek en büyük tutar (kuruş): 99.999.999.999,99. Toplamlar güvenli tam sayı aralığında kalır. */
export const MAX_AMOUNT_MINOR = 9_999_999_999_999;

export type AmountParseError =
  | 'empty' // Boş
  | 'invalid' // Sayı değil / ayraçlar hatalı
  | 'negative' // Eksi işaretli
  | 'tooManyDecimals' // 2'den fazla ondalık basamak
  | 'tooLarge'; // MAX_AMOUNT_MINOR'dan büyük

export type AmountParseResult =
  { ok: true; minor: number } | { ok: false; error: AmountParseError };

/** Dilin ondalık ve binlik ayracı. */
const SEPARATORS: Record<Language, { decimal: '.' | ','; group: '.' | ',' }> = {
  tr: { decimal: ',', group: '.' },
  en: { decimal: '.', group: ',' },
};

const STRIP_PATTERN = /[\s  ₺£$]/g;

/**
 * Kullanıcının yazdığı tutarı kuruşa çevirir.
 *
 * `25450,65`, `25.450,65`, `25450.65` ve `25,450.65` dört biçim de kabul edilir:
 * - İki ayraç birlikte varsa sondaki ondalık, diğeri binlik ayracıdır.
 * - Tek ayraç birden fazla kez geçiyorsa binlik ayracıdır.
 * - Tek ayraç bir kez geçiyorsa ve ardından tam 3 rakam geliyorsa belirsizdir; dile göre karar verilir
 *   (TR'de `25.450` = 25450, `25,450` = 3 ondalık → reddedilir).
 * - Aksi halde ondalık ayracıdır.
 */
export function parseAmount(input: string, language: Language): AmountParseResult {
  const s = input.replace(STRIP_PATTERN, '');
  if (s === '') return { ok: false, error: 'empty' };
  if (/^[-−]/.test(s)) return { ok: false, error: 'negative' };
  if (!/^[0-9.,]+$/.test(s) || !/[0-9]/.test(s)) return { ok: false, error: 'invalid' };

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let decimal: '.' | ',' | null = null;
  let group: '.' | ',' | null = null;

  if (lastDot >= 0 && lastComma >= 0) {
    decimal = lastDot > lastComma ? '.' : ',';
    group = decimal === '.' ? ',' : '.';
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ',';
    const index = Math.max(lastDot, lastComma);
    const occurrences = s.split(sep).length - 1;
    const digitsAfter = s.length - index - 1;
    if (occurrences > 1) group = sep;
    else if (digitsAfter === 3 && sep === SEPARATORS[language].group) group = sep;
    else decimal = sep;
  }

  let intPart = s;
  let fracPart = '';
  if (decimal) {
    const index = s.lastIndexOf(decimal);
    if (s.indexOf(decimal) !== index) return { ok: false, error: 'invalid' };
    intPart = s.slice(0, index);
    fracPart = s.slice(index + 1);
    if (!/^[0-9]*$/.test(fracPart)) return { ok: false, error: 'invalid' };
    if (fracPart.length > 2) return { ok: false, error: 'tooManyDecimals' };
  }

  if (group && intPart.includes(group)) {
    const groupPattern = new RegExp(`^[0-9]{1,3}(\\${group}[0-9]{3})+$`);
    if (!groupPattern.test(intPart)) return { ok: false, error: 'invalid' };
    intPart = intPart.split(group).join('');
  }
  if (!/^[0-9]*$/.test(intPart)) return { ok: false, error: 'invalid' };

  const intDigits = intPart.replace(/^0+/, '');
  if (intDigits.length > 11) return { ok: false, error: 'tooLarge' };

  const minor = Number(intDigits || '0') * 100 + Number(fracPart.padEnd(2, '0'));
  if (minor > MAX_AMOUNT_MINOR) return { ok: false, error: 'tooLarge' };
  return { ok: true, minor };
}

// ---------- Biçimlendirme ----------

export interface MoneyFormatOptions {
  currency: Currency;
  language: Language;
}

export const CURRENCY_SYMBOLS: Record<Currency, string> = { TRY: '₺', GBP: '£', USD: '$' };

/** Görüntüleme yereli. Para birimi İngilizcede İngiltere/ABD biçimini seçer. */
export function formatLocale(language: Language, currency: Currency): string {
  if (language === 'tr') return 'tr-TR';
  return currency === 'USD' ? 'en-US' : 'en-GB';
}

const formatterCache = new Map<string, Intl.NumberFormat>();

/** Her zaman 2 ondalık basamaklı sayı biçimleyici (para birimi simgesiz). */
function getFormatter(locale: string) {
  let formatter = formatterCache.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: true,
    });
    formatterCache.set(locale, formatter);
  }
  return formatter;
}

function assertMinor(minor: number) {
  if (!Number.isSafeInteger(minor)) {
    throw new RangeError(`Tutar kuruş cinsinden tam sayı olmalı: ${minor}`);
  }
}

/** Sayı ile simge arasındaki bölünmez boşluk: satır sonunda `₺` tek başına alta kaymaz. */
export const NBSP = '\u00A0';

/**
 * Tutarı işaretsiz, her zaman 2 ondalıkla biçimler. Negatifte mutlak değer kullanılır.
 * - Türkçe: simge sonda → `1.500,55 ₺`, `3.450,00 ₺`
 * - İngilizce: simge başta → `£25,450.65`, `$25,450.65`
 */
export function formatMoney(minor: number, options: MoneyFormatOptions): string {
  assertMinor(minor);
  const symbol = CURRENCY_SYMBOLS[options.currency];
  // Kuruştan ana birime çevirme yalnızca gösterim için; hesaplamada kullanılmaz.
  const number = getFormatter(formatLocale(options.language, options.currency)).format(
    Math.abs(minor) / 100,
  );
  return options.language === 'tr' ? `${number}${NBSP}${symbol}` : `${symbol}${number}`;
}

export const PLUS_SIGN = '+';
export const MINUS_SIGN = '\u2212'; // − (tire değil, eksi işareti)

/**
 * İşaretli gösterim (4.3): `+ 1.500,00 ₺` / `− 640,00 ₺`. Sıfırda işaret yoktur.
 * Renk körü kullanıcılar için işaret zorunludur; renk ayrıca bileşende verilir.
 */
export function formatSignedMoney(minor: number, options: MoneyFormatOptions): string {
  const formatted = formatMoney(minor, options);
  if (minor > 0) return `${PLUS_SIGN}${NBSP}${formatted}`;
  if (minor < 0) return `${MINUS_SIGN}${NBSP}${formatted}`;
  return formatted;
}

/** Düzenleme formunda tutar alanına yazılacak metin: binlik ayracı yok, dilin ondalık ayracı (`25450,65`). */
export function formatAmountForInput(minor: number, language: Language): string {
  assertMinor(minor);
  const abs = Math.abs(minor);
  const major = Math.floor(abs / 100);
  const cents = abs % 100;
  if (cents === 0) return String(major);
  return `${major}${SEPARATORS[language].decimal}${String(cents).padStart(2, '0')}`;
}

export function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && (CURRENCIES as readonly string[]).includes(value);
}

/** Cihazın para birimi kodlarından desteklenen ilkini seçer; yoksa TRY. */
export function pickCurrency(codes: readonly (string | null | undefined)[]): Currency {
  for (const code of codes) {
    const upper = code?.toUpperCase();
    if (isCurrency(upper)) return upper;
  }
  return DEFAULT_CURRENCY;
}

export type CompactUnit = 'none' | 'thousand' | 'million' | 'billion';

const COMPACT_STEPS: readonly [CompactUnit, number][] = [
  ['billion', 1e9],
  ['million', 1e6],
  ['thousand', 1e3],
];

const compactFormatterCache = new Map<string, Intl.NumberFormat>();

/**
 * Grafik ekseni için kısaltılmış tutar (yalnızca gösterim): `1.250.000,00` → `{ value: '1,3', unit: 'million' }`.
 * Birim adı ("B", "Mn" / "K", "M") çeviri dosyasından gelir. İşaret korunur.
 */
export function compactAmount(
  minor: number,
  options: MoneyFormatOptions,
): { value: string; unit: CompactUnit } {
  assertMinor(minor);
  const major = minor / 100;
  const [unit, divisor] = COMPACT_STEPS.find(([, step]) => Math.abs(major) >= step) ?? ['none', 1];
  const locale = formatLocale(options.language, options.currency);
  let formatter = compactFormatterCache.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 1, useGrouping: true });
    compactFormatterCache.set(locale, formatter);
  }
  return { value: formatter.format(major / divisor), unit };
}
