import { createInstance, type TFunction } from 'i18next';
import * as XLSX from 'xlsx';

import { resources } from '@/core/i18n';
import { createSeededTestDb } from '@/db/testing';

import { periodBuckets } from '@/core/periods';

import { reportHtml, statementHtml, type FormatContext } from './documents';
import { buildWorkbook, workbookBase64 } from './workbook';

async function context(language: 'tr' | 'en'): Promise<FormatContext> {
  const i18n = createInstance();
  await i18n.init({ lng: language, resources, interpolation: { escapeValue: false } });
  return {
    t: i18n.t.bind(i18n) as TFunction,
    language,
    currency: 'TRY',
    locale: language === 'tr' ? 'tr-TR' : 'en-GB',
    today: '2026-10-21',
    pdfPagination: 'css',
  };
}

async function fixture() {
  const ctx = createSeededTestDb();
  const [cash] = await ctx.accountsRepo.list();
  const contactId = await ctx.contactsRepo.create({
    name: 'Ayşe <Yılmaz>',
    personType: 'individual',
    role: 'customer',
    nationalId: '10000000146',
    phone: '+905321112233',
  });
  await ctx.transactionsRepo.create({
    movementType: 'credit_sale',
    contactId,
    amountMinor: 150_000,
    date: '2026-09-10',
    documentNo: 'F-1',
    description: 'Kumaş',
  });
  await ctx.transactionsRepo.create({
    movementType: 'collection',
    contactId,
    accountId: cash!.id,
    amountMinor: 40_050,
    date: '2026-10-02',
  });
  await ctx.transactionsRepo.create({
    movementType: 'payment',
    accountId: cash!.id,
    amountMinor: 12_000,
    date: '2026-10-05',
  });
  return { ...ctx, contactId };
}

describe('statementHtml', () => {
  it('writes debit/credit with B/A balances, escapes text and hides the ID by default', async () => {
    const { contactsRepo, transactionsRepo, businessProfileRepo, contactId } = await fixture();
    const contact = await contactsRepo.getById(contactId);
    const transactions = (await transactionsRepo.listForContact(contactId)).reverse();
    const input = {
      profile: await businessProfileRepo.get(),
      logoDataUri: null,
      contact,
      transactions,
      range: {},
      includeNationalId: false,
    };
    const html = statementHtml(input, await context('tr'));

    expect(html).toContain('Cari Hesap Ekstresi');
    expect(html).toContain('Ayşe &lt;Yılmaz&gt;');
    expect(html).not.toContain('<Yılmaz>');
    expect(html).toContain('1.500,00 ₺ (B)');
    expect(html).toContain('1.099,50 ₺ (B)');
    expect(html).toContain('Cari borçlu (B)');
    expect(html).not.toContain('10000000146');
    // "Tümü"de devreden bakiye satırı yok.
    expect(html).not.toContain('Devreden bakiye');

    const withId = statementHtml(
      { ...input, includeNationalId: true, range: { from: '2026-10-01' } },
      await context('tr'),
    );
    expect(withId).toContain('TC Kimlik No: 10000000146');
    expect(withId).toContain('Devreden bakiye');
    expect(withId).not.toContain('Kumaş');
  });

  it('puts phone/email left and type/address right; pagination differs per platform', async () => {
    const { contactsRepo, transactionsRepo, businessProfileRepo, contactId } = await fixture();
    const input = {
      profile: await businessProfileRepo.get(),
      logoDataUri: null,
      contact: await contactsRepo.getById(contactId),
      transactions: (await transactionsRepo.listForContact(contactId)).reverse(),
      range: {},
      includeNationalId: false,
    };
    const css = statementHtml(input, await context('tr'));
    const left = css.slice(
      css.indexOf('<div class="contact-col">'),
      css.indexOf('<div class="contact-col contact-right">'),
    );
    expect(left).toContain('0532 111 22 33');
    expect(left).not.toContain('Müşteri');
    // Android (Chromium): alt not @page kutusunda, script yok.
    expect(css).toContain('@bottom-center');
    expect(css).not.toContain('<script>');

    const script = statementHtml(input, { ...(await context('tr')), pdfPagination: 'script' });
    // iOS (WebKit): belge içi sayfalama; @page kuralı ölçeği bozduğu için yok.
    expect(script).toContain('<script>');
    expect(script).toContain('class="js-pages"');
    expect(script).toContain('id="footer-src"');
    expect(script).toContain('class="split-flow"');
    expect(script).not.toContain('@page');
  });
});

describe('reportHtml', () => {
  it('shows cash/bank period net and the income/expense type summary with totals', async () => {
    const { reportsRepo, accountsRepo, businessProfileRepo } = await fixture();
    const period = { unit: 'month' as const, from: '2026-10-01', to: '2026-10-31' };
    const range = { from: period.from, to: period.to };
    const html = reportHtml(
      {
        profile: await businessProfileRepo.get(),
        logoDataUri: null,
        period,
        periodLabel: 'Ekim 2026',
        summary: await reportsRepo.summary(range),
        daily: await reportsRepo.dailyIncomeExpense(range),
        buckets: periodBuckets(period, 1),
        incomeByType: await reportsRepo.incomeByType(range),
        byType: await reportsRepo.expensesByType(range),
        bySubject: await reportsRepo.expensesBySubject(range),
        accountFlows: await reportsRepo.cashFlowByAccountType(range),
        accounts: await accountsRepo.listWithBalances({ asOf: '2026-10-21' }),
        accountsAsOf: '2026-10-21',
      },
      await context('tr'),
    );
    expect(html).toContain('Kasa dönem neti');
    expect(html).toContain('+\u00A0280,50\u00A0₺');
    expect(html).toContain('Giriş 400,50\u00A0₺ · Çıkış 120,00\u00A0₺');
    expect(html).toContain('Banka dönem neti');
    expect(html).toContain('Özet – Tür bazlı');
    expect(html).toContain('Gelir türü');
    expect(html).toContain('Gider türü');
    expect(html).toContain('Adet');
    // Bölüm sırası: kartlar → tür bazlı özet → gelir-gider kırılımı.
    expect(html.indexOf('Kasa dönem neti')).toBeLessThan(html.indexOf('Özet – Tür bazlı'));
    expect(html.indexOf('Özet – Tür bazlı')).toBeLessThan(html.indexOf('İşlem türüne göre gider'));
  });
});

describe('buildWorkbook', () => {
  it('writes three sheets with numeric dates and amounts', async () => {
    const { transactionsRepo, contactsRepo } = await fixture();
    const ctx = await context('tr');
    const workbook = buildWorkbook(
      {
        transactions: await transactionsRepo.search({ from: '2026-10-01', to: '2026-10-31' }),
        contacts: await contactsRepo.list({ status: 'all' }),
        range: { from: '2026-10-01', to: '2026-10-31' },
        filters: [],
        includeNationalId: false,
      },
      ctx,
    );

    const read = XLSX.read(workbookBase64(workbook), { type: 'base64' });
    expect(read.SheetNames).toEqual(['Hareketler', 'Cariler', 'Dönem özeti']);

    const tx = XLSX.utils.sheet_to_json<unknown[]>(read.Sheets.Hareketler!, { header: 1 });
    expect(tx[0]).toEqual([
      'Tarih',
      'Hareket tipi',
      'Hesap',
      'İşlem türü',
      'Konu',
      'Cari',
      'Açıklama',
      'Belge no',
      'Vade',
      'Gelir',
      'Gider',
      'Tutar',
    ]);
    expect(tx).toHaveLength(3);
    const first = read.Sheets.Hareketler!.A2!;
    expect(first.t).toBe('n');
    // 2026-10-02 → Excel seri numarası.
    expect(first.v).toBe(46297);
    expect(read.Sheets.Hareketler!.J2).toMatchObject({ t: 'n', v: 400.5 });
    expect(read.Sheets.Hareketler!.K3).toMatchObject({ t: 'n', v: 120 });
    expect(read.Sheets.Hareketler!['!autofilter']?.ref).toBe('A1:L3');

    const contacts = XLSX.utils.sheet_to_json<unknown[]>(read.Sheets.Cariler!, { header: 1 });
    expect(contacts[0]).not.toContain('TC Kimlik No');
    expect(contacts[1]).toContain('Ayşe <Yılmaz>');
    expect(contacts[1]).toContain(1099.5);
    expect(contacts[1]).toContain('Size borçlu');

    const summary = XLSX.utils.sheet_to_json<unknown[]>(read.Sheets['Dönem özeti']!, {
      header: 1,
    });
    expect(summary).toContainEqual(['Gelir', 400.5]);
    expect(summary).toContainEqual(['Gider', 120]);
    expect(summary).toContainEqual(['Hareket sayısı', 2]);
  });

  it('adds the ID column only when asked', async () => {
    const { contactsRepo } = await fixture();
    const workbook = buildWorkbook(
      {
        transactions: [],
        contacts: await contactsRepo.list({ status: 'all' }),
        range: {},
        filters: ['Hesap: Kasa'],
        includeNationalId: true,
      },
      await context('en'),
    );
    const contacts = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Contacts!, { header: 1 });
    expect(contacts[0]).toContain('Tax ID');
    expect(contacts[1]).toContain('10000000146');
  });
});
