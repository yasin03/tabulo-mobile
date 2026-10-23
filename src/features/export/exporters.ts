// Dışa aktarma akışları: veriyi repository'lerden topla → belge / çalışma kitabı → dosya. Paylaşım çağıranda.

import { exportFileName } from '@/core/fileNames';
import { periodBuckets, weekStartFor, type Period } from '@/core/periods';
import type { StatementRange } from '@/core/statement';
import {
  accountsRepo,
  businessProfileRepo,
  contactsRepo,
  reportsRepo,
  transactionsRepo,
} from '@/db';
import type { TransactionSearchFilter } from '@/db/repositories';
import { createPdf, logoDataUri, writeBase64File } from '@/platform/exportFiles';

import { reportHtml, statementHtml, type FormatContext } from './documents';
import { buildWorkbook, workbookBase64 } from './workbook';

/** PDF cari ekstresi (10.1); dosya: `Ekstre_<CariAdi>_<YYYY-AA-GG>.pdf`. */
export async function exportStatement(
  options: { contactId: string; range: StatementRange; includeNationalId: boolean },
  ctx: FormatContext,
): Promise<string> {
  const [profile, contact, transactions] = await Promise.all([
    businessProfileRepo.get(),
    contactsRepo.getById(options.contactId),
    transactionsRepo.listForContact(options.contactId),
  ]);
  const html = statementHtml(
    {
      profile,
      logoDataUri: await logoDataUri(profile.logoUri),
      contact,
      transactions: [...transactions].reverse(),
      range: options.range,
      includeNationalId: options.includeNationalId,
    },
    ctx,
  );
  const fileName = exportFileName(
    [ctx.t('export.statement.fileName'), contact.name, ctx.today],
    'pdf',
  );
  return createPdf(html, fileName);
}

/** PDF dönem raporu: raporlar ekranındaki dönem. */
export async function exportReportPdf(
  options: { period: Period; periodLabel: string },
  ctx: FormatContext,
): Promise<string> {
  const { period } = options;
  const range = { from: period.from, to: period.to };
  const accountsAsOf = period.to < ctx.today ? period.to : ctx.today;
  const [profile, summary, daily, incomeByType, byType, bySubject, accountFlows, accounts] =
    await Promise.all([
      businessProfileRepo.get(),
      reportsRepo.summary(range),
      reportsRepo.dailyIncomeExpense(range),
      reportsRepo.incomeByType(range),
      reportsRepo.expensesByType(range),
      reportsRepo.expensesBySubject(range),
      reportsRepo.cashFlowByAccountType(range),
      accountsRepo.listWithBalances({ asOf: accountsAsOf }),
    ]);
  const html = reportHtml(
    {
      profile,
      logoDataUri: await logoDataUri(profile.logoUri),
      period,
      periodLabel: options.periodLabel,
      summary,
      daily,
      buckets: periodBuckets(period, weekStartFor(ctx.locale)),
      incomeByType,
      byType,
      bySubject,
      accountFlows,
      accounts,
      accountsAsOf,
    },
    ctx,
  );
  const fileName = exportFileName([ctx.t('export.report.fileName'), period.from, period.to], 'pdf');
  return createPdf(html, fileName);
}

/** Excel (10.2): seçilen dönem / filtrelerle hareketler + tüm cariler + dönem özeti. */
export async function exportExcel(
  options: {
    filter: TransactionSearchFilter;
    /** Uygulanan filtrelerin okunur hâli (özet sayfasına yazılır). */
    filterLabels: readonly string[];
    includeNationalId: boolean;
  },
  ctx: FormatContext,
): Promise<string> {
  const { filter } = options;
  const [transactions, contacts] = await Promise.all([
    transactionsRepo.search(filter),
    contactsRepo.list({ status: 'all', locale: ctx.locale }),
  ]);
  const workbook = buildWorkbook(
    {
      transactions,
      contacts,
      range: { from: filter.from, to: filter.to },
      filters: options.filterLabels,
      includeNationalId: options.includeNationalId,
    },
    ctx,
  );
  const dates = transactions.map((tx) => tx.date).sort();
  const fileName = exportFileName(
    [
      ctx.t('export.excel.fileName'),
      filter.from ?? dates[0] ?? '',
      filter.to ?? dates[dates.length - 1] ?? '',
    ],
    'xlsx',
  );
  return writeBase64File(workbookBase64(workbook), fileName);
}
