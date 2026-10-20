import {
  addDays,
  daysBetween,
  formatDate,
  formatTimeOfDay,
  isTimeOfDay,
  localDateTime,
  parseTimeOfDay,
  isoToLocalDate,
  monthKey,
  monthsBetween,
  monthRange,
  toIsoDate,
  yearRange,
} from './dates';

describe('toIsoDate', () => {
  it('yerel tarihi YYYY-AA-GG biçiminde verir', () => {
    expect(toIsoDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(toIsoDate(new Date(2026, 9, 19, 0, 0))).toBe('2026-10-19');
  });

  it('isoToLocalDate ile gidiş-dönüş', () => {
    expect(toIsoDate(isoToLocalDate('2026-02-28'))).toBe('2026-02-28');
  });
});

describe('gün hesapları', () => {
  it('addDays ay ve yıl sınırını geçer', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('daysBetween', () => {
    expect(daysBetween('2026-10-20', '2026-10-20')).toBe(0);
    expect(daysBetween('2026-10-20', '2026-10-27')).toBe(7);
    expect(daysBetween('2026-10-20', '2026-10-19')).toBe(-1);
    // Yaz saati geçişi (Türkiye'de yok ama İngiltere/ABD'de var) sonucu değiştirmez.
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
  });

  it('monthKey / monthRange / yearRange', () => {
    expect(monthKey('2026-10-15')).toBe('2026-10');
    expect(monthRange('2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthRange('2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
    expect(monthRange('2026-01-10', -1)).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(yearRange('2026-10-15')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });
});

describe('formatDate', () => {
  it('Türkçe', () => {
    expect(formatDate('2026-10-25', 'tr-TR', 'dayMonthLong')).toBe('25 Ekim');
    expect(formatDate('2026-10-25', 'tr-TR', 'full')).toBe('25 Ekim 2026');
    expect(formatDate('2026-10-25', 'tr-TR', 'monthYear')).toBe('Ekim 2026');
    expect(formatDate('2026-10-15', 'tr-TR', 'dayMonth')).toBe('15 Eki');
  });

  it('İngilizce (UK / US)', () => {
    expect(formatDate('2026-10-25', 'en-GB', 'full')).toBe('25 October 2026');
    expect(formatDate('2026-10-25', 'en-US', 'full')).toBe('October 25, 2026');
    expect(formatDate('2026-10-25', 'en-GB', 'monthYear')).toBe('October 2026');
  });

  it('geçersiz tarihte metni olduğu gibi döner', () => {
    expect(formatDate('', 'tr-TR', 'full')).toBe('');
  });
});

describe('monthsBetween', () => {
  it('en yeniden eskiye, yıl sınırını geçer', () => {
    expect(monthsBetween('2025-11', '2026-02')).toEqual([
      '2026-02',
      '2026-01',
      '2025-12',
      '2025-11',
    ]);
    expect(monthsBetween('2026-10', '2026-10')).toEqual(['2026-10']);
    expect(monthsBetween('2026-11', '2026-10')).toEqual([]);
  });
});

describe('saat', () => {
  it('doğrular ve ayrıştırır', () => {
    expect(isTimeOfDay('09:00')).toBe(true);
    expect(isTimeOfDay('9:00')).toBe(false);
    expect(isTimeOfDay('24:00')).toBe(false);
    expect(parseTimeOfDay('23:59')).toEqual({ hour: 23, minute: 59 });
    expect(parseTimeOfDay('x')).toBeNull();
  });

  it('dile göre biçimler', () => {
    expect(formatTimeOfDay('09:05', 'tr-TR')).toBe('09:05');
    expect(formatTimeOfDay('21:30', 'en-US').replace(/\s/g, ' ')).toBe('9:30 PM');
  });

  it('yerel tarih + saat', () => {
    const date = localDateTime('2026-10-20', '09:30');
    expect([
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
    ]).toEqual([2026, 9, 20, 9, 30]);
  });
});
