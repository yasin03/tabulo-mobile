// Excel dışa aktarma (10.2): Hareketler · Cariler · Dönem özeti.
// SheetJS Community Edition (kullanıcı kararı, Faz 7): kalın / dondurulmuş başlık satırı Pro sürümde olduğu için
// yapılamıyor; yerine başlıkta otomatik filtre ve sütun genişlikleri var. Tarih ve tutarlar metin değil SAYI hücresidir.

import * as XLSX from 'xlsx';

import type tr from '@/core/i18n/tr.json';
import { daysBetween } from '@/core/dates';
import { balanceState } from '@/core/ledger';
import { summarizeMovements, type CategorySum } from '@/core/summary';
import { defaultPhoneCountry, formatPhone } from '@/core/validation';
import type { ContactWithBalance, TransactionListItem } from '@/db/repositories';

import type { FormatContext } from './documents';

export interface WorkbookInput {
  /** Hareketler (sıra önemsiz; dosyada eskiden yeniye). */
  transactions: readonly TransactionListItem[];
  contacts: readonly ContactWithBalance[];
  /** Seçilen dönem; sınırsız uçta özetteki başlangıç/bitiş hareketlerden gelir. */
  range: { from?: string; to?: string };
  /** Uygulanan filtreler, okunur metin olarak ("Hesap: Kasa"). */
  filters: readonly string[];
  /** KVKK (6.3): Cariler sayfasında TC Kimlik No sütunu yalnızca seçilirse. */
  includeNationalId: boolean;
}

type Resources = typeof tr;
type Cell = XLSX.CellObject | string | null;

const MONEY_FORMAT = '#,##0.00';
/** Excel tarih seri numarasının başlangıcı (1900 tarih sistemi). */
const EXCEL_EPOCH = '1899-12-30';

const DATE_FORMATS: Record<string, string> = {
  'tr-TR': 'dd.mm.yyyy',
  'en-GB': 'dd/mm/yyyy',
  'en-US': 'mm/dd/yyyy',
};

/** Tarih hücresi: seri numarası + biçim. Saat dilimi kayması olmaz (Date nesnesi kullanılmaz). */
function dateCell(iso: string | null | undefined, ctx: FormatContext): Cell {
  if (!iso) return null;
  return { t: 'n', v: daysBetween(EXCEL_EPOCH, iso), z: DATE_FORMATS[ctx.locale] ?? 'yyyy-mm-dd' };
}

/** Tutar hücresi (ana birim). Bölme yalnızca dosyaya yazmak için; hesap kuruşla yapıldı. */
function moneyCell(minor: number | null): Cell {
  if (minor === null) return null;
  return { t: 'n', v: minor / 100, z: MONEY_FORMAT };
}

const numberCell = (value: number): Cell => ({ t: 'n', v: value });

/** Sayfa adı: en fazla 31 karakter, `[]:*?/\` yasak. */
const sheetName = (name: string) => name.replace(/[[\]:*?/\\]/g, ' ').slice(0, 31);

function tableSheet(header: string[], rows: Cell[][], widths: number[]): XLSX.WorkSheet {
  const sheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  sheet['!cols'] = widths.map((wch) => ({ wch }));
  if (rows.length > 0) {
    sheet['!autofilter'] = {
      ref: XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: rows.length, c: header.length - 1 },
      }),
    };
  }
  return sheet;
}

function transactionsSheet(input: WorkbookInput, ctx: FormatContext) {
  const { t } = ctx;
  const chronological = [...input.transactions].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.id.localeCompare(b.id),
  );
  const col = (key: keyof Resources['export']['excel']['transactionColumns']) =>
    t(`export.excel.transactionColumns.${key}`);
  const header = [
    col('date'),
    col('movementType'),
    col('account'),
    col('transactionType'),
    col('subject'),
    col('contact'),
    col('description'),
    col('documentNo'),
    col('dueDate'),
    col('income'),
    col('expense'),
    col('amount'),
  ];
  const rows = chronological.map((tx): Cell[] => [
    dateCell(tx.date, ctx),
    t(`movementTypes.${tx.movementType}`),
    tx.accountName,
    tx.transactionTypeName,
    tx.subjectName,
    tx.contactName,
    tx.description,
    tx.documentNo,
    dateCell(tx.dueDate, ctx),
    moneyCell(tx.movementType === 'collection' ? tx.amountMinor : null),
    moneyCell(tx.movementType === 'payment' ? tx.amountMinor : null),
    moneyCell(tx.amountMinor),
  ]);
  return tableSheet(header, rows, [12, 18, 16, 18, 14, 24, 32, 14, 12, 14, 14, 14]);
}

function contactsSheet(input: WorkbookInput, ctx: FormatContext) {
  const { t } = ctx;
  const intl = ctx.language !== 'tr';
  const country = defaultPhoneCountry(ctx.currency);
  const col = (key: keyof Resources['export']['excel']['contactColumns']) =>
    t(`export.excel.contactColumns.${key}`);
  const withId = input.includeNationalId;

  const header = [
    col('name'),
    col('personType'),
    col('role'),
    ...(withId ? [t(intl ? 'contactForm.nationalIdIntl' : 'contactForm.nationalId')] : []),
    t(intl ? 'contactForm.taxNumberIntl' : 'contactForm.taxNumber'),
    t('contactForm.taxOffice'),
    t(intl ? 'contactForm.cityIntl' : 'contactForm.city'),
    t(intl ? 'contactForm.districtIntl' : 'contactForm.district'),
    t('contactForm.address'),
    t('contactForm.phone'),
    t('contactForm.email'),
    col('status'),
    col('balance'),
    col('balanceState'),
  ];
  const rows = input.contacts.map((contact): Cell[] => [
    contact.name,
    t(`personTypes.${contact.personType}`),
    t(`contactRoles.${contact.role}`),
    ...(withId ? [contact.nationalId] : []),
    contact.taxNumber,
    contact.taxOffice,
    contact.city,
    contact.district,
    contact.address,
    contact.phone ? formatPhone(contact.phone, country) : null,
    contact.email,
    t(contact.status === 'active' ? 'export.excel.active' : 'export.excel.passive'),
    moneyCell(contact.balanceMinor),
    t(`export.excel.balanceState.${balanceState(contact.balanceMinor)}`),
  ]);
  return tableSheet(header, rows, [
    28,
    12,
    12,
    ...(withId ? [14] : []),
    14,
    16,
    14,
    14,
    32,
    18,
    24,
    10,
    14,
    16,
  ]);
}

function summarySheet(input: WorkbookInput, ctx: FormatContext) {
  const { t } = ctx;
  const summary = summarizeMovements(input.transactions, ctx.locale);
  const dates = input.transactions.map((tx) => tx.date).sort();
  const from = input.range.from ?? dates[0] ?? null;
  const to = input.range.to ?? dates[dates.length - 1] ?? null;
  const label = (key: keyof Resources['export']['excel']['summary']) =>
    t(`export.excel.summary.${key}`);

  const categoryRows = (
    title: string,
    rows: readonly CategorySum[],
    emptyName: string,
  ): Cell[][] =>
    rows.length === 0
      ? []
      : [
          [],
          [title],
          ...rows.map((row): Cell[] => [row.name ?? emptyName, moneyCell(row.totalMinor)]),
        ];

  const rows: Cell[][] = [
    [label('from'), dateCell(from, ctx)],
    [label('to'), dateCell(to, ctx)],
    [label('filters'), input.filters.length > 0 ? input.filters.join(' · ') : label('noFilters')],
    [label('count'), numberCell(summary.count)],
    [],
    [t('reports.summary.income'), moneyCell(summary.incomeMinor)],
    [t('reports.summary.expense'), moneyCell(summary.expenseMinor)],
    [label('net'), moneyCell(summary.netMinor)],
    [t('reports.summary.creditSales'), moneyCell(summary.creditSalesMinor)],
    [t('reports.summary.creditPurchases'), moneyCell(summary.creditPurchasesMinor)],
    ...categoryRows(t('reports.byType'), summary.expensesByType, t('reports.noType')),
    ...categoryRows(t('reports.bySubject'), summary.expensesBySubject, t('reports.noSubject')),
  ];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{ wch: 30 }, { wch: 18 }];
  return sheet;
}

export function buildWorkbook(input: WorkbookInput, ctx: FormatContext): XLSX.WorkBook {
  const { t } = ctx;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    transactionsSheet(input, ctx),
    sheetName(t('export.excel.sheets.transactions')),
  );
  XLSX.utils.book_append_sheet(
    workbook,
    contactsSheet(input, ctx),
    sheetName(t('export.excel.sheets.contacts')),
  );
  XLSX.utils.book_append_sheet(
    workbook,
    summarySheet(input, ctx),
    sheetName(t('export.excel.sheets.summary')),
  );
  return workbook;
}

/** `.xlsx` içeriği, base64 (expo-file-system ile yazılır). */
export function workbookBase64(workbook: XLSX.WorkBook): string {
  return XLSX.write(workbook, { type: 'base64', bookType: 'xlsx', compression: true }) as string;
}
