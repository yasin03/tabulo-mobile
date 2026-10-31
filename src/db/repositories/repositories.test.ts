/** @jest-environment node */
import type { DomainErrorCode } from '@/core/errors';
import {
  accountBalance,
  contactBalance,
  type LedgerMovement,
  type MovementType,
} from '@/core/ledger';

import { createSeededTestDb } from '../testing';

type Ctx = ReturnType<typeof createSeededTestDb>;

const DATE = '2026-10-19';

async function expectDomainError(promise: Promise<unknown>, code: DomainErrorCode) {
  await expect(promise).rejects.toMatchObject({ name: 'DomainError', code });
}

async function setup() {
  const ctx = createSeededTestDb();
  const [cash] = await ctx.accountsRepo.list();
  const income = await ctx.transactionTypesRepo.list({ direction: 'income' });
  const expense = await ctx.transactionTypesRepo.list({ direction: 'expense' });
  const [general] = await ctx.subjectsRepo.list();
  return { ...ctx, cash: cash!, income, expense, general: general! };
}

function customer(ctx: Ctx, name = 'Ahmet Yılmaz') {
  return ctx.contactsRepo.create({ personType: 'individual', role: 'customer', name });
}

describe('contactsRepo', () => {
  it('ekler, okur, kişi türüne ait olmayan kimlik alanlarını temizler', async () => {
    const ctx = await setup();
    const id = await ctx.contactsRepo.create({
      personType: 'individual',
      role: 'customer',
      name: '  Ayşe Demir ',
      nationalId: '10000000146',
      taxNumber: '1234567890', // şahısta tutulmaz
      phone: '',
    });
    const contact = await ctx.contactsRepo.getById(id);
    expect(contact).toEqual(
      expect.objectContaining({
        name: 'Ayşe Demir',
        nationalId: '10000000146',
        taxNumber: null,
        phone: null,
        status: 'active',
      }),
    );

    await ctx.contactsRepo.update(id, { personType: 'company', taxNumber: '1234567890' });
    expect(await ctx.contactsRepo.getById(id)).toEqual(
      expect.objectContaining({ personType: 'company', nationalId: null, taxNumber: '1234567890' }),
    );
  });

  it('update updated_at alanını yeniler', async () => {
    const ctx = await setup();
    const id = await customer(ctx);
    const before = await ctx.contactsRepo.getById(id);
    await new Promise((r) => setTimeout(r, 5));
    await ctx.contactsRepo.update(id, { note: 'Not' });
    const after = await ctx.contactsRepo.getById(id);
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
    expect(after.createdAt).toEqual(before.createdAt);
  });

  it('boş ad reddedilir', async () => {
    const ctx = await setup();
    await expectDomainError(customer(ctx, '   '), 'nameRequired');
  });

  it('açılış bakiyesi verilirse Devir hareketi oluşturur', async () => {
    const ctx = await setup();
    const id = await ctx.contactsRepo.create(
      { personType: 'company', role: 'supplier', name: 'Toptan A.Ş.' },
      { amountMinor: 120000, direction: 'payable', date: DATE },
    );
    const [opening] = await ctx.transactionsRepo.list({ contactId: id });
    expect(opening).toEqual(
      expect.objectContaining({
        movementType: 'opening',
        openingDirection: 'payable',
        amountMinor: 120000,
        accountId: null,
        currency: 'TRY',
      }),
    );
    expect(await ctx.contactsRepo.balance(id)).toBe(-120000);
  });

  it('açılış bakiyesi geçersizse cari de eklenmez (tek transaction)', async () => {
    const ctx = await setup();
    await expectDomainError(
      ctx.contactsRepo.create(
        { personType: 'individual', role: 'customer', name: 'Yarım Kayıt' },
        { amountMinor: 0, direction: 'receivable', date: DATE },
      ),
      'amountNotPositive',
    );
    expect(await ctx.contactsRepo.list({ status: 'all' })).toHaveLength(0);
  });

  it('hareketi olan cari silinemez, olmayan silinir ve geri alınır', async () => {
    const ctx = await setup();
    const used = await customer(ctx, 'Kullanılan');
    const unused = await customer(ctx, 'Boş');
    await ctx.transactionsRepo.create({
      movementType: 'credit_sale',
      contactId: used,
      amountMinor: 1000,
      date: DATE,
    });

    await expectDomainError(ctx.contactsRepo.softDelete(used), 'contactHasTransactions');

    await ctx.contactsRepo.softDelete(unused);
    await expectDomainError(ctx.contactsRepo.getById(unused), 'notFound');
    await ctx.contactsRepo.restore(unused);
    expect((await ctx.contactsRepo.getById(unused)).name).toBe('Boş');
  });

  it('liste: durum, rol, arama, borçlular ve sıralama', async () => {
    const ctx = await setup();
    const a = await ctx.contactsRepo.create({
      personType: 'individual',
      role: 'customer',
      name: 'Cem',
    });
    const b = await ctx.contactsRepo.create({
      personType: 'company',
      role: 'supplier',
      name: 'Bora Ltd',
    });
    const c = await ctx.contactsRepo.create({
      personType: 'company',
      role: 'both',
      name: 'ayaz_%',
    });
    const d = await ctx.contactsRepo.create({
      personType: 'individual',
      role: 'customer',
      name: 'Deniz',
    });
    await ctx.contactsRepo.setStatus(d, 'passive');

    await ctx.transactionsRepo.create({
      movementType: 'credit_sale',
      contactId: a,
      amountMinor: 500,
      date: '2026-10-01',
    });
    await ctx.transactionsRepo.create({
      movementType: 'credit_purchase',
      contactId: b,
      amountMinor: 300,
      date: '2026-10-05',
    });
    await ctx.transactionsRepo.create({
      movementType: 'credit_sale',
      contactId: c,
      amountMinor: 900,
      date: '2026-09-01',
    });

    const names = (rows: { name: string }[]) => rows.map((r) => r.name);

    expect(names(await ctx.contactsRepo.list())).toEqual(['ayaz_%', 'Bora Ltd', 'Cem']);
    expect(names(await ctx.contactsRepo.list({ status: 'passive' }))).toEqual(['Deniz']);
    expect(await ctx.contactsRepo.list({ status: 'all' })).toHaveLength(4);
    expect(names(await ctx.contactsRepo.list({ role: 'customer' }))).toEqual(['ayaz_%', 'Cem']);
    expect(names(await ctx.contactsRepo.list({ role: 'supplier' }))).toEqual([
      'ayaz_%',
      'Bora Ltd',
    ]);
    expect(names(await ctx.contactsRepo.list({ search: 'ltd' }))).toEqual(['Bora Ltd']);
    expect(names(await ctx.contactsRepo.list({ search: '_%' }))).toEqual(['ayaz_%']); // LIKE joker karakterleri kaçırılır
    expect(names(await ctx.contactsRepo.list({ balance: 'receivable' }))).toEqual([
      'ayaz_%',
      'Cem',
    ]);
    expect(names(await ctx.contactsRepo.list({ balance: 'payable' }))).toEqual(['Bora Ltd']);
    expect(names(await ctx.contactsRepo.list({ sort: 'balance' }))).toEqual([
      'ayaz_%',
      'Cem',
      'Bora Ltd',
    ]);
    expect(names(await ctx.contactsRepo.list({ sort: 'lastActivity' }))).toEqual([
      'Bora Ltd',
      'Cem',
      'ayaz_%',
    ]);

    const cem = (await ctx.contactsRepo.list()).find((r) => r.id === a)!;
    expect(cem.balanceMinor).toBe(500);
    expect(cem.lastActivityDate).toBe('2026-10-01');
  });

  it('arama ve sıralama Türkçeye duyarlı', async () => {
    const ctx = await setup();
    for (const name of ['Zeynep', 'Şahin Işık', 'Çetin', 'Cem', 'İsmail', 'Irmak']) {
      await customer(ctx, name);
    }
    const names = async (search?: string) =>
      (await ctx.contactsRepo.list({ search })).map((r) => r.name);

    expect(await names()).toEqual(['Cem', 'Çetin', 'Irmak', 'İsmail', 'Şahin Işık', 'Zeynep']);
    expect(await names('sahin isik')).toEqual(['Şahin Işık']);
    expect(await names('IŞIK')).toEqual(['Şahin Işık']);
    expect(await names('ismail')).toEqual(['İsmail']);
    // Katlama iki yönlü: "çe" ile "ce" aynı aranır.
    expect(await names('çe')).toEqual(['Cem', 'Çetin']);
  });

  it('totals: toplam alacak, borç ve net (pasif cariler dahil, silinen hareketler hariç)', async () => {
    const ctx = await setup();
    const a = await customer(ctx, 'A');
    const b = await customer(ctx, 'B');
    const c = await customer(ctx, 'C');
    await ctx.transactionsRepo.create({
      movementType: 'credit_sale',
      contactId: a,
      amountMinor: 450000,
      date: DATE,
    });
    await ctx.transactionsRepo.create({
      movementType: 'credit_purchase',
      contactId: b,
      amountMinor: 120000,
      date: DATE,
    });
    await ctx.transactionsRepo.create({
      movementType: 'credit_sale',
      contactId: c,
      amountMinor: 1000,
      date: DATE,
    });
    const deleted = await ctx.transactionsRepo.create({
      movementType: 'credit_sale',
      contactId: c,
      amountMinor: 99999,
      date: DATE,
    });
    await ctx.transactionsRepo.softDelete(deleted);
    await ctx.contactsRepo.setStatus(c, 'passive');

    expect(await ctx.contactsRepo.totals()).toEqual({
      receivableMinor: 451000,
      payableMinor: 120000,
      netMinor: 331000,
    });
  });

  it('totals: hiç hareket yokken sıfır', async () => {
    const ctx = await setup();
    expect(await ctx.contactsRepo.totals()).toEqual({
      receivableMinor: 0,
      payableMinor: 0,
      netMinor: 0,
    });
  });

  it('countActive pasifleri saymaz', async () => {
    const ctx = await setup();
    await customer(ctx, 'A');
    const b = await customer(ctx, 'B');
    await ctx.contactsRepo.setStatus(b, 'passive');
    expect(await ctx.contactsRepo.countActive()).toBe(1);
    expect(await ctx.contactsRepo.count()).toBe(2);
  });
});

describe('transactionsRepo', () => {
  it('hareket tipi kurallarını uygular', async () => {
    const ctx = await setup();
    const contactId = await customer(ctx);

    await expectDomainError(
      ctx.transactionsRepo.create({ movementType: 'collection', amountMinor: 100, date: DATE }),
      'accountRequired',
    );
    await expectDomainError(
      ctx.transactionsRepo.create({
        movementType: 'credit_sale',
        accountId: ctx.cash.id,
        contactId,
        amountMinor: 100,
        date: DATE,
      }),
      'accountNotAllowed',
    );
    await expectDomainError(
      ctx.transactionsRepo.create({
        movementType: 'opening',
        contactId,
        amountMinor: 100,
        date: DATE,
      }),
      'openingDirectionRequired',
    );
  });

  it('carisiz tahsilat (faiz geliri gibi) eklenebilir; varsayılan para birimi profilden', async () => {
    const ctx = await setup();
    const interest = ctx.income.find((t) => t.name === 'Faiz Geliri')!;
    const id = await ctx.transactionsRepo.create({
      movementType: 'collection',
      accountId: ctx.cash.id,
      transactionTypeId: interest.id,
      subjectId: ctx.general.id,
      amountMinor: 2500,
      date: DATE,
      description: '  ',
    });
    expect(await ctx.transactionsRepo.getById(id)).toEqual(
      expect.objectContaining({ contactId: null, currency: 'TRY', description: null }),
    );
  });

  it('işlem türünün yönü hareket tipine uymalı (Tahsilat → gelir, Ödeme → gider)', async () => {
    const ctx = await setup();
    await expectDomainError(
      ctx.transactionsRepo.create({
        movementType: 'collection',
        accountId: ctx.cash.id,
        transactionTypeId: ctx.expense[0]!.id,
        amountMinor: 100,
        date: DATE,
      }),
      'transactionTypeMismatch',
    );
    await expectDomainError(
      ctx.transactionsRepo.create({
        movementType: 'credit_purchase',
        contactId: await customer(ctx),
        transactionTypeId: ctx.income[0]!.id,
        amountMinor: 100,
        date: DATE,
      }),
      'transactionTypeMismatch',
    );
  });

  it('pasif cari yeni harekette seçilemez; eski hareketi düzenlenebilir', async () => {
    const ctx = await setup();
    const contactId = await customer(ctx);
    const txId = await ctx.transactionsRepo.create({
      movementType: 'credit_sale',
      contactId,
      amountMinor: 1000,
      date: DATE,
    });
    await ctx.contactsRepo.setStatus(contactId, 'passive');

    await expectDomainError(
      ctx.transactionsRepo.create({
        movementType: 'credit_sale',
        contactId,
        amountMinor: 1000,
        date: DATE,
      }),
      'contactPassive',
    );

    await ctx.transactionsRepo.update(txId, {
      movementType: 'credit_sale',
      contactId,
      amountMinor: 2000,
      date: DATE,
    });
    expect((await ctx.transactionsRepo.getById(txId)).amountMinor).toBe(2000);
    expect(await ctx.contactsRepo.balance(contactId)).toBe(2000);
  });

  it('pasif hesap yeni harekette seçilemez', async () => {
    const ctx = await setup();
    await ctx.accountsRepo.setStatus(ctx.cash.id, 'passive');
    await expectDomainError(
      ctx.transactionsRepo.create({
        movementType: 'payment',
        accountId: ctx.cash.id,
        amountMinor: 100,
        date: DATE,
      }),
      'accountPassive',
    );
  });

  it('olmayan cari/hesap reddedilir', async () => {
    const ctx = await setup();
    await expectDomainError(
      ctx.transactionsRepo.create({
        movementType: 'credit_sale',
        contactId: 'yok',
        amountMinor: 100,
        date: DATE,
      }),
      'notFound',
    );
  });

  it('tip değişince tipe ait olmayan alanlar temizlenir', async () => {
    const ctx = await setup();
    const contactId = await customer(ctx);
    const id = await ctx.transactionsRepo.create({
      movementType: 'credit_sale',
      contactId,
      amountMinor: 1000,
      date: DATE,
      dueDate: '2026-11-01',
    });
    await ctx.transactionsRepo.update(id, {
      movementType: 'collection',
      accountId: ctx.cash.id,
      contactId,
      amountMinor: 1000,
      date: DATE,
    });
    expect(await ctx.transactionsRepo.getById(id)).toEqual(
      expect.objectContaining({
        movementType: 'collection',
        dueDate: null,
        accountId: ctx.cash.id,
      }),
    );
  });

  it('yumuşak silme ve geri alma bakiyeye yansır', async () => {
    const ctx = await setup();
    const contactId = await customer(ctx);
    const id = await ctx.transactionsRepo.create({
      movementType: 'credit_sale',
      contactId,
      amountMinor: 1000,
      date: DATE,
    });

    await ctx.transactionsRepo.softDelete(id);
    expect(await ctx.contactsRepo.balance(contactId)).toBe(0);
    expect(await ctx.transactionsRepo.list({ contactId })).toHaveLength(0);
    await expectDomainError(ctx.transactionsRepo.getById(id), 'notFound');

    await ctx.transactionsRepo.restore(id);
    expect(await ctx.contactsRepo.balance(contactId)).toBe(1000);
  });

  it('list: filtreler ve en yeniden eskiye sıralama', async () => {
    const ctx = await setup();
    const contactId = await customer(ctx);
    const make = (movementType: MovementType, date: string) =>
      ctx.transactionsRepo.create(
        movementType === 'collection'
          ? { movementType, accountId: ctx.cash.id, contactId, amountMinor: 100, date }
          : { movementType: 'credit_sale', contactId, amountMinor: 100, date },
      );
    await make('credit_sale', '2026-09-30');
    await make('collection', '2026-10-01');
    await make('credit_sale', '2026-10-15');
    await make('collection', '2026-11-01');

    const dates = (rows: { date: string }[]) => rows.map((r) => r.date);
    expect(dates(await ctx.transactionsRepo.list())).toEqual([
      '2026-11-01',
      '2026-10-15',
      '2026-10-01',
      '2026-09-30',
    ]);
    expect(
      dates(await ctx.transactionsRepo.list({ from: '2026-10-01', to: '2026-10-31' })),
    ).toEqual(['2026-10-15', '2026-10-01']);
    expect(dates(await ctx.transactionsRepo.list({ movementTypes: ['collection'] }))).toEqual([
      '2026-11-01',
      '2026-10-01',
    ]);
    expect(dates(await ctx.transactionsRepo.list({ accountId: ctx.cash.id, limit: 1 }))).toEqual([
      '2026-11-01',
    ]);
    expect(dates(await ctx.transactionsRepo.list({ limit: 2, offset: 1 }))).toEqual([
      '2026-10-15',
      '2026-10-01',
    ]);
  });

  it('listForContact: yürüyen bakiye kronolojik biriktirilir, en yeni üstte döner', async () => {
    const ctx = await setup();
    const contactId = await ctx.contactsRepo.create(
      { personType: 'individual', role: 'customer', name: 'Ahmet' },
      { amountMinor: 1000, direction: 'receivable', date: '2026-01-01' },
    );
    await ctx.transactionsRepo.create({
      movementType: 'collection',
      accountId: ctx.cash.id,
      contactId,
      amountMinor: 300,
      date: '2026-03-01',
    });
    await ctx.transactionsRepo.create({
      movementType: 'credit_sale',
      contactId,
      amountMinor: 5000,
      date: '2026-02-01',
    });

    const rows = await ctx.transactionsRepo.listForContact(contactId);
    expect(rows.map((r) => [r.date, r.runningBalanceMinor])).toEqual([
      ['2026-03-01', 5700],
      ['2026-02-01', 6000],
      ['2026-01-01', 1000],
    ]);
  });
});

describe('accountsRepo', () => {
  it('bakiye = açılış + tahsilat − ödeme; veresiye etkilemez', async () => {
    const ctx = await setup();
    const bank = await ctx.accountsRepo.create({
      name: 'Ziraat',
      type: 'bank',
      bankName: 'Ziraat Bankası',
      iban: ' ',
      openingBalanceMinor: 100000,
    });
    const contactId = await customer(ctx);
    await ctx.transactionsRepo.create({
      movementType: 'collection',
      accountId: bank,
      amountMinor: 25000,
      date: DATE,
    });
    await ctx.transactionsRepo.create({
      movementType: 'payment',
      accountId: bank,
      amountMinor: 5000,
      date: DATE,
    });
    await ctx.transactionsRepo.create({
      movementType: 'payment',
      accountId: ctx.cash.id,
      amountMinor: 700,
      date: DATE,
    });
    await ctx.transactionsRepo.create({
      movementType: 'credit_sale',
      contactId,
      amountMinor: 99999,
      date: DATE,
    });

    expect(await ctx.accountsRepo.balance(bank)).toBe(120000);
    expect(await ctx.accountsRepo.balance(ctx.cash.id)).toBe(-700);
    expect((await ctx.accountsRepo.getById(bank)).iban).toBeNull();

    const list = await ctx.accountsRepo.listWithBalances();
    expect(list.map((a) => [a.name, a.balanceMinor])).toEqual([
      ['Kasa', -700],
      ['Banka', 0],
      ['Ziraat', 120000],
    ]);
  });

  it('hareketi olan hesap silinemez', async () => {
    const ctx = await setup();
    await ctx.transactionsRepo.create({
      movementType: 'collection',
      accountId: ctx.cash.id,
      amountMinor: 100,
      date: DATE,
    });
    await expectDomainError(ctx.accountsRepo.softDelete(ctx.cash.id), 'accountHasTransactions');

    const empty = await ctx.accountsRepo.create({ name: 'Boş', type: 'bank' });
    await ctx.accountsRepo.softDelete(empty);
    expect(await ctx.accountsRepo.list({ includePassive: true })).toHaveLength(2);
  });

  it('countActive tipe göre sayar; sıralama yeniden yazılabilir', async () => {
    const ctx = await setup();
    const bank = await ctx.accountsRepo.create({ name: 'Ziraat', type: 'bank' });
    expect(await ctx.accountsRepo.countActive()).toEqual({ cash: 1, bank: 2 });

    const defaultBank = (await ctx.accountsRepo.list()).find((a) => a.name === 'Banka')!;
    await ctx.accountsRepo.reorder([bank, defaultBank.id, ctx.cash.id]);
    expect((await ctx.accountsRepo.list()).map((a) => a.name)).toEqual(['Ziraat', 'Banka', 'Kasa']);
  });
});

describe('transactionTypesRepo / subjectsRepo', () => {
  it('hazır kayıt yeniden adlandırılır ve pasife alınır ama silinemez', async () => {
    const ctx = await setup();
    const sales = ctx.income[0]!;
    await ctx.transactionTypesRepo.rename(sales.id, 'Mal Satışı');
    await ctx.transactionTypesRepo.setStatus(sales.id, 'passive');
    await expectDomainError(
      ctx.transactionTypesRepo.softDelete(sales.id),
      'systemRecordNotDeletable',
    );

    expect(
      (await ctx.transactionTypesRepo.list({ direction: 'income' })).map((t) => t.name),
    ).not.toContain('Mal Satışı');
    expect(await ctx.transactionTypesRepo.getById(sales.id)).toEqual(
      expect.objectContaining({ name: 'Mal Satışı', status: 'passive' }),
    );

    await expectDomainError(
      ctx.subjectsRepo.softDelete(ctx.general.id),
      'systemRecordNotDeletable',
    );
  });

  it('yeni kayıt kendi yönünün sonuna eklenir ve silinebilir', async () => {
    const ctx = await setup();
    const id = await ctx.transactionTypesRepo.create({ name: 'Komisyon', direction: 'income' });
    const incomes = await ctx.transactionTypesRepo.list({ direction: 'income' });
    expect(incomes.at(-1)).toEqual(expect.objectContaining({ id, sortOrder: 6, isSystem: false }));

    await ctx.transactionTypesRepo.softDelete(id);
    expect(await ctx.transactionTypesRepo.list({ direction: 'income' })).toHaveLength(6);
  });

  it('pasif işlem türü ve konu yeni harekette seçilemez', async () => {
    const ctx = await setup();
    const fuel = ctx.expense.find((t) => t.name === 'Yakıt')!;
    await ctx.transactionTypesRepo.setStatus(fuel.id, 'passive');
    await ctx.subjectsRepo.setStatus(ctx.general.id, 'passive');
    const base = {
      movementType: 'payment',
      accountId: ctx.cash.id,
      amountMinor: 100,
      date: DATE,
    } as const;

    await expectDomainError(
      ctx.transactionsRepo.create({ ...base, transactionTypeId: fuel.id }),
      'transactionTypePassive',
    );
    await expectDomainError(
      ctx.transactionsRepo.create({ ...base, subjectId: ctx.general.id }),
      'subjectPassive',
    );
  });

  it('konular sıralanabilir', async () => {
    const ctx = await setup();
    const all = await ctx.subjectsRepo.list();
    await ctx.subjectsRepo.reorder([...all].reverse().map((s) => s.id));
    expect((await ctx.subjectsRepo.list()).map((s) => s.name)).toEqual([
      'Diğer',
      'Ofis',
      'Araç',
      'Genel',
    ]);
  });
});

describe('businessProfileRepo', () => {
  it('okur ve günceller', async () => {
    const ctx = await setup();
    await ctx.businessProfileRepo.update({ name: ' Yılmaz Ticaret ', phone: '' });
    expect(await ctx.businessProfileRepo.get()).toEqual(
      expect.objectContaining({ name: 'Yılmaz Ticaret', phone: null, currency: 'TRY' }),
    );
  });

  it('kayıt yokken para birimi kur olmadan değişir', async () => {
    const ctx = await setup();
    expect(await ctx.businessProfileRepo.needsConversion()).toBe(false);
    await ctx.businessProfileRepo.changeCurrency('GBP', null);
    expect(await ctx.businessProfileRepo.currency()).toBe('GBP');
  });

  it('tüm tutarları tek kurla çevirir; kapalı cari kapalı kalır, silinmiş hareket de çevrilir', async () => {
    const ctx = await setup();
    const contactId = await customer(ctx);
    await ctx.accountsRepo.update(ctx.cash.id, { openingBalanceMinor: 1_000_000 });
    await ctx.transactionsRepo.create({
      movementType: 'credit_sale',
      contactId,
      amountMinor: 500_000,
      date: '2026-10-01',
    });
    await ctx.transactionsRepo.create({
      movementType: 'collection',
      contactId,
      accountId: ctx.cash.id,
      amountMinor: 500_000,
      date: '2026-10-20',
    });
    const deleted = await ctx.transactionsRepo.create({
      movementType: 'payment',
      accountId: ctx.cash.id,
      amountMinor: 49_553,
      date: '2026-10-20',
    });
    await ctx.transactionsRepo.softDelete(deleted);

    expect(await ctx.businessProfileRepo.needsConversion()).toBe(true);
    await expect(ctx.businessProfileRepo.changeCurrency('USD', null)).rejects.toMatchObject({
      code: 'exchangeRateRequired',
    });

    const rate = { base: 'USD', quote: 'TRY', micro: 49_553_000 } as const; // 1 $ = 49,553 ₺
    await ctx.businessProfileRepo.changeCurrency('USD', rate);

    expect(await ctx.businessProfileRepo.currency()).toBe('USD');
    expect(await ctx.contactsRepo.balance(contactId)).toBe(0);
    expect((await ctx.accountsRepo.getById(ctx.cash.id)).openingBalanceMinor).toBe(20_180);
    expect(await ctx.accountsRepo.balance(ctx.cash.id)).toBe(20_180 + 10_090);
    const all = await ctx.transactionsRepo.list();
    expect(all.every((x) => x.currency === 'USD')).toBe(true);
    await ctx.transactionsRepo.restore(deleted);
    expect((await ctx.transactionsRepo.getById(deleted)).amountMinor).toBe(1_000);
  });

  it('dönüşüm sınırı aşarsa hiçbir şey değişmez', async () => {
    const ctx = await setup();
    await ctx.transactionsRepo.create({
      movementType: 'payment',
      accountId: ctx.cash.id,
      amountMinor: 9_000_000_000_000,
      date: DATE,
    });
    await expect(
      ctx.businessProfileRepo.changeCurrency('USD', {
        base: 'TRY',
        quote: 'USD',
        micro: 2_000_000,
      }),
    ).rejects.toMatchObject({ code: 'conversionOverflow' });
    expect(await ctx.businessProfileRepo.currency()).toBe('TRY');
    expect((await ctx.transactionsRepo.list())[0]!.amountMinor).toBe(9_000_000_000_000);
  });
});

describe('Faz 4: özet kartı ve vadesi gelen alacaklar', () => {
  it('totals(asOf) seçilen günün sonundaki durumu verir', async () => {
    const ctx = await setup();
    const a = await customer(ctx, 'A');
    const b = await customer(ctx, 'B');
    await ctx.transactionsRepo.create({
      movementType: 'credit_sale',
      contactId: a,
      amountMinor: 1000,
      date: '2026-09-10',
    });
    await ctx.transactionsRepo.create({
      movementType: 'credit_purchase',
      contactId: b,
      amountMinor: 300,
      date: '2026-10-05',
    });
    expect(await ctx.contactsRepo.totals('2026-09-30')).toEqual({
      receivableMinor: 1000,
      payableMinor: 0,
      netMinor: 1000,
    });
    expect(await ctx.contactsRepo.totals()).toEqual({
      receivableMinor: 1000,
      payableMinor: 300,
      netMinor: 700,
    });
    expect(await ctx.transactionsRepo.firstDate()).toBe('2026-09-10');
  });

  it('dueReceivables: FIFO ile açık kalan, vadesi geçmiş veya 7 gün içindeki alacaklar', async () => {
    const ctx = await setup();
    const a = await customer(ctx, 'Ahmet');
    const b = await customer(ctx, 'Burak');
    const sale = (contactId: string, amountMinor: number, date: string, dueDate: string) =>
      ctx.transactionsRepo.create({
        movementType: 'credit_sale',
        contactId,
        amountMinor,
        date,
        dueDate,
      });
    await sale(a, 3000, '2026-10-01', '2026-10-15'); // geçmiş ama tahsil edildi
    const open = await sale(a, 2000, '2026-10-02', '2026-10-22'); // 2 gün sonra
    await sale(a, 1000, '2026-10-03', '2026-11-30'); // çok ileride
    await ctx.transactionsRepo.create({
      movementType: 'collection',
      contactId: a,
      accountId: ctx.cash.id,
      amountMinor: 3500,
      date: '2026-10-10',
    });
    const overdue = await sale(b, 700, '2026-09-01', '2026-09-30');

    expect(await ctx.transactionsRepo.dueReceivables('2026-10-20')).toEqual([
      {
        contactId: b,
        contactName: 'Burak',
        personType: 'individual',
        transactionId: overdue,
        dueDate: '2026-09-30',
        remainingMinor: 700,
      },
      {
        contactId: a,
        contactName: 'Ahmet',
        personType: 'individual',
        transactionId: open,
        dueDate: '2026-10-22',
        remainingMinor: 1500,
      },
    ]);
  });
});

describe('SQL bakiyeleri saf ledger fonksiyonlarıyla aynı sonucu verir', () => {
  /** Tekrarlanabilir sözde rastgele sayı üreteci (mulberry32). */
  function rng(seed: number) {
    let a = seed;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it.each([1, 2, 3])('rastgele 200 hareket (tohum %i)', async (seed) => {
    const random = rng(seed);
    const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)]!;

    const ctx = await setup();
    const bank = await ctx.accountsRepo.create({
      name: 'Banka',
      type: 'bank',
      openingBalanceMinor: 50000,
    });
    const accountIds = [ctx.cash.id, bank];
    const contactIds = await Promise.all(['A', 'B', 'C', 'D'].map((n) => customer(ctx, n)));

    const byContact = new Map<string, LedgerMovement[]>();
    const byAccount = new Map<string, LedgerMovement[]>();
    const types: MovementType[] = [
      'collection',
      'payment',
      'credit_sale',
      'credit_purchase',
      'opening',
    ];

    for (let i = 0; i < 200; i++) {
      const movementType = pick(types);
      const amountMinor = 1 + Math.floor(random() * 1_000_000);
      const hasAccount = movementType === 'collection' || movementType === 'payment';
      const contactId = hasAccount && random() < 0.3 ? null : pick(contactIds);
      const accountId = hasAccount ? pick(accountIds) : null;
      const openingDirection =
        movementType === 'opening' ? pick(['receivable', 'payable'] as const) : null;
      // Geçersiz yerde (veresiye, carisiz) de verilir; repository `false`'a çekmeli.
      const isCash = random() < 0.4;

      const id = await ctx.transactionsRepo.create({
        movementType,
        amountMinor,
        date: DATE,
        contactId,
        accountId,
        openingDirection,
        isCash,
      });
      const stored = (await ctx.transactionsRepo.getById(id)).isCash;
      expect(stored).toBe(isCash && hasAccount && contactId !== null);

      // Bazı hareketler silinir; bakiyeye girmemeli.
      if (random() < 0.1) {
        await ctx.transactionsRepo.softDelete(id);
        continue;
      }
      const movement = { movementType, amountMinor, openingDirection, isCash: stored };
      if (contactId) byContact.set(contactId, [...(byContact.get(contactId) ?? []), movement]);
      if (accountId) byAccount.set(accountId, [...(byAccount.get(accountId) ?? []), movement]);
    }

    for (const contactId of contactIds) {
      const expected = contactBalance(byContact.get(contactId) ?? []);
      expect(await ctx.contactsRepo.balance(contactId)).toBe(expected);
    }
    expect(await ctx.accountsRepo.balance(ctx.cash.id)).toBe(
      accountBalance(0, byAccount.get(ctx.cash.id) ?? []),
    );
    expect(await ctx.accountsRepo.balance(bank)).toBe(
      accountBalance(50000, byAccount.get(bank) ?? []),
    );

    const balances = contactIds.map((id) => contactBalance(byContact.get(id) ?? []));
    const receivableMinor = balances.filter((b) => b > 0).reduce((s, b) => s + b, 0);
    const payableMinor = -balances.filter((b) => b < 0).reduce((s, b) => s + b, 0);
    expect(await ctx.contactsRepo.totals()).toEqual({
      receivableMinor,
      payableMinor,
      netMinor: receivableMinor - payableMinor,
    });
  });
});

describe('transactionsRepo – Faz 3 (liste, detay, belgeler)', () => {
  it('search: adlarla zenginleştirir, filtreler ve açıklama/belge no ile arar', async () => {
    const ctx = await setup();
    const contactId = await customer(ctx);
    const sales = ctx.income.find((x) => x.name === 'Satış')!;
    const saleId = await ctx.transactionsRepo.create({
      movementType: 'credit_sale',
      contactId,
      amountMinor: 3000,
      date: '2026-10-02',
      transactionTypeId: sales.id,
      subjectId: ctx.general.id,
      description: 'Mutfak tadilatı',
      documentNo: 'F-2026-01',
    });
    await ctx.transactionsRepo.create({
      movementType: 'collection',
      accountId: ctx.cash.id,
      contactId,
      amountMinor: 1500,
      date: '2026-10-12',
      description: 'Nakit tahsilat',
    });
    await ctx.transactionsRepo.create({
      movementType: 'payment',
      accountId: ctx.cash.id,
      amountMinor: 200,
      date: '2026-09-30',
      transactionTypeId: ctx.expense[0]!.id,
    });

    const all = await ctx.transactionsRepo.search();
    expect(await ctx.transactionsRepo.count()).toBe(3);
    expect(all.map((x) => x.date)).toEqual(['2026-10-12', '2026-10-02', '2026-09-30']);
    expect(all.find((x) => x.id === saleId)).toEqual(
      expect.objectContaining({
        contactName: 'Ahmet Yılmaz',
        accountName: null,
        transactionTypeName: 'Satış',
        subjectName: ctx.general.name,
        attachmentCount: 0,
      }),
    );

    expect((await ctx.transactionsRepo.search({ search: 'MUTFAK' })).map((x) => x.id)).toEqual([
      saleId,
    ]);
    expect((await ctx.transactionsRepo.search({ search: 'f-2026' })).length).toBe(1);
    expect((await ctx.transactionsRepo.search({ accountId: ctx.cash.id })).length).toBe(2);
    expect((await ctx.transactionsRepo.search({ transactionTypeId: sales.id })).length).toBe(1);
    expect((await ctx.transactionsRepo.search({ subjectId: ctx.general.id })).length).toBe(1);
    expect(
      (await ctx.transactionsRepo.search({ from: '2026-10-01', to: '2026-10-31' })).length,
    ).toBe(2);
    expect(
      (await ctx.transactionsRepo.search({ movementTypes: ['payment', 'collection'] })).length,
    ).toBe(2);
  });

  it('belgelerle ekler, günceller (ekle/çıkar) ve detayda döner', async () => {
    const ctx = await setup();
    const id = await ctx.transactionsRepo.create(
      { movementType: 'payment', accountId: ctx.cash.id, amountMinor: 100, date: DATE },
      [
        { id: 'att-1', fileUri: 'attachments/att-1.jpg', mimeType: 'image/jpeg', sizeBytes: 10 },
        { id: 'att-2', fileUri: 'attachments/att-2.pdf', mimeType: 'application/pdf' },
      ],
    );
    let detail = await ctx.transactionsRepo.getDetail(id);
    expect(detail.attachmentCount).toBe(2);
    expect(detail.accountName).toBe(ctx.cash.name);
    expect(detail.attachments.map((x) => x.id)).toEqual(['att-1', 'att-2']);

    await ctx.transactionsRepo.update(
      id,
      { movementType: 'payment', accountId: ctx.cash.id, amountMinor: 150, date: DATE },
      { removeIds: ['att-1'], add: [{ id: 'att-3', fileUri: 'attachments/att-3.jpg' }] },
    );
    detail = await ctx.transactionsRepo.getDetail(id);
    expect(detail.amountMinor).toBe(150);
    expect(detail.attachments.map((x) => x.id)).toEqual(['att-2', 'att-3']);
    expect((await ctx.transactionsRepo.search())[0]!.attachmentCount).toBe(2);
    await expect(ctx.attachmentsRepo.getById('att-1')).rejects.toMatchObject({ code: 'notFound' });
    expect((await ctx.attachmentsRepo.getById('att-3')).fileUri).toBe('attachments/att-3.jpg');
  });

  it('hareket kuralları ihlal edilirse belgeler de eklenmez (tek transaction)', async () => {
    const ctx = await setup();
    await expectDomainError(
      ctx.transactionsRepo.create(
        { movementType: 'payment', amountMinor: 100, date: DATE }, // hesap yok
        [{ id: 'att-x', fileUri: 'attachments/att-x.jpg' }],
      ),
      'accountRequired',
    );
    await expect(ctx.attachmentsRepo.getById('att-x')).rejects.toMatchObject({ code: 'notFound' });
  });

  it('listForContact adları ve yürüyen bakiyeyi verir; silinen hareket düşer, geri alınca döner', async () => {
    const ctx = await setup();
    const contactId = await customer(ctx);
    const first = await ctx.transactionsRepo.create({
      movementType: 'credit_sale',
      contactId,
      amountMinor: 3000,
      date: '2026-10-02',
    });
    await ctx.transactionsRepo.create({
      movementType: 'collection',
      accountId: ctx.cash.id,
      contactId,
      amountMinor: 1000,
      date: '2026-10-05',
    });
    let rows = await ctx.transactionsRepo.listForContact(contactId);
    expect(rows.map((r) => [r.runningBalanceMinor, r.accountName])).toEqual([
      [2000, ctx.cash.name],
      [3000, null],
    ]);

    await ctx.transactionsRepo.softDelete(first);
    rows = await ctx.transactionsRepo.listForContact(contactId);
    expect(rows.map((r) => r.runningBalanceMinor)).toEqual([-1000]);
    await expect(ctx.transactionsRepo.getDetail(first)).rejects.toMatchObject({
      code: 'notFound',
    });

    await ctx.transactionsRepo.restore(first);
    expect(await ctx.contactsRepo.balance(contactId)).toBe(2000);
  });

  it('subjectsRepo.findDefault hazır "Genel" konusunu bulur', async () => {
    const ctx = await setup();
    expect((await ctx.subjectsRepo.findDefault())?.id).toBe(ctx.general.id);
    await ctx.subjectsRepo.setStatus(ctx.general.id, 'passive');
    expect(await ctx.subjectsRepo.findDefault()).toBeNull();

    const en = createSeededTestDb({ language: 'en', currency: 'GBP' });
    expect((await en.subjectsRepo.findDefault())?.name).toBe('General');
  });
});
