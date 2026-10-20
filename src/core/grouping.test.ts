import { groupByMonth } from './grouping';

describe('groupByMonth', () => {
  it('ay başlıkları ekler ve ay içindeki ilk/son satırı işaretler', () => {
    const rows = [
      { id: 'a', date: '2026-10-15' },
      { id: 'b', date: '2026-10-02' },
      { id: 'c', date: '2026-09-30' },
    ];
    expect(groupByMonth(rows)).toEqual([
      { kind: 'month', key: 'month-2026-10', month: '2026-10' },
      { kind: 'row', key: 'a', item: rows[0], isFirst: true, isLast: false },
      { kind: 'row', key: 'b', item: rows[1], isFirst: false, isLast: true },
      { kind: 'month', key: 'month-2026-09', month: '2026-09' },
      { kind: 'row', key: 'c', item: rows[2], isFirst: true, isLast: true },
    ]);
  });

  it('boş liste', () => {
    expect(groupByMonth([])).toEqual([]);
  });
});
