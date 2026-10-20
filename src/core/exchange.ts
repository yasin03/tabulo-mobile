// Para birimi değişince tutarların dönüştürülmesi (kullanıcı kararı, Faz 4):
// tüm tutarlar değişikliğin yapıldığı günün TEK kuruyla çevrilir; kapalı hesaplar kapalı kalır, kur farkı oluşmaz.
// Kur milyonda bir hassasiyetle tam sayı olarak tutulur; çarpma/bölme BigInt ile yapılır (float yok).

import type { Language } from './i18n';
import { formatLocale, MAX_AMOUNT_MINOR, type Currency } from './money';

/** Kurun ondalık hassasiyeti: 6 basamak. */
export const RATE_SCALE = 1_000_000;
const SCALE = BigInt(RATE_SCALE);

/** `1 base = micro / 1.000.000 quote`. Kullanıcıya her zaman 1'den büyük yönde gösterilir (`1 USD = 49,553 ₺`). */
export interface ExchangeRate {
  base: Currency;
  quote: Currency;
  micro: number;
}

/** Ondalık sayıyı milyonda bir birime çevirir: `49.553` → 49553000. Yuvarlar (en fazla 6 basamak). */
export function toMicro(value: number): number {
  return Math.round(value * RATE_SCALE);
}

/**
 * Kurun yönünü 1'den büyük olacak şekilde seçer: `1 TRY = 0,0202 USD` yerine `1 USD = 49,553 TRY`.
 * `value` = 1 `from` kaç `to` eder.
 */
export function normalizeRate(from: Currency, to: Currency, value: number): ExchangeRate {
  if (value >= 1) return { base: from, quote: to, micro: toMicro(value) };
  return { base: to, quote: from, micro: toMicro(1 / value) };
}

export type RateParseError = 'empty' | 'invalid' | 'notPositive' | 'tooManyDecimals';

/** Kullanıcının yazdığı kuru ayrıştırır (`49,553` / `49.553`). Binlik ayracı kabul edilmez. */
export function parseRate(
  input: string,
): { ok: true; micro: number } | { ok: false; error: RateParseError } {
  const s = input.trim().replace(/\s/g, '');
  if (!s) return { ok: false, error: 'empty' };
  // Kurlarda binlik ayracı beklenmez; tek ayraç ondalıktır (dilden bağımsız).
  const normalized = s.replace(',', '.');
  if (!/^[0-9]+(\.[0-9]*)?$/.test(normalized)) {
    return { ok: false, error: 'invalid' };
  }
  const [intPart = '0', fracPart = ''] = normalized.split('.');
  if (fracPart.length > 6) return { ok: false, error: 'tooManyDecimals' };
  if (intPart.length > 9) return { ok: false, error: 'invalid' };
  const micro = Number(intPart) * RATE_SCALE + Number(fracPart.padEnd(6, '0'));
  if (micro <= 0) return { ok: false, error: 'notPositive' };
  return { ok: true, micro };
}

/** Kur girişi alanına yazılacak metin: dilin ondalık ayracıyla, sondaki sıfırlar olmadan. */
export function formatRateForInput(micro: number, language: Language): string {
  const int = Math.floor(micro / RATE_SCALE);
  const frac = String(micro % RATE_SCALE)
    .padStart(6, '0')
    .replace(/0+$/, '');
  if (!frac) return String(int);
  return `${int}${language === 'tr' ? ',' : '.'}${frac}`;
}

/** Ekranda kur: `49,553` (TR) / `49.553` (EN), en fazla 6 ondalık. */
export function formatRate(micro: number, language: Language, currency: Currency): string {
  return new Intl.NumberFormat(formatLocale(language, currency), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(micro / RATE_SCALE);
}

/** a / b, en yakın tam sayıya yuvarlanır (yarım değerler sıfırdan uzağa). */
function divRound(a: bigint, b: bigint): bigint {
  const negative = a < 0n !== b < 0n;
  const absA = a < 0n ? -a : a;
  const absB = b < 0n ? -b : b;
  const q = (absA * 2n + absB) / (absB * 2n);
  return negative ? -q : q;
}

/**
 * Kuruş cinsinden tutarı `from` para biriminden kurun diğer tarafına çevirir.
 * Sonuç kuruşa yuvarlanır. Kur bu iki para birimi arasında değilse hata fırlatır.
 */
export function convertMinor(minor: number, from: Currency, rate: ExchangeRate): number {
  if (!Number.isSafeInteger(minor)) throw new RangeError(`Tutar tam sayı olmalı: ${minor}`);
  const value = BigInt(minor);
  const micro = BigInt(rate.micro);
  let result: bigint;
  if (rate.base === from) result = divRound(value * micro, SCALE);
  else if (rate.quote === from) result = divRound(value * SCALE, micro);
  else throw new RangeError(`Kur ${rate.base}/${rate.quote}, ${from} için uygun değil`);
  return Number(result);
}

/** Dönüştürülen tutar girilebilir en büyük tutarı aşıyor mu? (Ör. çok büyük tutarlar TRY'ye çevrilirken.) */
export function exceedsMaxAmount(minor: number): boolean {
  return Math.abs(minor) > MAX_AMOUNT_MINOR;
}

/** Kurun diğer para birimi (`from` verilince hedef). */
export function counterCurrency(rate: ExchangeRate, from: Currency): Currency {
  return rate.base === from ? rate.quote : rate.base;
}
