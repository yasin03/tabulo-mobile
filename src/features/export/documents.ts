// PDF belgelerinin içeriği: veriler + çeviriler + biçimlendirme → src/pdf şablonları.

import type { TFunction } from 'i18next';

import { formatDate, type DateRange } from '@/core/dates';
import type { Language } from '@/core/i18n';
import { formatMoney, formatSignedMoney, type Currency } from '@/core/money';
import {
  formatBucket,
  totalsByBucket,
  type Bucket,
  type DailyIncomeExpense,
  type Period,
} from '@/core/periods';
import {
  balanceSide,
  buildStatement,
  statementPeriod,
  type StatementRange,
} from '@/core/statement';
import { defaultPhoneCountry, formatPhone } from '@/core/validation';
import type { BusinessProfile, Contact } from '@/db';
import type {
  AccountTypeFlow,
  AccountWithBalance,
  CategoryTotal,
  PeriodSummary,
  TransactionListItem,
} from '@/db/repositories';
import type { BusinessHeader, Tone } from '@/pdf/html';
import { renderReport, type ReportTable } from '@/pdf/report';
import { renderStatement } from '@/pdf/statement';

export interface FormatContext {
  t: TFunction;
  language: Language;
  currency: Currency;
  /** `formatLocale` çıktısı (tr-TR, en-GB, en-US). */
  locale: string;
  today: string;
  /** PDF sayfalaması: iOS'ta belge içi script, Android'de motorun baskı kuralları (bkz. src/pdf/paginate.ts). */
  pdfPagination: 'script' | 'css';
}

const tone = (minor: number): Tone => (minor > 0 ? 'positive' : minor < 0 ? 'negative' : 'neutral');

function money(ctx: FormatContext, minor: number) {
  return formatMoney(minor, { currency: ctx.currency, language: ctx.language });
}

/** Türkiye ayarında (dil `tr`) TC / Vergi No; İngilizcede Tax ID / Company-VAT No (Faz 2 kararı). */
function identityLabels(ctx: FormatContext) {
  const intl = ctx.language !== 'tr';
  return {
    nationalId: ctx.t(intl ? 'contactForm.nationalIdIntl' : 'contactForm.nationalId'),
    taxNumber: ctx.t(intl ? 'contactForm.taxNumberIntl' : 'contactForm.taxNumber'),
    taxOffice: ctx.t('contactForm.taxOffice'),
  };
}

const labeled = (label: string, value: string | null | undefined) =>
  value ? `${label}: ${value}` : '';

const joinParts = (...parts: (string | null | undefined)[]) =>
  parts.filter((part) => part && part.trim() !== '').join(' · ');

function businessHeader(
  profile: BusinessProfile,
  ctx: FormatContext,
  logoDataUri: string | null,
): BusinessHeader {
  const ids = identityLabels(ctx);
  const country = defaultPhoneCountry(ctx.currency);
  return {
    name: profile.name,
    logoDataUri,
    lines: [
      profile.address ?? '',
      joinParts(profile.district, profile.city),
      joinParts(profile.phone ? formatPhone(profile.phone, country) : null, profile.email),
      joinParts(
        labeled(ids.taxOffice, profile.taxOffice),
        labeled(ids.taxNumber, profile.taxNumber),
      ),
    ],
  };
}

function frameBase(ctx: FormatContext) {
  return {
    lang: ctx.language,
    pagination: ctx.pdfPagination,
    footer: joinParts(
      ctx.t('export.footer'),
      ctx.t('export.generated', { date: formatDate(ctx.today, ctx.locale, 'full') }),
    ),
  };
}

function formatRange(range: DateRange, ctx: FormatContext) {
  const from = formatDate(range.from, ctx.locale, 'full');
  const to = formatDate(range.to, ctx.locale, 'full');
  return range.from === range.to ? from : `${from} – ${to}`;
}

// ---------- Cari ekstresi (10.1) ----------

export interface StatementInput {
  profile: BusinessProfile;
  logoDataUri: string | null;
  contact: Contact;
  /** Kronolojik (eskiden yeniye). */
  transactions: readonly TransactionListItem[];
  range: StatementRange;
  /** KVKK (6.3): TC Kimlik No yalnızca seçilirse yazılır. */
  includeNationalId: boolean;
}

export function statementBalanceText(minor: number, ctx: FormatContext) {
  const side = balanceSide(minor);
  const amount = money(ctx, minor);
  return side ? `${amount} ${ctx.t(`export.side.${side}`)}` : amount;
}

export function statementHtml(input: StatementInput, ctx: FormatContext): string {
  const { contact } = input;
  const { t } = ctx;
  const statement = buildStatement(input.transactions, input.range);
  const period = statementPeriod(input.transactions, input.range, ctx.today);
  const ids = identityLabels(ctx);
  const country = defaultPhoneCountry(ctx.currency);

  const balanceCell = (minor: number) => ({
    text: statementBalanceText(minor, ctx),
    tone: tone(minor),
  });
  const amountCell = (minor: number, cellTone: Tone) =>
    minor === 0 ? { text: '' } : { text: money(ctx, minor), tone: cellTone };

  const closingSide = balanceSide(statement.closingBalanceMinor);
  const showOpening = !!input.range.from || statement.openingBalanceMinor !== 0;

  return renderStatement({
    ...frameBase(ctx),
    title: t('export.statement.heading'),
    business: businessHeader(input.profile, ctx, input.logoDataUri),
    heading: t('export.statement.heading'),
    headingLines: [formatRange(period, ctx)],
    contact: {
      name: contact.name,
      left: [contact.phone ? formatPhone(contact.phone, country) : '', contact.email ?? ''],
      right: [
        joinParts(t(`contactRoles.${contact.role}`), t(`personTypes.${contact.personType}`)),
        contact.personType === 'company'
          ? joinParts(
              labeled(ids.taxOffice, contact.taxOffice),
              labeled(ids.taxNumber, contact.taxNumber),
            )
          : input.includeNationalId
            ? labeled(ids.nationalId, contact.nationalId)
            : '',
        contact.address ?? '',
        joinParts(contact.district, contact.city),
      ],
    },
    columns: {
      date: t('export.statement.columns.date'),
      documentNo: t('export.statement.columns.documentNo'),
      description: t('export.statement.columns.description'),
      debit: t('export.statement.columns.debit'),
      credit: t('export.statement.columns.credit'),
      balance: t('export.statement.columns.balance'),
    },
    opening: showOpening
      ? {
          label: t('export.statement.opening'),
          balance: balanceCell(statement.openingBalanceMinor),
        }
      : null,
    rows: statement.rows.map((row) => ({
      date: formatDate(row.date, ctx.locale, 'dayMonthYear'),
      documentNo: row.documentNo ?? '',
      type: t(`movementTypes.${row.movementType}`),
      description: joinParts(row.transactionTypeName, row.description),
      // Borç cariyi bize borçlandırır (bakiye +, yeşil); alacak tersi (kırmızı). Kullanıcı kararı.
      debit: amountCell(row.debitMinor, 'positive'),
      credit: amountCell(row.creditMinor, 'negative'),
      balance: balanceCell(row.balanceMinor),
    })),
    emptyText: t('export.statement.empty'),
    totalsLabel: t('export.statement.totals'),
    totals: {
      debit: { text: money(ctx, statement.totalDebitMinor), tone: 'positive' },
      credit: { text: money(ctx, statement.totalCreditMinor), tone: 'negative' },
    },
    summary: [
      ...(showOpening
        ? [
            {
              label: t('export.statement.opening'),
              value: balanceCell(statement.openingBalanceMinor),
            },
          ]
        : []),
      {
        label: t('export.statement.periodDebit'),
        value: { text: money(ctx, statement.totalDebitMinor), tone: 'positive' as const },
      },
      {
        label: t('export.statement.periodCredit'),
        value: { text: money(ctx, statement.totalCreditMinor), tone: 'negative' as const },
      },
    ],
    closing: {
      label: t('export.statement.closing', {
        date: formatDate(period.to, ctx.locale, 'full'),
      }),
      value: balanceCell(statement.closingBalanceMinor),
      caption: t(`export.statement.closingCaption.${closingSide ?? 'settled'}`),
    },
  });
}

// ---------- Dönem raporu ----------

export interface ReportInput {
  profile: BusinessProfile;
  logoDataUri: string | null;
  period: Period;
  periodLabel: string;
  summary: PeriodSummary;
  daily: readonly DailyIncomeExpense[];
  buckets: readonly Bucket[];
  /** Tahsilatlar, işlem türüne göre ("Özet – Tür bazlı"). */
  incomeByType: readonly CategoryTotal[];
  /** Ödemeler, işlem türüne göre (hem tür bazlı özet hem gider dağılımı). */
  byType: readonly CategoryTotal[];
  bySubject: readonly CategoryTotal[];
  /** Kasa ve banka dönem içi giriş / çıkış / net. */
  accountFlows: readonly AccountTypeFlow[];
  accounts: readonly AccountWithBalance[];
  accountsAsOf: string;
}

function categoryTable(
  title: string,
  rows: readonly CategoryTotal[],
  emptyName: string,
  ctx: FormatContext,
): ReportTable {
  const total = rows.reduce((sum, row) => sum + row.totalMinor, 0);
  const max = rows[0]?.totalMinor ?? 0;
  const percent = (minor: number) =>
    ctx.t('reports.percent', {
      value: total > 0 ? Math.max(1, Math.round((minor / total) * 100)) : 0,
    });
  return {
    title,
    columns: [ctx.t('export.report.columns.name'), ctx.t('export.report.columns.amount'), '%'],
    rows: [
      ...rows.map((row) => ({
        cells: [
          { text: row.name ?? emptyName },
          { text: money(ctx, row.totalMinor), tone: 'negative' as const },
          { text: percent(row.totalMinor) },
        ],
        ratio: max > 0 ? row.totalMinor / max : 0,
      })),
      ...(rows.length > 1
        ? [
            {
              cells: [
                { text: ctx.t('export.report.total') },
                { text: money(ctx, total), tone: 'negative' as const },
                { text: '' },
              ],
              isTotal: true,
            },
          ]
        : []),
    ],
    emptyText: ctx.t('reports.noExpenses'),
  };
}

/** Tür bazlı özet tablosu: Tür · Adet · Tutar, en altta toplam. */
function typeSummaryTable(
  heading: string,
  rows: readonly CategoryTotal[],
  amountTone: Tone,
  emptyText: string,
  ctx: FormatContext,
): ReportTable {
  const total = rows.reduce((sum, row) => sum + row.totalMinor, 0);
  const count = rows.reduce((sum, row) => sum + row.count, 0);
  return {
    title: '',
    columns: [heading, ctx.t('export.report.columns.count'), ctx.t('export.report.columns.amount')],
    rows: [
      ...rows.map((row) => ({
        cells: [
          { text: row.name ?? ctx.t('reports.noType') },
          { text: String(row.count) },
          { text: money(ctx, row.totalMinor), tone: amountTone },
        ],
      })),
      ...(rows.length > 0
        ? [
            {
              cells: [
                { text: ctx.t('export.report.total') },
                { text: String(count) },
                { text: money(ctx, total), tone: amountTone },
              ],
              isTotal: true,
            },
          ]
        : []),
    ],
    emptyText,
  };
}

export function reportHtml(input: ReportInput, ctx: FormatContext): string {
  const { t } = ctx;
  const { summary } = input;
  const bucketTotals = totalsByBucket(input.buckets, input.daily).filter(
    (b) => b.incomeMinor > 0 || b.expenseMinor > 0,
  );
  const signed = (minor: number) =>
    formatSignedMoney(minor, { currency: ctx.currency, language: ctx.language });

  const tables: ReportTable[] = [];
  if (input.buckets.length > 1) {
    tables.push({
      title: t('reports.chart.title'),
      columns: [
        t('export.report.columns.period'),
        t('reports.summary.income'),
        t('reports.summary.expense'),
        t('export.report.columns.net'),
      ],
      rows: bucketTotals.map((bucket) => ({
        cells: [
          { text: formatBucket(bucket, ctx.locale) },
          { text: money(ctx, bucket.incomeMinor), tone: 'positive' as const },
          { text: money(ctx, bucket.expenseMinor), tone: 'negative' as const },
          {
            text: signed(bucket.incomeMinor - bucket.expenseMinor),
            tone: tone(bucket.incomeMinor - bucket.expenseMinor),
          },
        ],
      })),
      emptyText: t('reports.chart.empty'),
    });
  }
  tables.push(categoryTable(t('reports.byType'), input.byType, t('reports.noType'), ctx));
  tables.push(categoryTable(t('reports.bySubject'), input.bySubject, t('reports.noSubject'), ctx));
  tables.push({
    title: t('reports.accounts'),
    subtitle: t('reports.accountsAsOf', {
      date: formatDate(input.accountsAsOf, ctx.locale, 'full'),
    }),
    columns: [t('export.report.columns.account'), t('export.report.columns.balance')],
    rows: input.accounts.map((account) => ({
      cells: [
        { text: account.name },
        { text: signed(account.balanceMinor), tone: tone(account.balanceMinor) },
      ],
    })),
    emptyText: '',
  });

  return renderReport({
    ...frameBase(ctx),
    title: t('export.report.heading'),
    business: businessHeader(input.profile, ctx, input.logoDataUri),
    heading: t('export.report.heading'),
    headingLines: [input.periodLabel, formatRange(input.period, ctx)].filter(
      (line, i, all) => all.indexOf(line) === i,
    ),
    cardRows: [
      [
        {
          label: t('reports.summary.income'),
          value: { text: money(ctx, summary.incomeMinor), tone: 'positive' },
        },
        {
          label: t('reports.summary.expense'),
          value: { text: money(ctx, summary.expenseMinor), tone: 'negative' },
        },
        {
          label: t('export.report.columns.net'),
          value: { text: signed(summary.netMinor), tone: tone(summary.netMinor) },
        },
        {
          label: t('reports.summary.creditSales'),
          value: { text: money(ctx, summary.creditSalesMinor) },
        },
        {
          label: t('reports.summary.creditPurchases'),
          value: { text: money(ctx, summary.creditPurchasesMinor) },
        },
      ],
      // Kasa ve banka: dönem içi giriş − çıkış (kullanıcı isteği).
      input.accountFlows.map((flow) => ({
        label: t(`export.report.accountFlow.${flow.type}`),
        value: { text: signed(flow.netMinor), tone: tone(flow.netMinor) },
        detail: t('export.report.accountFlowDetail', {
          in: money(ctx, flow.inMinor),
          out: money(ctx, flow.outMinor),
        }),
      })),
    ],
    sideBySide: {
      title: t('export.report.typeSummary'),
      tables: [
        typeSummaryTable(
          t('export.report.columns.incomeType'),
          input.incomeByType,
          'positive',
          t('export.report.noIncome'),
          ctx,
        ),
        typeSummaryTable(
          t('export.report.columns.expenseType'),
          input.byType,
          'negative',
          t('reports.noExpenses'),
          ctx,
        ),
      ],
    },
    tables,
  });
}
