import { compactAmount } from './money';
import {
  bucketSizeFor,
  canGoForward,
  changeUnit,
  customPeriod,
  formatBucket,
  formatBucketAxis,
  formatPeriod,
  periodBuckets,
  periodContaining,
  shiftPeriod,
  startOfWeek,
  totalsByBucket,
  weekStartFor,
  type Period,
} from './periods';

describe('hafta başlangıcı', () => {
  it('ABD Pazar, Türkiye ve İngiltere Pazartesi', () => {
    expect(weekStartFor('en-US')).toBe(0);
    expect(weekStartFor('en-GB')).toBe(1);
    expect(weekStartFor('tr-TR')).toBe(1);
  });

  it('haftanın ilk günü', () => {
    // 2026-10-14 Çarşamba
    expect(startOfWeek('2026-10-14', 1)).toBe('2026-10-12');
    expect(startOfWeek('2026-10-14', 0)).toBe('2026-10-11');
    expect(startOfWeek('2026-10-12', 1)).toBe('2026-10-12');
    expect(startOfWeek('2026-10-11', 1)).toBe('2026-10-05'); // Pazar → önceki Pazartesi
    expect(startOfWeek('2026-10-11', 0)).toBe('2026-10-11');
  });
});

describe('periodContaining', () => {
  it('gün / hafta / ay / yıl', () => {
    expect(periodContaining('day', '2026-10-14', 1)).toEqual({
      unit: 'day',
      from: '2026-10-14',
      to: '2026-10-14',
    });
    expect(periodContaining('week', '2026-10-14', 1)).toEqual({
      unit: 'week',
      from: '2026-10-12',
      to: '2026-10-18',
    });
    expect(periodContaining('month', '2024-02-10', 1)).toEqual({
      unit: 'month',
      from: '2024-02-01',
      to: '2024-02-29',
    });
    expect(periodContaining('year', '2026-10-14', 1)).toEqual({
      unit: 'year',
      from: '2026-01-01',
      to: '2026-12-31',
    });
  });

  it('yıl dönümünü aşan hafta', () => {
    expect(periodContaining('week', '2027-01-01', 1)).toMatchObject({
      from: '2026-12-28',
      to: '2027-01-03',
    });
  });
});

describe('shiftPeriod', () => {
  it('ay kaydırma ay sonlarını doğru bulur', () => {
    const jan: Period = { unit: 'month', from: '2026-01-01', to: '2026-01-31' };
    expect(shiftPeriod(jan, 1)).toEqual({ unit: 'month', from: '2026-02-01', to: '2026-02-28' });
    expect(shiftPeriod(jan, -1)).toEqual({ unit: 'month', from: '2025-12-01', to: '2025-12-31' });
  });

  it('gün, hafta ve yıl', () => {
    expect(shiftPeriod({ unit: 'day', from: '2026-03-01', to: '2026-03-01' }, -1)).toMatchObject({
      from: '2026-02-28',
    });
    expect(shiftPeriod({ unit: 'week', from: '2026-12-28', to: '2027-01-03' }, 1)).toMatchObject({
      from: '2027-01-04',
      to: '2027-01-10',
    });
    expect(shiftPeriod({ unit: 'year', from: '2026-01-01', to: '2026-12-31' }, -1)).toMatchObject({
      from: '2025-01-01',
      to: '2025-12-31',
    });
  });

  it('özel aralık kendi uzunluğu kadar kayar', () => {
    const range = customPeriod('2026-10-01', '2026-10-10');
    expect(shiftPeriod(range, -1)).toEqual({
      unit: 'custom',
      from: '2026-09-21',
      to: '2026-09-30',
    });
    expect(shiftPeriod(range, 1)).toMatchObject({ from: '2026-10-11', to: '2026-10-20' });
  });

  it('ters girilen özel aralık düzeltilir', () => {
    expect(customPeriod('2026-10-10', '2026-10-01')).toMatchObject({
      from: '2026-10-01',
      to: '2026-10-10',
    });
  });

  it('gelecek döneme gidilmez', () => {
    const today = '2026-10-20';
    expect(canGoForward(periodContaining('month', today, 1), today)).toBe(false);
    expect(canGoForward(periodContaining('month', '2026-09-05', 1), today)).toBe(true);
    expect(canGoForward(periodContaining('day', '2026-10-19', 1), today)).toBe(true);
  });
});

describe('changeUnit', () => {
  const today = '2026-10-20';
  it('bugün dönemin içindeyse bugünü korur', () => {
    const month = periodContaining('month', today, 1);
    expect(changeUnit(month, 'week', today, 1)).toMatchObject({
      from: '2026-10-19',
      to: '2026-10-25',
    });
  });

  it('geçmiş dönemde dönemin ilk gününe göre', () => {
    const march = periodContaining('month', '2025-03-15', 1);
    expect(changeUnit(march, 'year', today, 1)).toMatchObject({ from: '2025-01-01' });
    expect(changeUnit(march, 'day', today, 1)).toMatchObject({ from: '2025-03-01' });
  });
});

describe('kırılımlar', () => {
  it('yıl → 12 ay, ay → günler, hafta → 7 gün, gün → yok', () => {
    expect(periodBuckets(periodContaining('year', '2026-05-05', 1), 1)).toHaveLength(12);
    const feb = periodBuckets(periodContaining('month', '2026-02-05', 1), 1);
    expect(feb).toHaveLength(28);
    expect(feb[27]).toEqual({ size: 'day', from: '2026-02-28', to: '2026-02-28' });
    expect(periodBuckets(periodContaining('week', '2026-10-14', 0), 0)).toHaveLength(7);
    expect(periodBuckets(periodContaining('day', '2026-10-14', 1), 1)).toEqual([]);
  });

  it('özel aralıkta uzunluğa göre dilim', () => {
    expect(bucketSizeFor(customPeriod('2026-10-01', '2026-10-01'))).toBeNull();
    expect(bucketSizeFor(customPeriod('2026-10-01', '2026-10-31'))).toBe('day');
    expect(bucketSizeFor(customPeriod('2026-10-01', '2026-11-01'))).toBe('week');
    expect(bucketSizeFor(customPeriod('2026-01-01', '2026-12-31'))).toBe('month');
    expect(bucketSizeFor(customPeriod('2020-01-01', '2026-12-31'))).toBe('year');
  });

  it('haftalık dilimler dönem sınırına kırpılır', () => {
    // 2026-10-01 Perşembe … 2026-11-15 Pazar
    const buckets = periodBuckets(customPeriod('2026-10-01', '2026-11-15'), 1);
    expect(buckets[0]).toEqual({ size: 'week', from: '2026-10-01', to: '2026-10-04' });
    expect(buckets[1]).toEqual({ size: 'week', from: '2026-10-05', to: '2026-10-11' });
    expect(buckets.at(-1)).toEqual({ size: 'week', from: '2026-11-09', to: '2026-11-15' });
    expect(buckets).toHaveLength(7);
  });

  it('aylık dilimler dönem sınırına kırpılır', () => {
    const buckets = periodBuckets(customPeriod('2026-01-15', '2026-09-10'), 1);
    expect(buckets[0]).toEqual({ size: 'month', from: '2026-01-15', to: '2026-01-31' });
    expect(buckets.at(-1)).toEqual({ size: 'month', from: '2026-09-01', to: '2026-09-10' });
    expect(buckets).toHaveLength(9);
  });

  it('günlük toplamlar dilimlere dağıtılır', () => {
    const buckets = periodBuckets(periodContaining('year', '2026-01-01', 1), 1);
    const totals = totalsByBucket(buckets, [
      { date: '2026-03-31', incomeMinor: 100, expenseMinor: 0 },
      { date: '2026-01-05', incomeMinor: 50, expenseMinor: 20 },
      { date: '2026-03-01', incomeMinor: 0, expenseMinor: 30 },
      { date: '2026-12-31', incomeMinor: 7, expenseMinor: 0 },
      { date: '2027-01-01', incomeMinor: 999, expenseMinor: 999 }, // dönem dışı
    ]);
    expect(totals.map((b) => [b.incomeMinor, b.expenseMinor])).toEqual([
      [50, 20],
      [0, 0],
      [100, 30],
      ...Array.from({ length: 8 }, () => [0, 0]),
      [7, 0],
    ]);
  });
});

describe('etiketler', () => {
  it('dönem başlığı', () => {
    expect(formatPeriod(periodContaining('month', '2026-10-14', 1), 'tr-TR')).toBe('Ekim 2026');
    expect(formatPeriod(periodContaining('year', '2026-10-14', 1), 'en-GB')).toBe('2026');
    expect(formatPeriod(periodContaining('day', '2026-10-14', 1), 'tr-TR')).toBe('14 Eki 2026');
    expect(formatPeriod(periodContaining('week', '2026-10-14', 1), 'tr-TR')).toBe(
      '12 Eki – 18 Eki 2026',
    );
    expect(formatPeriod(customPeriod('2025-12-20', '2026-01-10'), 'en-US')).toBe(
      'Dec 20, 2025 – Jan 10, 2026',
    );
  });

  it('eksen etiketleri', () => {
    const week = periodContaining('week', '2026-10-14', 1);
    const [monday] = periodBuckets(week, 1);
    expect(formatBucketAxis(monday!, week, 'tr-TR')).toBe('Pzt');
    const month = periodContaining('month', '2026-10-14', 1);
    expect(formatBucketAxis(periodBuckets(month, 1)[8]!, month, 'tr-TR')).toBe('9');
    const year = periodContaining('year', '2026-10-14', 1);
    expect(formatBucketAxis(periodBuckets(year, 1)[9]!, year, 'tr-TR')).toBe('Eki');
    const span = customPeriod('2025-06-01', '2026-03-31');
    expect(formatBucketAxis(periodBuckets(span, 1)[0]!, span, 'en-GB')).toBe('Jun 25');
    expect(formatBucket(periodBuckets(year, 1)[9]!, 'tr-TR')).toBe('Ekim 2026');
  });
});

describe('compactAmount', () => {
  const tr = { language: 'tr', currency: 'TRY' } as const;
  const en = { language: 'en', currency: 'GBP' } as const;
  it('birim seçer ve 1 ondalığa yuvarlar', () => {
    expect(compactAmount(0, tr)).toEqual({ value: '0', unit: 'none' });
    expect(compactAmount(95000, tr)).toEqual({ value: '950', unit: 'none' });
    expect(compactAmount(1500000, tr)).toEqual({ value: '15', unit: 'thousand' });
    expect(compactAmount(125000000, tr)).toEqual({ value: '1,3', unit: 'million' });
    expect(compactAmount(125000000, en)).toEqual({ value: '1.3', unit: 'million' });
    expect(compactAmount(-250000000000, en)).toEqual({ value: '-2.5', unit: 'billion' });
  });
});
