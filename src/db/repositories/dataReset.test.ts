/** @jest-environment node */
import { createSeededTestDb } from '../testing';

const DATE = '2026-10-19';
const OPTIONS = { language: 'tr', currency: 'TRY' } as const;

/** Cari, hareket (belgeli), düzenli ödeme, hatırlatıcı, yeni hesap ve tanım, işletme profili. */
async function populated() {
  const ctx = createSeededTestDb();
  const [cash] = await ctx.accountsRepo.list();
  const contactId = await ctx.contactsRepo.create({
    personType: 'individual',
    role: 'customer',
    name: 'Ayşe Demir',
  });
  const saleId = await ctx.transactionsRepo.create(
    { movementType: 'credit_sale', amountMinor: 150_000, date: DATE, contactId },
    [{ id: 'att-1', fileUri: 'attachments/att-1.jpg', mimeType: 'image/jpeg', sizeBytes: 1200 }],
  );
  await ctx.transactionsRepo.create({
    movementType: 'collection',
    amountMinor: 5_000,
    date: DATE,
    accountId: cash!.id,
  });
  await ctx.recurringPaymentsRepo.create({
    title: 'Kira',
    movementType: 'payment',
    amountMinor: 1_000_000,
    accountId: cash!.id,
    frequency: 'monthly',
    interval: 1,
    startDate: DATE,
    remindDaysBefore: 1,
    remindTime: '09:00',
  });
  await ctx.remindersRepo.create({
    contactId,
    transactionId: saleId,
    remindDate: '2026-12-01',
    remindTime: '10:00',
  });
  await ctx.accountsRepo.create({ name: 'Ziraat', type: 'bank' });
  await ctx.subjectsRepo.create({ name: 'Araç' });
  await ctx.businessProfileRepo.update({ name: 'Demir Ticaret', logoUri: 'logo/logo-1.jpg' });
  return ctx;
}

async function counts(ctx: Awaited<ReturnType<typeof populated>>) {
  const tables = await ctx.backupRepo.exportTables();
  return Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.length]));
}

describe('dataResetRepo.wipe', () => {
  it('yalnızca hareketler: belgeler ve düzenli ödemeler gider, cariler ve hatırlatıcılar kalır', async () => {
    const ctx = await populated();
    await ctx.dataResetRepo.wipe(['transactions'], OPTIONS);
    const n = await counts(ctx);

    expect(n).toEqual(
      expect.objectContaining({
        transactions: 0,
        attachments: 0,
        recurring_payments: 0,
        contacts: 1,
        reminders: 1,
      }),
    );
    expect((await ctx.backupRepo.exportTables()).reminders![0]!.transaction_id).toBeNull();
    expect((await ctx.accountsRepo.list()).map((a) => a.name)).toContain('Ziraat');
  });

  it('cariler seçilince hareketler de silinir', async () => {
    const ctx = await populated();
    expect(await ctx.dataResetRepo.wipe(['contacts'], OPTIONS)).toEqual([
      'transactions',
      'contacts',
    ]);
    const n = await counts(ctx);
    expect(n).toEqual(expect.objectContaining({ contacts: 0, reminders: 0, transactions: 0 }));
  });

  it('hesaplar ve tanımlar silinince varsayılanlar geri gelir', async () => {
    const ctx = await populated();
    await ctx.dataResetRepo.wipe(['accounts', 'definitions'], OPTIONS);
    const fresh = createSeededTestDb();

    const names = async (c: typeof fresh) => ({
      accounts: (await c.accountsRepo.list()).map((a) => [a.name, a.type]),
      subjects: (await c.subjectsRepo.list()).map((s) => s.name),
      types: (await c.transactionTypesRepo.list()).map((s) => [s.name, s.direction]),
    });
    expect(await names(ctx)).toEqual(await names(fresh));
  });

  it('ayarlar: işletme profili temizlenir, para birimi korunur', async () => {
    const ctx = await populated();
    await ctx.dataResetRepo.wipe(['settings'], OPTIONS);
    const profile = await ctx.businessProfileRepo.get();
    expect(profile).toEqual(expect.objectContaining({ name: '', logoUri: null, currency: 'TRY' }));
    expect((await counts(ctx)).transactions).toBe(2);
  });
});

describe('accountsRepo.listWithBalances changeOn', () => {
  it('o günün giriş − çıkışını verir', async () => {
    const ctx = createSeededTestDb();
    const [cash, bank] = await ctx.accountsRepo.list();
    const add = (
      movementType: 'collection' | 'payment',
      amountMinor: number,
      date: string,
      accountId: string,
    ) => ctx.transactionsRepo.create({ movementType, amountMinor, date, accountId });
    await add('collection', 150_000, DATE, cash!.id);
    await add('collection', 80_000, DATE, cash!.id);
    await add('payment', 64_000, DATE, bank!.id);
    await add('collection', 999_900, '2026-10-18', cash!.id);

    const list = await ctx.accountsRepo.listWithBalances({ changeOn: DATE });
    expect(list.map((a) => [a.balanceMinor, a.dayChangeMinor])).toEqual([
      [1_229_900, 230_000],
      [-64_000, -64_000],
    ]);
    expect((await ctx.accountsRepo.listWithBalances()).every((a) => a.dayChangeMinor === 0)).toBe(
      true,
    );
  });
});
