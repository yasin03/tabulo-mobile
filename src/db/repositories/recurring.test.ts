/** @jest-environment node */
import type { DomainErrorCode } from '@/core/errors';

import { createSeededTestDb } from '../testing';
import type { RecurringPaymentInput } from './recurringPayments';

async function expectDomainError(promise: Promise<unknown>, code: DomainErrorCode) {
  await expect(promise).rejects.toMatchObject({ name: 'DomainError', code });
}

async function setup() {
  const ctx = createSeededTestDb();
  const [cash] = await ctx.accountsRepo.list();
  const expense = await ctx.transactionTypesRepo.list({ direction: 'expense' });
  const income = await ctx.transactionTypesRepo.list({ direction: 'income' });
  const landlord = await ctx.contactsRepo.create({
    personType: 'individual',
    role: 'supplier',
    name: 'Ev Sahibi',
  });
  const rent = (overrides: Partial<RecurringPaymentInput> = {}): RecurringPaymentInput => ({
    title: 'Dükkan kirası',
    movementType: 'payment',
    amountMinor: 850000,
    accountId: cash!.id,
    contactId: landlord,
    transactionTypeId: expense.find((t) => t.name === 'Kira')!.id,
    frequency: 'monthly',
    interval: 1,
    startDate: '2026-01-31',
    remindDaysBefore: 1,
    remindTime: '09:00',
    ...overrides,
  });
  return { ...ctx, cash: cash!, expense, income, landlord, rent };
}

describe('recurringPaymentsRepo', () => {
  it('ekler; sonraki tarih başlangıçtır; listede bağlı adlar gelir', async () => {
    const ctx = await setup();
    const id = await ctx.recurringPaymentsRepo.create(ctx.rent());
    const [item] = await ctx.recurringPaymentsRepo.list();
    expect(item).toEqual(
      expect.objectContaining({
        id,
        nextDueDate: '2026-01-31',
        status: 'active',
        accountName: 'Kasa',
        contactName: 'Ev Sahibi',
        transactionTypeName: 'Kira',
        lastPaidDate: null,
        isFinished: false,
        currency: 'TRY',
      }),
    );
  });

  it('işlem türünün yönü hareket tipine uymalı', async () => {
    const ctx = await setup();
    await expectDomainError(
      ctx.recurringPaymentsRepo.create(ctx.rent({ transactionTypeId: ctx.income[0]!.id })),
      'transactionTypeMismatch',
    );
  });

  it('Ödendi: hareket oluşur, cari bakiyesi değişir, tarih bir dönem ileri gider; geri alınabilir', async () => {
    const ctx = await setup();
    const id = await ctx.recurringPaymentsRepo.create(ctx.rent());

    const result = await ctx.recurringPaymentsRepo.markPaid(id, {
      amountMinor: 900000,
      date: '2026-02-01',
      accountId: ctx.cash.id,
    });
    expect(result).toEqual(
      expect.objectContaining({ nextDueDate: '2026-02-28', isFinished: false }),
    );
    const tx = await ctx.transactionsRepo.getById(result.transactionId);
    expect(tx).toEqual(
      expect.objectContaining({
        movementType: 'payment',
        amountMinor: 900000,
        date: '2026-02-01',
        contactId: ctx.landlord,
        description: 'Dükkan kirası',
        recurringPaymentId: id,
      }),
    );
    expect(await ctx.contactsRepo.balance(ctx.landlord)).toBe(900000);
    expect(await ctx.accountsRepo.balance(ctx.cash.id)).toBe(-900000);

    await ctx.recurringPaymentsRepo.markPaid(id, {
      amountMinor: 850000,
      date: '2026-02-28',
      accountId: ctx.cash.id,
    });
    expect((await ctx.recurringPaymentsRepo.getById(id)).nextDueDate).toBe('2026-03-31');
    expect((await ctx.recurringPaymentsRepo.getDetail(id)).lastPaidDate).toBe('2026-02-28');

    await ctx.recurringPaymentsRepo.undoPaid(id, result);
    expect((await ctx.recurringPaymentsRepo.getById(id)).nextDueDate).toBe('2026-01-31');
    await expectDomainError(ctx.transactionsRepo.getById(result.transactionId), 'notFound');
  });

  it('bitiş tarihi geçilince pasif (tamamlandı); aktife alınamaz; uzatılınca yeniden aktif', async () => {
    const ctx = await setup();
    const id = await ctx.recurringPaymentsRepo.create(
      ctx.rent({ startDate: '2026-10-01', endDate: '2026-10-31' }),
    );
    const result = await ctx.recurringPaymentsRepo.markPaid(id, {
      amountMinor: 850000,
      date: '2026-10-01',
      accountId: ctx.cash.id,
    });
    expect(result.isFinished).toBe(true);
    const [item] = await ctx.recurringPaymentsRepo.list();
    expect(item).toEqual(expect.objectContaining({ status: 'passive', isFinished: true }));
    expect(await ctx.recurringPaymentsRepo.list({ activeOnly: true })).toEqual([]);

    await expectDomainError(ctx.recurringPaymentsRepo.setStatus(id, 'active'), 'recurringEnded');
    await expectDomainError(
      ctx.recurringPaymentsRepo.markPaid(id, {
        amountMinor: 1,
        date: '2026-11-01',
        accountId: ctx.cash.id,
      }),
      'recurringEnded',
    );

    await ctx.recurringPaymentsRepo.update(
      id,
      ctx.rent({ startDate: '2026-11-01', nextDueDate: '2026-11-01', endDate: null }),
    );
    expect((await ctx.recurringPaymentsRepo.getById(id)).status).toBe('active');
  });

  it('kullanıcının pasife aldığı kayıt düzenlenince pasif kalır', async () => {
    const ctx = await setup();
    const id = await ctx.recurringPaymentsRepo.create(ctx.rent());
    await ctx.recurringPaymentsRepo.setStatus(id, 'passive');
    await ctx.recurringPaymentsRepo.update(id, ctx.rent({ title: 'Kira' }));
    expect(await ctx.recurringPaymentsRepo.getById(id)).toEqual(
      expect.objectContaining({ title: 'Kira', status: 'passive' }),
    );
  });

  it('para birimi değişince tutar dönüştürülür', async () => {
    const ctx = await setup();
    const id = await ctx.recurringPaymentsRepo.create(ctx.rent({ amountMinor: 10000 }));
    await ctx.businessProfileRepo.changeCurrency('GBP', {
      base: 'GBP',
      quote: 'TRY',
      micro: 40_000_000,
    });
    expect(await ctx.recurringPaymentsRepo.getById(id)).toEqual(
      expect.objectContaining({ amountMinor: 250, currency: 'GBP' }),
    );
  });

  it('bildirim kimliği yazılır; silme ve geri alma', async () => {
    const ctx = await setup();
    const id = await ctx.recurringPaymentsRepo.create(ctx.rent());
    await ctx.recurringPaymentsRepo.setNotificationId(id, 'recurring-x');
    expect((await ctx.recurringPaymentsRepo.getById(id)).notificationId).toBe('recurring-x');
    await ctx.recurringPaymentsRepo.softDelete(id);
    expect(await ctx.recurringPaymentsRepo.list()).toEqual([]);
    await ctx.recurringPaymentsRepo.restore(id);
    expect(await ctx.recurringPaymentsRepo.list()).toHaveLength(1);
  });
});

describe('remindersRepo', () => {
  it('ekler, carinin adıyla ve sıralı listeler, zamanı gelenleri sayar', async () => {
    const ctx = await setup();
    const ayse = await ctx.contactsRepo.create({
      personType: 'individual',
      role: 'customer',
      name: 'Ayşe',
    });
    const later = await ctx.remindersRepo.create({
      contactId: ayse,
      remindDate: '2026-10-25',
      remindTime: '09:00',
      note: '  ',
    });
    const sooner = await ctx.remindersRepo.create({
      contactId: ctx.landlord,
      remindDate: '2026-10-20',
      remindTime: '14:00',
      note: 'Kira farkı',
    });

    const pending = await ctx.remindersRepo.listPending();
    expect(pending.map((r) => [r.id, r.contactName, r.note])).toEqual([
      [sooner, 'Ev Sahibi', 'Kira farkı'],
      [later, 'Ayşe', null],
    ]);
    expect((await ctx.remindersRepo.listPending({ contactId: ayse })).map((r) => r.id)).toEqual([
      later,
    ]);
    expect(await ctx.remindersRepo.countDue('2026-10-20')).toBe(1);

    await ctx.remindersRepo.setStatus(sooner, 'done');
    expect(await ctx.remindersRepo.countDue('2026-10-20')).toBe(0);

    // Yeniden kurulan tamamlanmış hatırlatıcı tekrar bekler.
    await ctx.remindersRepo.update(sooner, { remindDate: '2026-10-22', remindTime: '10:00' });
    expect((await ctx.remindersRepo.getById(sooner)).status).toBe('pending');
  });

  it('silinmiş carinin hatırlatıcıları görünmez', async () => {
    const ctx = await setup();
    const temp = await ctx.contactsRepo.create({
      personType: 'individual',
      role: 'customer',
      name: 'Geçici',
    });
    await ctx.remindersRepo.create({
      contactId: temp,
      remindDate: '2026-10-21',
      remindTime: '09:00',
    });
    await ctx.contactsRepo.softDelete(temp);
    expect(await ctx.remindersRepo.listPending()).toEqual([]);
    await expectDomainError(
      ctx.remindersRepo.create({ contactId: temp, remindDate: '2026-10-21', remindTime: '09:00' }),
      'notFound',
    );
  });
});
