import { summarizeMovements, type SummaryMovement } from './summary';

const row = (
  movementType: SummaryMovement['movementType'],
  amountMinor: number,
  type: [string, string] | null = null,
  subject: [string, string] | null = null,
): SummaryMovement => ({
  movementType,
  amountMinor,
  transactionTypeId: type?.[0] ?? null,
  transactionTypeName: type?.[1] ?? null,
  subjectId: subject?.[0] ?? null,
  subjectName: subject?.[1] ?? null,
});

describe('summarizeMovements', () => {
  it('totals each movement type like the reports do', () => {
    const s = summarizeMovements([
      row('collection', 10_000),
      row('collection', 5_000),
      row('payment', 3_000, ['fuel', 'Yakıt'], ['car', 'Araç']),
      row('credit_sale', 7_000),
      row('credit_purchase', 2_000),
      row('opening', 99_000),
    ]);
    expect(s).toMatchObject({
      count: 6,
      incomeMinor: 15_000,
      expenseMinor: 3_000,
      netMinor: 12_000,
      creditSalesMinor: 7_000,
      creditPurchasesMinor: 2_000,
    });
  });

  it('groups expenses by type and subject, largest first, only from payments', () => {
    const s = summarizeMovements([
      row('payment', 1_000, ['rent', 'Kira'], ['office', 'Ofis']),
      row('payment', 4_000, ['fuel', 'Yakıt'], ['car', 'Araç']),
      row('payment', 2_000, ['fuel', 'Yakıt'], null),
      row('collection', 50_000, ['sale', 'Satış'], ['office', 'Ofis']),
    ]);
    expect(s.expensesByType).toEqual([
      { id: 'fuel', name: 'Yakıt', totalMinor: 6_000, count: 2 },
      { id: 'rent', name: 'Kira', totalMinor: 1_000, count: 1 },
    ]);
    expect(s.expensesBySubject.map((c) => [c.id, c.totalMinor])).toEqual([
      ['car', 4_000],
      [null, 2_000],
      ['office', 1_000],
    ]);
  });
});
