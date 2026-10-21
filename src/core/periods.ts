// Rapor dönemleri (7.9): gün / hafta / ay / yıl / özel aralık, ileri-geri kaydırma ve grafik kırılımları.
// Tarihler `YYYY-AA-GG` metnidir; hesaplar dates.ts'deki UTC gün yardımcılarıyla yapılır.

import {
  addDays,
  daysBetween,
  formatDate,
  monthRange,
  weekday,
  yearRange,
  type DateRange,
} from './dates';

export const PERIOD_UNITS = ['day', 'week', 'month', 'year', 'custom'] as const;
export type PeriodUnit = (typeof PERIOD_UNITS)[number];

export interface Period extends DateRange {
  unit: PeriodUnit;
}

/** Haftanın ilk günü: 0 = Pazar (ABD), 1 = Pazartesi (Türkiye, İngiltere). */
export type WeekStart = 0 | 1;

/** Görüntüleme yereline göre haftanın ilk günü (`formatLocale` çıktısı). */
export function weekStartFor(locale: string): WeekStart {
  return locale === 'en-US' ? 0 : 1;
}

export function startOfWeek(iso: string, weekStart: WeekStart): string {
  return addDays(iso, -((weekday(iso) - weekStart + 7) % 7));
}

/** Tarihi içeren gün / hafta / ay / yıl. */
export function periodContaining(
  unit: Exclude<PeriodUnit, 'custom'>,
  iso: string,
  weekStart: WeekStart,
): Period {
  switch (unit) {
    case 'day':
      return { unit, from: iso, to: iso };
    case 'week': {
      const from = startOfWeek(iso, weekStart);
      return { unit, from, to: addDays(from, 6) };
    }
    case 'month':
      return { unit, ...monthRange(iso) };
    case 'year':
      return { unit, ...yearRange(iso) };
  }
}

/** Özel aralık; ters girilmişse tarihler yer değiştirir. */
export function customPeriod(from: string, to: string): Period {
  return from <= to ? { unit: 'custom', from, to } : { unit: 'custom', from: to, to: from };
}

export function periodDays(period: DateRange): number {
  return daysBetween(period.from, period.to) + 1;
}

export function containsDate(period: DateRange, iso: string): boolean {
  return period.from <= iso && iso <= period.to;
}

/** Bir önceki (−1) / sonraki (+1) dönem. Özel aralık kendi uzunluğu kadar kayar. */
export function shiftPeriod(period: Period, direction: -1 | 1): Period {
  switch (period.unit) {
    case 'day':
    case 'week': {
      const step = period.unit === 'day' ? 1 : 7;
      return {
        unit: period.unit,
        from: addDays(period.from, step * direction),
        to: addDays(period.to, step * direction),
      };
    }
    case 'month':
      return { unit: 'month', ...monthRange(period.from, direction) };
    case 'year':
      return { unit: 'year', ...yearRange(period.from, direction) };
    case 'custom': {
      const length = periodDays(period) * direction;
      return {
        unit: 'custom',
        from: addDays(period.from, length),
        to: addDays(period.to, length),
      };
    }
  }
}

/** Sonraki dönem bugünden sonra mı başlıyor? (Gelecek dönemlere gidilmez.) */
export function canGoForward(period: Period, today: string): boolean {
  return shiftPeriod(period, 1).from <= today;
}

/**
 * Dönem türü değişince bakılan tarih korunur: bugün dönemin içindeyse bugün, değilse dönemin ilk günü
 * (ör. Mart 2025'e bakarken "Yıl" → 2025).
 */
export function changeUnit(
  period: Period,
  unit: Exclude<PeriodUnit, 'custom'>,
  today: string,
  weekStart: WeekStart,
): Period {
  const anchor = containsDate(period, today) ? today : period.from;
  return periodContaining(unit, anchor, weekStart);
}

// ---------- Kırılımlar (gelir-gider grafiği) ----------

export type BucketSize = 'day' | 'week' | 'month' | 'year';

export interface Bucket extends DateRange {
  size: BucketSize;
}

/**
 * Grafiğin alt kırılımı: yıl → aylar, ay ve hafta → günler. Tek günde kırılım yoktur (`null`).
 * Özel aralıkta uzunluğa göre: 31 güne kadar günler, ~6 aya kadar haftalar, 3 yıla kadar aylar, sonra yıllar.
 */
export function bucketSizeFor(period: Period): BucketSize | null {
  switch (period.unit) {
    case 'day':
      return null;
    case 'week':
    case 'month':
      return 'day';
    case 'year':
      return 'month';
    case 'custom': {
      const days = periodDays(period);
      if (days <= 1) return null;
      if (days <= 31) return 'day';
      if (days <= 183) return 'week';
      if (days <= 1096) return 'month';
      return 'year';
    }
  }
}

/** Dönemi kırılım dilimlerine böler; ilk ve son dilim dönem sınırlarına kırpılır. */
export function periodBuckets(period: Period, weekStart: WeekStart): Bucket[] {
  const size = bucketSizeFor(period);
  if (!size) return [];
  const buckets: Bucket[] = [];
  let cursor = period.from;
  while (cursor <= period.to) {
    const full =
      size === 'day'
        ? { from: cursor, to: cursor }
        : size === 'week'
          ? periodContaining('week', cursor, weekStart)
          : size === 'month'
            ? monthRange(cursor)
            : yearRange(cursor);
    const to = full.to < period.to ? full.to : period.to;
    buckets.push({ size, from: cursor, to });
    cursor = addDays(to, 1);
  }
  return buckets;
}

export interface DailyIncomeExpense {
  date: string;
  incomeMinor: number;
  expenseMinor: number;
}

export type BucketTotals = Bucket & { incomeMinor: number; expenseMinor: number };

/** Günlük toplamları dilimlere dağıtır (dilimler ve günler tarih sırasında; dilim dışı günler yok sayılır). */
export function totalsByBucket(
  buckets: readonly Bucket[],
  daily: readonly DailyIncomeExpense[],
): BucketTotals[] {
  const result = buckets.map((bucket) => ({ ...bucket, incomeMinor: 0, expenseMinor: 0 }));
  const sorted = [...daily].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let index = 0;
  for (const row of sorted) {
    while (index < result.length && result[index]!.to < row.date) index += 1;
    const bucket = result[index];
    if (!bucket) break;
    if (row.date < bucket.from) continue;
    bucket.incomeMinor += row.incomeMinor;
    bucket.expenseMinor += row.expenseMinor;
  }
  return result;
}

// ---------- Etiketler ----------

function formatRange(range: DateRange, locale: string): string {
  if (range.from === range.to) return formatDate(range.from, locale, 'dayMonthYear');
  const sameYear = range.from.slice(0, 4) === range.to.slice(0, 4);
  const from = formatDate(range.from, locale, sameYear ? 'dayMonth' : 'dayMonthYear');
  return `${from} – ${formatDate(range.to, locale, 'dayMonthYear')}`;
}

/** Dönem seçicideki başlık: `14 Eki 2026`, `12 Eki – 18 Eki 2026`, `Ekim 2026`, `2026`. */
export function formatPeriod(period: Period, locale: string): string {
  switch (period.unit) {
    case 'month':
      return formatDate(period.from, locale, 'monthYear');
    case 'year':
      return formatDate(period.from, locale, 'year');
    default:
      return formatRange(period, locale);
  }
}

/** Grafik ekseninde dilimin kısa etiketi. Haftalık dönemde günler hafta günü adıyla gösterilir. */
export function formatBucketAxis(bucket: Bucket, period: Period, locale: string): string {
  switch (bucket.size) {
    case 'day':
      return formatDate(bucket.from, locale, period.unit === 'week' ? 'weekdayShort' : 'day');
    case 'week':
      return formatDate(bucket.from, locale, 'dayMonth');
    case 'month':
      return formatDate(
        bucket.from,
        locale,
        period.from.slice(0, 4) === period.to.slice(0, 4) ? 'monthShort' : 'monthShortYear',
      );
    case 'year':
      return formatDate(bucket.from, locale, 'year');
  }
}

/** Grafikte seçilen dilimin tam adı: `14 Eki 2026`, `12 Eki – 18 Eki 2026`, `Ekim 2026`, `2026`. */
export function formatBucket(bucket: Bucket, locale: string): string {
  switch (bucket.size) {
    case 'month':
      return formatDate(bucket.from, locale, 'monthYear');
    case 'year':
      return formatDate(bucket.from, locale, 'year');
    default:
      return formatRange(bucket, locale);
  }
}
