// iOS (WebKit) PDF sayfalaması. WebKit baskıda tablo başlığını sonraki sayfalarda tekrarlamıyor, satırları sayfa
// sınırında bölüyor ve sabit konumlu alt notu sayfa dibine koymuyor (Faz 7'de iOS simülatöründe ölçüldü).
// Bu yüzden belge yüklenirken içerik sabit yükseklikli sayfalara dağıtılır: her sayfada tablo başlığı, dipte not.
//
// Ölçüler: WebKit baskıda düzeni yazdırılabilir alanın 1,25 katı CSS pikseliyle yapar
// (A4, 32/36 pt kenar boşluğu → 531 × 770 pt → 663 × 962 px). Sayfa yüksekliği güvenlik payıyla biraz kısa tutulur;
// sayfalar zorunlu sayfa sonuyla ayrıldığı için kısa sayfa yalnızca dipte birkaç piksel boşluk bırakır.
//
// Android'de expo-print WebView'da JavaScript kapalıdır; orada Chromium'un kendi baskı kuralları geçerlidir
// (başlık tekrarı, satır bölünmemesi, `@page` alt not kutusu).

import { A4, PAGE_MARGINS } from './layout';

const WEBKIT_PRINT_SCALE = 1.25;

/** Baskı düzeninin genişliği (CSS px). Yükleme ile baskı arasında satır kırılımı değişmesin diye sabittir. */
export const SCRIPT_PAGE_WIDTH_PX = Math.floor(
  (A4.width - PAGE_MARGINS.left - PAGE_MARGINS.right) * WEBKIT_PRINT_SCALE,
);
/** Bir sayfanın yüksekliği (CSS px), güvenlik payıyla. */
export const SCRIPT_PAGE_HEIGHT_PX =
  Math.floor((A4.height - PAGE_MARGINS.top - PAGE_MARGINS.bottom) * WEBKIT_PRINT_SCALE) - 6;
/** Sayfa dibinde alt not için ayrılan yükseklik (CSS px). */
const FOOTER_RESERVE_PX = 26;

export const PAGINATION_STYLES = `
html.js-pages, html.js-pages body { width: ${SCRIPT_PAGE_WIDTH_PX}px; }
.page { position: relative; height: ${SCRIPT_PAGE_HEIGHT_PX}px; overflow: hidden;
  page-break-after: always; break-after: page; }
.page:last-child { page-break-after: auto; break-after: auto; }
.page-body { display: flow-root; }
.page-footer { position: absolute; left: 0; right: 0; bottom: 0; }
`;

/**
 * `#flow` içindeki her çocuk bir öğedir. `section.split-flow` (başlık + tek tablo) satır satır bölünür ve her yeni
 * sayfada tablo başlığı tekrarlanır; `keep` sınıflısı önce bütün olarak taşınmayı dener. Diğer öğeler bölünmez.
 * Alt not `#footer-src`'den her sayfanın dibine kopyalanır. ES5: eski WebView'larda da çalışsın.
 */
export const PAGINATION_SCRIPT = `
(function () {
  var flow = document.getElementById('flow');
  var footerSrc = document.getElementById('footer-src');
  if (!flow) return;
  var limit = ${SCRIPT_PAGE_HEIGHT_PX - FOOTER_RESERVE_PX};
  var root = document.createElement('div');
  flow.parentNode.insertBefore(root, flow);
  var body = null;

  function newPage() {
    var page = document.createElement('div');
    page.className = 'page';
    body = document.createElement('div');
    body.className = 'page-body';
    page.appendChild(body);
    if (footerSrc) {
      var footer = document.createElement('div');
      footer.className = 'page-footer footer';
      footer.innerHTML = footerSrc.innerHTML;
      page.appendChild(footer);
    }
    root.appendChild(page);
  }
  function fits() { return body.offsetHeight <= limit; }
  function isEmpty() { return body.children.length === 0; }
  function toArray(list) { return Array.prototype.slice.call(list); }

  /** Bölünmez öğe: sığmazsa (ve sayfa boş değilse) yeni sayfaya. */
  function placeBlock(item) {
    body.appendChild(item);
    if (!fits() && body.children.length > 1) {
      body.removeChild(item);
      newPage();
      body.appendChild(item);
    }
  }

  /** Tablo kabuğu: başlıkla (ilk parça) veya başlıksız, satırları boş kopya. */
  function shell(section, withTitle) {
    var copy = section.cloneNode(true);
    var tbody = copy.querySelector('tbody');
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild);
    if (!withTitle) {
      toArray(copy.querySelectorAll('.flow-title')).forEach(function (el) { el.parentNode.removeChild(el); });
    }
    body.appendChild(copy);
    return copy;
  }

  function placeSplit(section) {
    if (/\\bkeep\\b/.test(section.className)) {
      body.appendChild(section);
      if (fits()) return;
      body.removeChild(section);
      if (!isEmpty()) {
        newPage();
        body.appendChild(section);
        if (fits()) return;
        body.removeChild(section);
      }
    }
    var rows = toArray(section.querySelector('tbody').rows);
    var part = shell(section, true);
    var tbody = part.querySelector('tbody');
    var placed = 0;
    rows.forEach(function (row) {
      tbody.appendChild(row);
      if (fits()) { placed += 1; return; }
      tbody.removeChild(row);
      if (placed === 0) {
        // Başlık + ilk satır sığmadı: parçanın tamamı yeni sayfaya.
        body.removeChild(part);
        newPage();
        body.appendChild(part);
      } else {
        newPage();
        part = shell(section, false);
        tbody = part.querySelector('tbody');
      }
      tbody.appendChild(row);
      placed += 1;
    });
  }

  newPage();
  toArray(flow.children).forEach(function (item) {
    if (/\\bsplit-flow\\b/.test(item.className) && item.querySelector('tbody')) placeSplit(item);
    else placeBlock(item);
  });
  flow.parentNode.removeChild(flow);
  if (footerSrc) footerSrc.parentNode.removeChild(footerSrc);
})();
`;
