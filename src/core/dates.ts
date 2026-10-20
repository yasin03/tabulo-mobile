// Tarihler veritabanında `YYYY-AA-GG` metni olarak tutulur (saat dilimi sorunu olmaz).
// Gösterim ve gün hesapları UTC gece yarısı üzerinden yapılır; cihazın saat dilimi sonucu değiştirmez.

import { isIsoDate } from './validation';

/** Cihazın yerel saatine göre `YYYY-AA-GG`. */
export function toIsoDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  return [y ?? 1970, m ?? 1, d ?? 1];
}

/** `YYYY-AA-GG` → o günün UTC gece yarısı. */
function toUtc(iso: string): Date {
  const [y, m, d] = parts(iso);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Yerel takvimdeki gün → tarih seçici için yerel gece yarısı `Date`. */
export function isoToLocalDate(iso: string): Date {
  const [y, m, d] = parts(iso);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const date = toUtc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
}

/** `to − from` gün farkı (aynı gün 0, yarın 1, dün −1). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

/** Ay anahtarı: `2026-10`. Listelerde aya göre gruplama için. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export interface DateRange {
  /** Dahil, `YYYY-AA-GG`. */
  from: string;
  /** Dahil, `YYYY-AA-GG`. */
  to: string;
}

/** Tarihin ayının ilk ve son günü. `offset` ay kaydırır (−1: önceki ay). */
export function monthRange(iso: string, offset = 0): DateRange {
  const [y, m] = parts(iso);
  const first = new Date(Date.UTC(y, m - 1 + offset, 1));
  const last = new Date(Date.UTC(y, m + offset, 0));
  return { from: fromUtc(first), to: fromUtc(last) };
}

export function yearRange(iso: string): DateRange {
  const [y] = parts(iso);
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

export type DateStyle =
  | 'dayMonth' // 15 Eki
  | 'dayMonthLong' // 25 Ekim
  | 'full' // 15 Ekim 2026
  | 'monthYear'; // Ekim 2026

const DATE_STYLE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  dayMonth: { day: 'numeric', month: 'short' },
  dayMonthLong: { day: 'numeric', month: 'long' },
  full: { day: 'numeric', month: 'long', year: 'numeric' },
  monthYear: { month: 'long', year: 'numeric' },
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

/**
 * Tarihi dile göre biçimler. `locale` money.ts'deki `formatLocale` ile seçilir (tr-TR, en-GB, en-US).
 * Geçersiz tarihte metnin kendisi döner.
 */
export function formatDate(iso: string, locale: string, style: DateStyle): string {
  if (!isIsoDate(iso)) return iso;
  const key = `${locale}|${style}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { ...DATE_STYLE_OPTIONS[style], timeZone: 'UTC' });
    formatterCache.set(key, formatter);
  }
  return formatter.format(toUtc(iso));
}

/** `from` ayından `to` ayına kadar ay anahtarları, en yeniden eskiye (`2026-10`, `2026-09`…). */
export function monthsBetween(fromMonth: string, toMonth: string): string[] {
  const result: string[] = [];
  let [y, m] = parts(`${toMonth}-01`);
  const [fy, fm] = parts(`${fromMonth}-01`);
  while (y > fy || (y === fy && m >= fm)) {
    result.push(`${y}-${String(m).padStart(2, '0')}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return result;
}

// ---------- Saat (`SS:DD`, 24 saat) ----------

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** `09:00` biçiminde geçerli bir saat mi? (Hatırlatma saati veritabanında böyle saklanır.) */
export function isTimeOfDay(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/** `09:30` → `{ hour: 9, minute: 30 }`; geçersizse `null`. */
export function parseTimeOfDay(value: string): { hour: number; minute: number } | null {
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/** Cihazın yerel saatine göre `SS:DD`. */
export function toTimeOfDay(date: Date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Yerel takvimdeki gün + saat → yerel `Date` (bildirim zamanı, saat seçici). */
export function localDateTime(iso: string, time: string): Date {
  const date = isoToLocalDate(iso);
  const parsed = parseTimeOfDay(time);
  if (parsed) date.setHours(parsed.hour, parsed.minute, 0, 0);
  return date;
}

/** Saati dile göre biçimler: tr/en-GB `09:00`, en-US `9:00 AM`. Geçersizse metnin kendisi. */
export function formatTimeOfDay(time: string, locale: string): string {
  const parsed = parseTimeOfDay(time);
  if (!parsed) return time;
  const key = `${locale}|time`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    // 24 saatlik dillerde `09:05`; 12 saatlikte `9:05 AM`.
    const hour12 = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12;
    formatter = new Intl.DateTimeFormat(locale, {
      hour: hour12 ? 'numeric' : '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });
    formatterCache.set(key, formatter);
  }
  return formatter.format(new Date(Date.UTC(2000, 0, 1, parsed.hour, parsed.minute)));
}
