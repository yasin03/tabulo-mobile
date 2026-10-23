// Dönem raporu şablonu: özet kartları (dönem + kasa/banka), tür bazlı gelir/gider özeti (yan yana),
// ardından gelir-gider kırılımı, gider dağılımları ve hesap bakiyeleri.

import { escapeHtml, renderDocument, toneClass, type DocumentFrame, type Tone } from './html';

export interface ReportCell {
  text: string;
  tone?: Tone;
}

export interface ReportCard {
  label: string;
  value: ReportCell;
  detail?: string;
}

export interface ReportTable {
  /** Boşsa başlık yazılmaz (yan yana tablolarda başlık bölümün üstündedir). */
  title: string;
  subtitle?: string;
  /** İlk sütun metin, diğerleri sayı (sağa yaslı). */
  columns: string[];
  rows: {
    cells: ReportCell[];
    /** 0–1: ilk hücrenin altında oransal çubuk (gider dağılımları). */
    ratio?: number;
    isTotal?: boolean;
  }[];
  emptyText: string;
}

export interface ReportDocument extends DocumentFrame {
  /** Her iç dizi bir kart satırı. */
  cardRows: ReportCard[][];
  /** "Özet – Tür bazlı": gelir ve gider tabloları yan yana. */
  sideBySide: { title: string; tables: [ReportTable, ReportTable] } | null;
  tables: ReportTable[];
}

/** Bu kadar satıra kadar tablo, başlığıyla birlikte bir sonraki sayfaya taşınır. */
const KEEP_TOGETHER_ROWS = 12;

function renderTable(table: ReportTable): string {
  const head = table.columns
    .map((col, i) => `<th${i > 0 ? ' class="num"' : ''}>${escapeHtml(col)}</th>`)
    .join('');
  const body =
    table.rows.length === 0
      ? `<tr><td class="empty" colspan="${table.columns.length}">${escapeHtml(table.emptyText)}</td></tr>`
      : table.rows
          .map((row) => {
            const cells = row.cells
              .map((value, i) => {
                const classes = [i > 0 ? 'num' : '', toneClass(value.tone)]
                  .filter(Boolean)
                  .join(' ');
                const bar =
                  i === 0 && row.ratio !== undefined
                    ? `<div class="bar" style="width:${Math.round(Math.max(0, Math.min(1, row.ratio)) * 100)}%"></div>`
                    : '';
                return `<td${classes ? ` class="${classes}"` : ''}>${escapeHtml(value.text)}${bar}</td>`;
              })
              .join('');
            return `<tr${row.isTotal ? ' class="strong"' : ''}>${cells}</tr>`;
          })
          .join('');
  const title = table.title ? `<h2 class="flow-title">${escapeHtml(table.title)}</h2>` : '';
  const subtitle = table.subtitle
    ? `<div class="muted subtitle flow-title">${escapeHtml(table.subtitle)}</div>`
    : '';
  // Kısa tablo başlığıyla aynı sayfada kalır; uzun tablo bölünür (başlık satırı her sayfada tekrarlanır).
  const keep = table.rows.length <= KEEP_TOGETHER_ROWS ? ' keep' : '';
  return `<section class="split-flow${keep}">${title}${subtitle}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></section>`;
}

/**
 * Kartın tutar yazısı: dar kartta (bir satırda 4+ kart) uzun tutar küçülür; tutar bölünmez (`1.250.000,00 ₺`).
 */
function cardValueSize(text: string, cardsInRow: number): number {
  if (cardsInRow < 4) return 12;
  if (text.length <= 12) return 11;
  if (text.length <= 15) return 9.5;
  return 8;
}

/** Kart satırı: kartlar eşit genişlikte; satırlar arasında boşluk. */
function renderCardRow(cards: readonly ReportCard[]): string {
  const width = 100 / Math.max(1, cards.length);
  const cells = cards
    .map(
      (card) => `<td class="card-cell" style="width:${width}%;">
  <div class="box card">
    <div class="muted">${escapeHtml(card.label)}</div>
    <div class="${toneClass(card.value.tone)}" style="font-size:${cardValueSize(card.value.text, cards.length)}pt; font-weight:800; white-space:nowrap;">${escapeHtml(card.value.text)}</div>
    ${card.detail ? `<div class="muted">${escapeHtml(card.detail)}</div>` : ''}
  </div>
</td>`,
    )
    .join('');
  return `<table class="keep cards"><tr>${cells}</tr></table>`;
}

export function renderReport(doc: ReportDocument): string {
  const cards = doc.cardRows.map(renderCardRow).join('');
  const sideBySide = doc.sideBySide
    ? `<div class="keep"><h2>${escapeHtml(doc.sideBySide.title)}</h2>
<table class="split"><tr>${doc.sideBySide.tables
        .map((table) => `<td class="split-cell">${renderTable(table)}</td>`)
        .join('')}</tr></table></div>`
    : '';
  const body = `<style>
.cards { margin: 0 -4pt 8pt; width: calc(100% + 8pt); table-layout: fixed; }
.card { margin: 0; padding: 8pt 10pt; overflow: hidden; }
.card-cell { padding: 0 4pt; border: none; }
.split { margin: 0 -6pt; width: calc(100% + 12pt); }
.split-cell { width: 50%; padding: 0 6pt; border: none; vertical-align: top; }
.split-cell table th:first-child, .split-cell table td:first-child { width: 50%; }
</style>
${cards}
${sideBySide}
${doc.tables.map(renderTable).join('\n')}`;
  return renderDocument(doc, body);
}
