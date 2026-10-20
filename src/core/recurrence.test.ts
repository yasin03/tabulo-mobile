import {
  dueStatus,
  isScheduleFinished,
  nextOccurrence,
  occurrence,
  reminderDate,
  type Schedule,
} from './recurrence';

const monthly = (startDate: string, interval = 1): Schedule => ({
  startDate,
  frequency: 'monthly',
  interval,
});

describe('occurrence', () => {
  it('haftalık: her N haftada bir', () => {
    const s: Schedule = { startDate: '2026-10-20', frequency: 'weekly', interval: 2 };
    expect(occurrence(s, 0)).toBe('2026-10-20');
    expect(occurrence(s, 1)).toBe('2026-11-03');
    expect(occurrence(s, 6)).toBe('2027-01-12');
  });

  it('aylık: ay kısa ise ayın son günü, sonraki aylar başlangıç gününe döner', () => {
    const s = monthly('2026-01-31');
    expect([0, 1, 2, 3].map((n) => occurrence(s, n))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
    expect(occurrence(monthly('2028-01-31'), 1)).toBe('2028-02-29'); // artık yıl
  });

  it('her 3 ayda bir, yıl geçişi', () => {
    const s = monthly('2026-11-15', 3);
    expect(occurrence(s, 1)).toBe('2027-02-15');
    expect(occurrence(s, 4)).toBe('2027-11-15');
  });

  it('yıllık: 29 Şubat artık olmayan yılda 28 Şubat', () => {
    const s: Schedule = { startDate: '2028-02-29', frequency: 'yearly', interval: 1 };
    expect(occurrence(s, 1)).toBe('2029-02-28');
    expect(occurrence(s, 4)).toBe('2032-02-29');
  });
});

describe('nextOccurrence', () => {
  it('verilen tarihten sonraki ilk tekrar (dahil değil)', () => {
    const s = monthly('2026-01-31');
    expect(nextOccurrence(s, '2026-01-31')).toBe('2026-02-28');
    expect(nextOccurrence(s, '2026-02-28')).toBe('2026-03-31');
    expect(nextOccurrence(s, '2026-03-01')).toBe('2026-03-31');
  });

  it('başlangıçtan önceyse başlangıç', () => {
    expect(nextOccurrence(monthly('2026-12-01'), '2026-10-20')).toBe('2026-12-01');
  });

  it('çok sayıda dönem sonrası da doğru (haftalık / yıllık)', () => {
    const weekly: Schedule = { startDate: '2020-01-06', frequency: 'weekly', interval: 1 };
    expect(nextOccurrence(weekly, '2026-10-20')).toBe('2026-10-26');
    const yearly: Schedule = { startDate: '2020-03-15', frequency: 'yearly', interval: 2 };
    expect(nextOccurrence(yearly, '2026-03-15')).toBe('2028-03-15');
  });

  it('rastgele: sonuç her zaman tarihten sonra ve bir tekrar', () => {
    const frequencies = ['weekly', 'monthly', 'yearly'] as const;
    for (let i = 0; i < 300; i += 1) {
      const start = `20${20 + (i % 7)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`;
      const s: Schedule = {
        startDate: start,
        frequency: frequencies[i % 3]!,
        interval: (i % 4) + 1,
      };
      const after = occurrence(s, i % 9);
      const next = nextOccurrence(s, after);
      expect(next).toBe(occurrence(s, (i % 9) + 1));
    }
  });
});

describe('yardımcılar', () => {
  it('bitiş tarihi', () => {
    expect(isScheduleFinished('2026-12-01', null)).toBe(false);
    expect(isScheduleFinished('2026-12-01', '2026-12-01')).toBe(false);
    expect(isScheduleFinished('2026-12-02', '2026-12-01')).toBe(true);
  });

  it('hatırlatma günü', () => {
    expect(reminderDate('2026-11-01', 0)).toBe('2026-11-01');
    expect(reminderDate('2026-11-01', 3)).toBe('2026-10-29');
  });

  it('kalan gün etiketi: gecikti / 7 gün ve altı / sonra', () => {
    expect(dueStatus('2026-10-19', '2026-10-20')).toEqual({ days: -1, tone: 'overdue' });
    expect(dueStatus('2026-10-20', '2026-10-20')).toEqual({ days: 0, tone: 'soon' });
    expect(dueStatus('2026-10-27', '2026-10-20')).toEqual({ days: 7, tone: 'soon' });
    expect(dueStatus('2026-10-28', '2026-10-20')).toEqual({ days: 8, tone: 'later' });
  });
});
