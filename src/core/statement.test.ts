import { exportFileName, fileNamePart } from './fileNames';
import { balanceSide, buildStatement, statementPeriod, type StatementMovement } from './statement';

const m = (
  id: string,
  date: string,
  movementType: StatementMovement['movementType'],
  amountMinor: number,
  openingDirection?: 'receivable' | 'payable',
): StatementMovement => ({ id, date, movementType, amountMinor, openingDirection });

const movements = [
  m('1', '2026-01-05', 'opening', 10_000, 'receivable'),
  m('2', '2026-02-10', 'credit_sale', 50_000),
  m('3', '2026-03-01', 'collection', 30_000),
  m('4', '2026-03-15', 'credit_purchase', 5_000),
  m('5', '2026-04-02', 'payment', 2_000),
];

describe('buildStatement', () => {
  it('fills debit/credit from the contact effect and keeps a running balance', () => {
    const s = buildStatement(movements);
    expect(s.openingBalanceMinor).toBe(0);
    expect(s.rows.map((r) => [r.id, r.debitMinor, r.creditMinor, r.balanceMinor])).toEqual([
      ['1', 10_000, 0, 10_000],
      ['2', 50_000, 0, 60_000],
      ['3', 0, 30_000, 30_000],
      ['4', 0, 5_000, 25_000],
      ['5', 2_000, 0, 27_000],
    ]);
    expect(s.totalDebitMinor).toBe(62_000);
    expect(s.totalCreditMinor).toBe(35_000);
    expect(s.closingBalanceMinor).toBe(27_000);
  });

  it('carries movements before the range forward and ignores those after it', () => {
    const s = buildStatement(movements, { from: '2026-03-01', to: '2026-03-31' });
    expect(s.openingBalanceMinor).toBe(60_000);
    expect(s.rows.map((r) => r.id)).toEqual(['3', '4']);
    expect(s.rows[0]!.balanceMinor).toBe(30_000);
    expect(s.closingBalanceMinor).toBe(25_000);
  });

  it('keeps the carried balance when the range has no movements', () => {
    const s = buildStatement(movements, { from: '2026-05-01' });
    expect(s.rows).toEqual([]);
    expect(s.openingBalanceMinor).toBe(27_000);
    expect(s.closingBalanceMinor).toBe(27_000);
  });

  it('treats a payable opening as credit', () => {
    const s = buildStatement([m('1', '2026-01-01', 'opening', 4_000, 'payable')]);
    expect(s.rows[0]).toMatchObject({ debitMinor: 0, creditMinor: 4_000, balanceMinor: -4_000 });
    expect(balanceSide(s.closingBalanceMinor)).toBe('credit');
  });
});

describe('balanceSide', () => {
  it('marks debit, credit or nothing', () => {
    expect(balanceSide(1)).toBe('debit');
    expect(balanceSide(-1)).toBe('credit');
    expect(balanceSide(0)).toBeNull();
  });
});

describe('statementPeriod', () => {
  it('uses the first movement and today for open ends', () => {
    expect(statementPeriod(movements, {}, '2026-10-21')).toEqual({
      from: '2026-01-05',
      to: '2026-10-21',
    });
    expect(statementPeriod([], {}, '2026-10-21')).toEqual({ from: '2026-10-21', to: '2026-10-21' });
    expect(
      statementPeriod(movements, { from: '2026-10-01', to: '2026-10-31' }, '2026-10-21'),
    ).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });
});

describe('file names', () => {
  it('folds Turkish letters and strips unsafe characters', () => {
    expect(fileNamePart('Şükrü Öztürk / İnşaat Ltd. Şti.')).toBe('Sukru_Ozturk_Insaat_Ltd_Sti');
    expect(fileNamePart('  ***  ')).toBe('');
  });

  it('builds the statement file name', () => {
    expect(exportFileName(['Ekstre', 'Ahmet Yılmaz', '2026-10-21'], 'pdf')).toBe(
      'Ekstre_Ahmet_Yilmaz_2026-10-21.pdf',
    );
    expect(exportFileName(['', '***'], 'xlsx')).toBe('Tabulo.xlsx');
  });
});
