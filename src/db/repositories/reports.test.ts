/** @jest-environment node */
import { periodBuckets, periodContaining, totalsByBucket } from '@/core/periods';

import { createSeededTestDb } from '../testing';

const OCTOBER = { from: '2026-10-01', to: '2026-10-31' };

async function setup() {
  const ctx = createSeededTestDb();
  const [cash, bank] = await ctx.accountsRepo.list();
  const income = await ctx.transactionTypesRepo.list({ direction: 'income' });
  const expense = await ctx.transactionTypesRepo.list({ direction: 'expense' });
  const subjects = await ctx.subjectsRepo.list();
  const typeId = (name: string) => [...income, ...expense].find((x) => x.name === name)!.id;
  const subjectId = (name: string) => subjects.find((x) => x.name === name)!.id;
  const customer = await ctx.contactsRepo.create({
    personType: 'individual',
    role: 'both',
    name: 'Ahmet Yılmaz',
  });

  const tx = ctx.transactionsRepo;
  // Ekim
  await tx.create({
    movementType: 'collection',
    amountMinor: 150000,
    date: '2026-10-02',
    accountId: cash!.id,
    contactId: customer,
    transactionTypeId: typeId('Satış'),
  });
  await tx.create({
    movementType: 'collection',
    amountMinor: 50000,
    date: '2026-10-02',
    accountId: bank!.id,
    transactionTypeId: typeId('Faiz Geliri'),
  });
  await tx.create({
    movementType: 'payment',
    amountMinor: 64000,
    date: '2026-10-05',
    accountId: cash!.id,
    transactionTypeId: typeId('Yakıt'),
    subjectId: subjectId('Araç'),
  });
  await tx.create({
    movementType: 'payment',
    amountMinor: 36000,
    date: '2026-10-20',
    accountId: cash!.id,
    transactionTypeId: typeId('Yakıt'),
    subjectId: subjectId('Araç'),
  });
  await tx.create({
    movementType: 'payment',
    amountMinor: 120000,
    date: '2026-10-20',
    accountId: bank!.id,
    transactionTypeId: typeId('Kira'),
    subjectId: subjectId('Ofis'),
  });
  await tx.create({
    movementType: 'payment',
    amountMinor: 1000,
    date: '2026-10-21',
    accountId: cash!.id,
  });
  await tx.create({
    movementType: 'credit_sale',
    amountMinor: 450000,
    date: '2026-10-10',
    contactId: customer,
  });
  await tx.create({
    movementType: 'credit_purchase',
    amountMinor: 80000,
    date: '2026-10-11',
    contactId: customer,
  });
  await tx.create({
    movementType: 'opening',
    amountMinor: 99999,
    date: '2026-10-01',
    contactId: customer,
    openingDirection: 'receivable',
  });
  // Dönem dışı ve silinmiş
  await tx.create({
    movementType: 'collection',
    amountMinor: 777700,
    date: '2026-09-30',
    accountId: cash!.id,
  });
  const deleted = await tx.create({
    movementType: 'payment',
    amountMinor: 555500,
    date: '2026-10-15',
    accountId: cash!.id,
    transactionTypeId: typeId('Kira'),
  });
  await tx.softDelete(deleted);

  return { ...ctx, cash: cash!, bank: bank! };
}

describe('reportsRepo', () => {
  it('dönem özeti: gelir = tahsilat, gider = ödeme; devir, dönem dışı ve silinmişler hariç', async () => {
    const ctx = await setup();
    expect(await ctx.reportsRepo.summary(OCTOBER)).toEqual({
      incomeMinor: 200000,
      expenseMinor: 221000,
      netMinor: -21000,
      creditSalesMinor: 450000,
      creditPurchasesMinor: 80000,
      transactionCount: 9,
    });
  });

  it('boş dönemde sıfırlar', async () => {
    const ctx = await setup();
    expect(await ctx.reportsRepo.summary({ from: '2020-01-01', to: '2020-01-31' })).toEqual({
      incomeMinor: 0,
      expenseMinor: 0,
      netMinor: 0,
      creditSalesMinor: 0,
      creditPurchasesMinor: 0,
      transactionCount: 0,
    });
  });

  it('günlük gelir-gider ve haftalık kırılım', async () => {
    const ctx = await setup();
    const daily = await ctx.reportsRepo.dailyIncomeExpense(OCTOBER);
    expect(daily).toEqual([
      { date: '2026-10-02', incomeMinor: 200000, expenseMinor: 0 },
      { date: '2026-10-05', incomeMinor: 0, expenseMinor: 64000 },
      { date: '2026-10-20', incomeMinor: 0, expenseMinor: 156000 },
      { date: '2026-10-21', incomeMinor: 0, expenseMinor: 1000 },
    ]);

    const year = periodContaining('year', '2026-10-01', 1);
    const months = totalsByBucket(
      periodBuckets(year, 1),
      await ctx.reportsRepo.dailyIncomeExpense(year),
    );
    expect(months[8]).toMatchObject({ incomeMinor: 777700, expenseMinor: 0 });
    expect(months[9]).toMatchObject({ incomeMinor: 200000, expenseMinor: 221000 });
  });

  it('işlem türüne ve konuya göre gider dağılımı', async () => {
    const ctx = await setup();
    const byType = await ctx.reportsRepo.expensesByType(OCTOBER);
    expect(byType.map(({ name, totalMinor, count }) => [name, totalMinor, count])).toEqual([
      ['Kira', 120000, 1],
      ['Yakıt', 100000, 2],
      [null, 1000, 1],
    ]);
    const bySubject = await ctx.reportsRepo.expensesBySubject(OCTOBER);
    expect(bySubject.map(({ name, totalMinor }) => [name, totalMinor])).toEqual([
      ['Ofis', 120000],
      ['Araç', 100000],
      [null, 1000],
    ]);
  });

  it('işlem türüne göre gelir: yalnızca tahsilatlar, adetle', async () => {
    const ctx = await setup();
    const byType = await ctx.reportsRepo.incomeByType(OCTOBER);
    expect(byType.map(({ name, totalMinor, count }) => [name, totalMinor, count])).toEqual([
      ['Satış', 150000, 1],
      ['Faiz Geliri', 50000, 1],
    ]);
  });

  it('kasa ve banka dönem neti (dönem dışı ve silinmişler hariç)', async () => {
    const ctx = await setup();
    expect(await ctx.reportsRepo.cashFlowByAccountType(OCTOBER)).toEqual([
      { type: 'cash', inMinor: 150000, outMinor: 101000, netMinor: 49000 },
      { type: 'bank', inMinor: 50000, outMinor: 120000, netMinor: -70000 },
    ]);
    expect(
      await ctx.reportsRepo.cashFlowByAccountType({ from: '2020-01-01', to: '2020-01-31' }),
    ).toEqual([
      { type: 'cash', inMinor: 0, outMinor: 0, netMinor: 0 },
      { type: 'bank', inMinor: 0, outMinor: 0, netMinor: 0 },
    ]);
  });

  it('hesap bakiyeleri dönem sonuna göre', async () => {
    const ctx = await setup();
    const asOf = async (date: string) =>
      (await ctx.accountsRepo.listWithBalances({ asOf: date })).map((a) => a.balanceMinor);
    expect(await asOf('2026-09-30')).toEqual([777700, 0]);
    expect(await asOf('2026-10-05')).toEqual([777700 + 150000 - 64000, 50000]);
    expect(await asOf('2026-10-31')).toEqual([777700 + 150000 - 64000 - 36000 - 1000, -70000]);
  });
});
