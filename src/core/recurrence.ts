// Düzenli ödemelerin tarih hesapları (PROMPT.md 6.5). Tarihler `YYYY-AA-GG` metnidir.

import type { FREQUENCIES } from '@/db/schema';

import { addDays, daysBetween } from './dates';

export type Frequency = (typeof FREQUENCIES)[number];

/** "Her N haftada / ayda / yılda bir": N'nin üst sınırı. */
export const MAX_INTERVAL = 12;
/** Kaç gün önce hatırlatılacağı: üst sınır. */
export const MAX_REMIND_DAYS_BEFORE = 30;
/** Kalan gün bu sayı ve altındaysa "yaklaşıyor" (warning) etiketi (6.5). */
export const DUE_SOON_DAYS = 7;

export interface Schedule {
  /** Tekrarların dayanağı: aylık/yıllıkta ayın günü buradan gelir. */
  startDate: string;
  frequency: Frequency;
  interval: number;
}

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number);
  return [y ?? 1970, m ?? 1, d ?? 1];
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const pad = (n: number) => String(n).padStart(2, '0');

function stepMonths({ frequency, interval }: Schedule): number {
  return frequency === 'yearly' ? 12 * interval : interval;
}

/**
 * Başlangıçtan itibaren `n`. tekrarın tarihi (0 = başlangıç).
 * Aylık / yıllıkta gün başlangıçtaki gündür; ay daha kısaysa ayın son günü olur
 * (31 Ocak → 28 Şubat → 31 Mart: kısa ay sonraki tekrarları kaydırmaz).
 */
export function occurrence(schedule: Schedule, n: number): string {
  if (schedule.frequency === 'weekly')
    return addDays(schedule.startDate, 7 * schedule.interval * n);
  const [y, m, d] = parts(schedule.startDate);
  const total = y * 12 + (m - 1) + stepMonths(schedule) * n;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${pad(month)}-${pad(Math.min(d, daysInMonth(year, month)))}`;
}

/** `after` tarihinden SONRAKİ ilk tekrar (`after` dahil değil). "Ödendi"de sonraki tarih buradan gelir. */
export function nextOccurrence(schedule: Schedule, after: string): string {
  if (after < schedule.startDate) return schedule.startDate;
  let n: number;
  if (schedule.frequency === 'weekly') {
    n = Math.floor(daysBetween(schedule.startDate, after) / (7 * schedule.interval));
  } else {
    const [sy, sm] = parts(schedule.startDate);
    const [ay, am] = parts(after);
    n = Math.floor(((ay - sy) * 12 + (am - sm)) / stepMonths(schedule));
  }
  n = Math.max(0, n - 1);
  while (occurrence(schedule, n) <= after) n += 1;
  return occurrence(schedule, n);
}

/** Bitiş tarihi geçildi mi? (Sonraki tarih bitişten sonraysa düzenli ödeme tamamlanmıştır.) */
export function isScheduleFinished(nextDueDate: string, endDate: string | null): boolean {
  return endDate !== null && nextDueDate > endDate;
}

/** Hatırlatma günü: sonraki tarihten `remindDaysBefore` gün önce. */
export function reminderDate(nextDueDate: string, remindDaysBefore: number): string {
  return addDays(nextDueDate, -remindDaysBefore);
}

export type DueTone = 'overdue' | 'soon' | 'later';

/** Listelerdeki kalan gün etiketi: geçmişse `overdue`, 7 gün ve altıysa `soon` (6.5). */
export function dueStatus(nextDueDate: string, today: string): { days: number; tone: DueTone } {
  const days = daysBetween(today, nextDueDate);
  return { days, tone: days < 0 ? 'overdue' : days <= DUE_SOON_DAYS ? 'soon' : 'later' };
}
