/** @jest-environment node */
// Faz 10 performans hedefi: 1.000+ cari ve 10.000+ harekette ekran sorguları hızlı kalmalı.
// Süre sınırları gevşek (CI makinesi yavaş olabilir); asıl amaç sorgu planı bozulunca yakalamak.

import { addDays, monthRange, toIsoDate } from '@/core/dates';

import { createSeededTestDb } from '../testing';

const CONTACTS = 1_000;
const TRANSACTIONS = 10_000;
const LIMIT_MS = 400;

describe('büyük veri (1.000 cari, 10.000 hareket)', () => {
  const ctx = createSeededTestDb();
  const today = toIsoDate(new Date());
  const timings: Record<string, number> = {};

  beforeAll(async () => {
    await ctx.sampleDataRepo.insert({ contacts: CONTACTS, transactions: TRANSACTIONS, seed: 7 });
  });

  afterAll(() => {
    console.log(
      Object.entries(timings)
        .map(([name, ms]) => `${name.padEnd(36)} ${ms.toFixed(1)} ms`)
        .join('\n'),
    );
  });

  async function timed<T>(name: string, run: () => Promise<T>): Promise<T> {
    await run(); // ısınma (hazırlanan ifadeler)
    const start = performance.now();
    const result = await run();
    timings[name] = performance.now() - start;
    expect(timings[name]).toBeLessThan(LIMIT_MS);
    return result;
  }

  it('veri yüklendi', async () => {
    expect(await ctx.contactsRepo.count()).toBe(CONTACTS);
    expect(await ctx.transactionsRepo.count()).toBeGreaterThanOrEqual(TRANSACTIONS * 0.9);
  });

  it('cari listesi ve aramalar', async () => {
    const list = await timed('contactsRepo.list', () => ctx.contactsRepo.list());
    expect(list).toHaveLength(CONTACTS);
    await timed('contactsRepo.list (arama)', () => ctx.contactsRepo.list({ search: 'yıl' }));
    await timed('contactsRepo.list (bakiye sırası)', () =>
      ctx.contactsRepo.list({ sort: 'balance' }),
    );
  });

  it('ana sayfa sorguları', async () => {
    await timed('contactsRepo.totals', () => ctx.contactsRepo.totals(today));
    await timed('accountsRepo.listWithBalances', () => ctx.accountsRepo.listWithBalances());
    await timed('transactionsRepo.dueReceivables', () =>
      ctx.transactionsRepo.dueReceivables(today),
    );
    const recent = await timed('transactionsRepo.search (son 5)', () =>
      ctx.transactionsRepo.search({ limit: 5 }),
    );
    expect(recent).toHaveLength(5);
  });

  it('tüm hareketler ve cari detayı', async () => {
    await timed('transactionsRepo.search (tümü)', () => ctx.transactionsRepo.search());
    await timed('transactionsRepo.search (metin)', () =>
      ctx.transactionsRepo.search({ search: 'fatura' }),
    );
    const [contact] = await ctx.contactsRepo.list({ sort: 'balance' });
    await timed('transactionsRepo.listForContact', () =>
      ctx.transactionsRepo.listForContact(contact!.id),
    );
  });

  it('raporlar', async () => {
    const range = { from: addDays(today, -365), to: today };
    await timed('reportsRepo.summary (yıl)', () => ctx.reportsRepo.summary(range));
    await timed('reportsRepo.dailyIncomeExpense (yıl)', () =>
      ctx.reportsRepo.dailyIncomeExpense(range),
    );
    await timed('reportsRepo.expensesByType (ay)', () =>
      ctx.reportsRepo.expensesByType(monthRange(today)),
    );
  });
});
