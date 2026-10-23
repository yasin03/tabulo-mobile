// Cari hesap ekstresi şablonu (10.1): Tarih · Belge no · Açıklama · Borç · Alacak · Bakiye (yürüyen).

import { escapeHtml, renderDocument, toneClass, type DocumentFrame, type Tone } from './html';

export interface StatementCell {
  text: string;
  tone?: Tone;
}

export interface StatementDocument extends DocumentFrame {
  /** Solda ad, telefon, e-posta; sağda tip, vergi/kimlik, adres (alt alta). */
  contact: { name: string; left: string[]; right: string[] };
  columns: {
    date: string;
    documentNo: string;
    description: string;
    debit: string;
    credit: string;
    balance: string;
  };
  /** "Devreden bakiye" satırı; aralık başlangıcı sınırsızsa ve bakiye sıfırsa gösterilmez. */
  opening: { label: string; balance: StatementCell } | null;
  rows: {
    date: string;
    documentNo: string;
    /** Hareket tipi ("Veresiye satış"), kalın. */
    type: string;
    description: string;
    debit: StatementCell;
    credit: StatementCell;
    balance: StatementCell;
  }[];
  emptyText: string;
  totalsLabel: string;
  totals: { debit: StatementCell; credit: StatementCell };
  /** Alttaki özet kutusu: devreden, dönem toplamları… */
  summary: { label: string; value: StatementCell }[];
  closing: { label: string; value: StatementCell; caption: string };
}

const cell = (value: StatementCell, className = 'num') =>
  `<td class="${[className, toneClass(value.tone)].filter(Boolean).join(' ')}">${escapeHtml(value.text)}</td>`;

const muted = (lines: readonly string[]) =>
  lines
    .filter((line) => line.trim() !== '')
    .map((line) => `<div class="muted">${escapeHtml(line)}</div>`)
    .join('');

export function renderStatement(doc: StatementDocument): string {
  const { columns } = doc;
  const head = `<tr>
    <th>${escapeHtml(columns.date)}</th>
    <th>${escapeHtml(columns.documentNo)}</th>
    <th>${escapeHtml(columns.description)}</th>
    <th class="num">${escapeHtml(columns.debit)}</th>
    <th class="num">${escapeHtml(columns.credit)}</th>
    <th class="num">${escapeHtml(columns.balance)}</th>
  </tr>`;

  const opening = doc.opening
    ? `<tr class="strong"><td colspan="5">${escapeHtml(doc.opening.label)}</td>${cell(doc.opening.balance)}</tr>`
    : '';

  const rows = doc.rows
    .map(
      (row) => `<tr>
    <td class="nowrap">${escapeHtml(row.date)}</td>
    <td>${escapeHtml(row.documentNo)}</td>
    <td><span class="type">${escapeHtml(row.type)}</span>${
      row.description ? `<br />${escapeHtml(row.description)}` : ''
    }</td>
    ${cell(row.debit)}${cell(row.credit)}${cell(row.balance)}
  </tr>`,
    )
    .join('');

  const empty =
    doc.rows.length === 0
      ? `<tr><td class="empty" colspan="6">${escapeHtml(doc.emptyText)}</td></tr>`
      : '';

  const totals =
    doc.rows.length > 0
      ? `<tr class="strong"><td colspan="3">${escapeHtml(doc.totalsLabel)}</td>${cell(doc.totals.debit)}${cell(
          doc.totals.credit,
        )}<td></td></tr>`
      : '';

  const summary = doc.summary
    .map((item) => `<tr><td>${escapeHtml(item.label)}</td>${cell(item.value)}</tr>`)
    .join('');

  const body = `
<style>
.contact { display: flex; justify-content: space-between; gap: 16pt; }
.contact-col { flex: 1; min-width: 0; }
.contact-right { text-align: right; padding-top: 2pt; }
</style>
<div class="box contact">
  <div class="contact-col">
    <div class="box-title">${escapeHtml(doc.contact.name)}</div>
    ${muted(doc.contact.left)}
  </div>
  <div class="contact-col contact-right">${muted(doc.contact.right)}</div>
</div>
<section class="split-flow">
<table>
  <colgroup><col style="width:13%" /><col style="width:12%" /><col /><col style="width:14%" /><col style="width:14%" /><col style="width:17%" /></colgroup>
  <thead>${head}</thead>
  <tbody>${opening}${rows}${empty}${totals}</tbody>
</table>
</section>
<div class="keep" style="display:flex; justify-content:flex-end; padding-top:16pt;">
  <div style="width:62%;">
    <table>${summary}</table>
    <div class="box" style="margin-top:10pt; margin-bottom:0; text-align:right;">
      <div class="muted">${escapeHtml(doc.closing.label)}</div>
      <div class="${toneClass(doc.closing.value.tone)}" style="font-size:20pt; font-weight:800; line-height:1.25;">${escapeHtml(
        doc.closing.value.text,
      )}</div>
      ${doc.closing.caption ? `<div class="muted">${escapeHtml(doc.closing.caption)}</div>` : ''}
    </div>
  </div>
</div>`;

  return renderDocument(doc, body);
}
