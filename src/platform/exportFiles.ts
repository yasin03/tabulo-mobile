// Dışa aktarılan dosyalar (Faz 7): HTML → PDF (expo-print), Excel dosyası yazma, sistem paylaş ekranı.
// Dosyalar önbellekteki `exports/` klasörüne yazılır; her dışa aktarmada eski dosyalar silinir.

import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { A4, PAGE_MARGINS } from '@/pdf/html';

import { resolveAttachmentUri } from './attachments';

const EXPORTS_FOLDER = 'exports';

export const MIME = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const;

const UTI = { pdf: 'com.adobe.pdf', xlsx: 'org.openxmlformats.spreadsheetml.sheet' } as const;

export type ExportKind = keyof typeof MIME;

/** Boş `exports/` klasörü; önceki dışa aktarmalardan kalan dosyalar silinir. */
function freshExportsDirectory(): Directory {
  const directory = new Directory(Paths.cache, EXPORTS_FOLDER);
  if (directory.exists) directory.delete();
  directory.create({ intermediates: true });
  return directory;
}

/** A4 PDF üretir ve `fileName` adıyla kaydeder; dosya adresini döner. */
export async function createPdf(html: string, fileName: string): Promise<string> {
  const { uri } = await Print.printToFileAsync({
    html,
    width: A4.width,
    height: A4.height,
    margins: PAGE_MARGINS,
  });
  const target = new File(freshExportsDirectory(), fileName);
  new File(uri).move(target);
  return target.uri;
}

/** Base64 içeriği (`XLSX.write(..., { type: 'base64' })`) dosyaya yazar; adresini döner. */
export function writeBase64File(base64: string, fileName: string): string {
  const target = new File(freshExportsDirectory(), fileName);
  target.create();
  target.write(base64, { encoding: 'base64' });
  return target.uri;
}

/** Sistem paylaş ekranı (WhatsApp, e-posta, Dosyalar'a kaydet…). Paylaşım yoksa `false`. */
export async function shareFile(uri: string, kind: ExportKind, dialogTitle?: string) {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, { mimeType: MIME[kind], UTI: UTI[kind], dialogTitle });
  return true;
}

/** İşletme logosunu PDF'e gömmek için data URI'ye çevirir (iOS WKWebView yerel dosya yüklemez). */
export async function logoDataUri(logoUri: string | null | undefined): Promise<string | null> {
  if (!logoUri) return null;
  try {
    const file = new File(resolveAttachmentUri(logoUri));
    if (!file.exists) return null;
    return `data:image/jpeg;base64,${await file.base64()}`;
  } catch {
    return null;
  }
}
