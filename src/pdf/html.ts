// PDF şablonlarının ortak parçaları (expo-print: HTML → A4 PDF).
// Şablonlar saf TypeScript'tir: metinler ve tutarlar çağıran tarafta çevrilip biçimlenmiş gelir.
// Kâğıt her zaman beyazdır; renkler açık temanın tokenlarından alınır.

import { colorTokens } from '@/core/theme/tokens';

import { PAGE_MARGINS } from './layout';
import { PAGINATION_SCRIPT, PAGINATION_STYLES } from './paginate';

export { A4, PAGE_MARGINS } from './layout';

export type Tone = 'positive' | 'negative' | 'neutral';

const c = colorTokens.light;

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ESCAPES[ch] ?? ch);
}

/** İşletme bilgileri (Ayarlar → İşletme profili). */
export interface BusinessHeader {
  name: string;
  /** Adres, telefon, e-posta, vergi bilgisi… boş satırlar gösterilmez. */
  lines: string[];
  /** `data:image/jpeg;base64,…` (iOS WKWebView yerel dosya adresini yüklemez). */
  logoDataUri?: string | null;
}

export interface DocumentFrame {
  /** `<html lang>` */
  lang: string;
  title: string;
  business: BusinessHeader;
  /** Sağ üstteki başlık ("Cari Hesap Ekstresi") ve altındaki satırlar (tarih aralığı…). */
  heading: string;
  headingLines: string[];
  /** Her sayfanın dibindeki küçük not ("Tabulo ile oluşturuldu · …"). */
  footer: string;
  /**
   * Sayfalama: `script` belge içi script ile (iOS WebKit), `css` motorun baskı kurallarıyla (Android Chromium;
   * expo-print orada JavaScript çalıştırmaz). Bkz. paginate.ts.
   */
  pagination: 'script' | 'css';
}

/** CSS `content` dizesi için kaçış. */
const cssString = (value: string) =>
  `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;

export const toneClass = (tone: Tone | undefined) =>
  tone === 'positive' ? 'pos' : tone === 'negative' ? 'neg' : '';

const lines = (values: readonly string[], className: string) =>
  values
    .filter((value) => value.trim() !== '')
    .map((value) => `<div class="${className}">${escapeHtml(value)}</div>`)
    .join('');

const FONT_STACK = '-apple-system, "Helvetica Neue", Roboto, "Segoe UI", Arial, sans-serif';

const STYLES = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #FFFFFF; }
body {
  font-family: ${FONT_STACK};
  font-size: 9.5pt; line-height: 1.4; color: ${c.foreground};
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16pt;
  padding-bottom: 12pt; border-bottom: 2pt solid ${c.primary}; margin-bottom: 14pt; }
.brand { display: flex; gap: 10pt; align-items: flex-start; max-width: 60%; }
.logo { width: 52pt; height: 52pt; object-fit: contain; border-radius: 8pt; }
.business { font-size: 13pt; font-weight: 800; color: ${c.primary}; }
.muted { color: ${c.muted}; font-size: 8.5pt; }
.heading { text-align: right; }
.heading h1 { margin: 0 0 4pt; font-size: 15pt; font-weight: 800; color: ${c.primary}; }
.box { border: 1pt solid ${c.border}; border-radius: 8pt; padding: 10pt 12pt; margin-bottom: 14pt; }
.box-title { font-size: 11pt; font-weight: 800; margin-bottom: 2pt; }
h2 { font-size: 11pt; font-weight: 800; color: ${c.primary}; margin: 16pt 0 6pt;
  page-break-after: avoid; break-after: avoid; }
.subtitle { margin: -4pt 0 6pt; }
table { width: 100%; border-collapse: collapse; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; break-inside: avoid; }
th { white-space: nowrap; text-align: left; font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3pt;
  color: ${c.muted}; background: ${c['surface-secondary']}; padding: 6pt; }
td { padding: 6pt; border-bottom: 0.75pt solid ${c.separator}; vertical-align: top; }
.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.nowrap { white-space: nowrap; }
.type { font-weight: 700; }
.pos { color: ${c.positive}; }
.neg { color: ${c.negative}; }
.strong td { font-weight: 700; background: ${c.background}; }
.empty { text-align: center; color: ${c.muted}; padding: 16pt 6pt; }
.bar { height: 4pt; border-radius: 2pt; background: ${c.negative}; margin-top: 3pt; }
.footer { text-align: center; color: ${c.muted}; font-size: 7.5pt; }
.keep { page-break-inside: avoid; break-inside: avoid; }
`;

/**
 * Ortak sayfa iskeleti: başlık (logo, işletme bilgileri, belge başlığı) + gövde + her sayfanın dibinde alt not.
 * `body`, `#flow`'un doğrudan çocukları olarak sayfalanacak öğelerdir (bkz. paginate.ts).
 */
export function renderDocument(frame: DocumentFrame, body: string): string {
  const { business } = frame;
  const script = frame.pagination === 'script';
  const logo = business.logoDataUri
    ? `<img class="logo" src="${escapeHtml(business.logoDataUri)}" alt="" />`
    : '';
  return `<!DOCTYPE html>
<html lang="${escapeHtml(frame.lang)}"${script ? ' class="js-pages"' : ''}>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(frame.title)}</title>
<style>${STYLES}${
    script
      ? PAGINATION_STYLES
      : // iOS'ta kenar boşlukları expo-print "margins" seçeneğinden gelir; @page kuralı orada ölçeği değiştirir.
        `@page { size: A4; margin: ${PAGE_MARGINS.top}pt ${PAGE_MARGINS.right}pt ${PAGE_MARGINS.bottom}pt ${PAGE_MARGINS.left}pt;
  @bottom-center { content: ${cssString(frame.footer)}; font-family: ${FONT_STACK}; font-size: 7.5pt; color: ${c.muted}; } }`
  }</style>
</head>
<body>
<div id="flow">
<div class="header">
  <div class="brand">${logo}<div>${
    business.name ? `<div class="business">${escapeHtml(business.name)}</div>` : ''
  }${lines(business.lines, 'muted')}</div></div>
  <div class="heading"><h1>${escapeHtml(frame.heading)}</h1>${lines(frame.headingLines, 'muted')}</div>
</div>
${body}
</div>
${
  script
    ? `<div id="footer-src" class="footer">${escapeHtml(frame.footer)}</div>
<script>${PAGINATION_SCRIPT}</script>`
    : ''
}
</body>
</html>`;
}
