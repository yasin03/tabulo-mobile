// Doğrulamalar (PROMPT.md 6.2, 6.3). Boş bırakılabilen alanlarda "boş mu?" kontrolünü çağıran yapar.

import type { Currency } from './money';

// ---------- TC Kimlik No ----------

export type NationalIdIssue =
  | 'length' // 11 hane değil veya rakam dışı karakter var
  | 'firstDigit'; // ilk hane 0

/**
 * TC Kimlik No kontrolü: 11 hane, yalnızca rakam, ilk hane 0 olamaz. Geçerliyse `null`.
 * Kontrol hanesi algoritması bilinçli olarak uygulanmaz (kullanıcı kararı, PROMPT.md 6.2'den sapma).
 */
export function nationalIdIssue(value: string): NationalIdIssue | null {
  if (!/^[0-9]{11}$/.test(value)) return 'length';
  if (value.startsWith('0')) return 'firstDigit';
  return null;
}

export function isValidNationalId(value: string): boolean {
  return nationalIdIssue(value) === null;
}

/** Ekranda maskeli gösterim (6.3): `12345678901` → `123******01`. */
export function maskNationalId(value: string): string {
  if (value.length <= 5) return value;
  return `${value.slice(0, 3)}${'*'.repeat(value.length - 5)}${value.slice(-2)}`;
}

// ---------- Vergi No ----------

/** Vergi No: 10 hane, yalnızca rakam. */
export function isValidTaxNumber(value: string): boolean {
  return /^[0-9]{10}$/.test(value);
}

// ---------- IBAN ----------

/** IBAN'ı boşluksuz büyük harfe çevirir: `tr12 0006 ...` → `TR120006...`. */
export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

/** ISO 13616 IBAN kontrolü (ülke kodu + 2 kontrol hanesi + mod 97). TR IBAN'ı 26 karakterdir. */
export function isValidIban(value: string): boolean {
  const iban = normalizeIban(value);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith('TR') && iban.length !== 26) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const digits = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 55) : char;
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}

/** IBAN'ı 4'lü gruplarla gösterir: `TR33 0006 1005 1978 6457 8413 26`. */
export function formatIban(value: string): string {
  return normalizeIban(value).replace(/(.{4})(?=.)/g, '$1 ');
}

// ---------- Telefon ----------

export const PHONE_COUNTRIES = ['TR', 'GB', 'US'] as const;
export type PhoneCountry = (typeof PHONE_COUNTRIES)[number];

const COUNTRY_RULES: Record<
  PhoneCountry,
  { callingCode: string; nationalLength: number; trunkPrefix: string | null }
> = {
  TR: { callingCode: '90', nationalLength: 10, trunkPrefix: '0' }, // 0532 000 00 00
  GB: { callingCode: '44', nationalLength: 10, trunkPrefix: '0' }, // 07700 900000
  US: { callingCode: '1', nationalLength: 10, trunkPrefix: '1' }, // (201) 555-0123, 1 201 555 0123
};

/** Ülke telefon kodu: `TR` → `+90`. */
export function callingCode(country: PhoneCountry): string {
  return `+${COUNTRY_RULES[country].callingCode}`;
}

/** Varsayılan telefon ülkesi işletme para birimine göre (6.2). */
export function defaultPhoneCountry(currency: Currency): PhoneCountry {
  switch (currency) {
    case 'GBP':
      return 'GB';
    case 'USD':
      return 'US';
    default:
      return 'TR';
  }
}

/**
 * Telefonu E.164 biçimine çevirir (`+905320000000`). Geçersizse `null`.
 * - `+` veya `00` ile başlıyorsa uluslararası numara kabul edilir (8–15 hane).
 * - Aksi halde varsayılan ülkenin ulusal numarası olarak yorumlanır.
 */
export function normalizePhone(input: string, defaultCountry: PhoneCountry): string | null {
  const trimmed = input.trim();
  if (!/^[+0-9\s().-]+$/.test(trimmed)) return null;
  const hasPlus = trimmed.startsWith('+');
  if (trimmed.indexOf('+', 1) !== -1) return null;
  const digits = trimmed.replace(/[^0-9]/g, '');

  if (hasPlus || digits.startsWith('00')) {
    const international = hasPlus ? digits : digits.slice(2);
    if (!/^[1-9][0-9]{7,14}$/.test(international)) return null;
    return `+${international}`;
  }

  const rule = COUNTRY_RULES[defaultCountry];
  let national = digits;
  if (rule.trunkPrefix && national.length === rule.nationalLength + rule.trunkPrefix.length) {
    if (!national.startsWith(rule.trunkPrefix)) return null;
    national = national.slice(rule.trunkPrefix.length);
  }
  if (national.length !== rule.nationalLength || national.startsWith('0')) return null;
  return `+${rule.callingCode}${national}`;
}

/**
 * Kayıtlı E.164 numarayı okunur gösterir. Numara varsayılan ülkedense ulusal biçimde:
 * TR `0532 000 00 00`, GB `07700 900000`, US `(201) 555-0123`; değilse `+` ile olduğu gibi.
 */
export function formatPhone(e164: string, defaultCountry: PhoneCountry): string {
  const rule = COUNTRY_RULES[defaultCountry];
  const prefix = `+${rule.callingCode}`;
  const national = e164.startsWith(prefix) ? e164.slice(prefix.length) : null;
  if (!national || national.length !== rule.nationalLength || !/^[0-9]+$/.test(national)) {
    return e164;
  }
  switch (defaultCountry) {
    case 'TR':
      return `0${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6, 8)} ${national.slice(8)}`;
    case 'GB':
      return `0${national.slice(0, 4)} ${national.slice(4)}`;
    case 'US':
      return `(${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
  }
}

// ---------- Tarih ----------

/** `YYYY-AA-GG` biçiminde ve takvimde gerçekten var olan bir tarih mi? */
export function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  if (m < 1 || m > 12 || d < 1) return false;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= daysInMonth;
}
