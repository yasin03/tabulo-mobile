// Yedek dosyaları (10.3): JSON / zip yazma, sistem dosya seçicisinden okuma, belgeleri yerine koyma.
// Geri yüklemede zip önce geçici bir klasöre açılır; veritabanı başarıyla yüklendikten SONRA belgeler
// asıl klasörlere taşınır. Böylece bozuk bir yedek mevcut dosyalara dokunmaz.

import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, FileMode, Paths } from 'expo-file-system';

import { BACKUP_JSON_NAME, isBackupFilePath } from '@/core/backup';
import {
  isZip,
  memorySink,
  readZip,
  writeZip,
  type ByteSink,
  type ByteSource,
  type ZipEntry,
} from '@/lib/zipStream';

import { ATTACHMENTS_FOLDER } from './attachments';

const BACKUPS_FOLDER = 'backups';
const STAGING_FOLDER = 'restore-staging';
/** Yedeğe giren dosya klasörleri (belgeler klasörüne göre). */
const FILE_FOLDERS = [ATTACHMENTS_FOLDER, 'logo'] as const;

function freshDirectory(parent: Directory | string, name: string): Directory {
  const directory = new Directory(parent, name);
  if (directory.exists) directory.delete();
  directory.create({ intermediates: true });
  return directory;
}

function fileSource(file: File): ByteSource {
  const handle = file.open(FileMode.ReadOnly);
  return {
    size: file.size,
    readBytes: (length) => handle.readBytes(length),
    close: () => handle.close(),
  };
}

function fileSink(file: File): ByteSink {
  file.create({ intermediates: true, overwrite: true });
  const handle = file.open(FileMode.WriteOnly);
  return { writeBytes: (bytes) => handle.writeBytes(bytes), close: () => handle.close() };
}

/** Belgeler klasöründe gerçekten bulunan dosyalar (silinmiş dosyası olan kayıtlar atlanır). */
export function existingBackupFiles(paths: readonly string[]): string[] {
  return paths.filter((path) => {
    try {
      return new File(Paths.document, path).exists;
    } catch {
      return false;
    }
  });
}

/**
 * Yedeği önbellekteki `backups/` klasörüne yazar (öncekiler silinir) ve adresini döner.
 * Dosya yoksa düz JSON, varsa JSON + dosyalar tek bir zip.
 */
export async function writeBackupFile(
  json: string,
  files: readonly string[],
  fileName: string,
): Promise<string> {
  const target = new File(freshDirectory(Paths.cache, BACKUPS_FOLDER), fileName);
  if (files.length === 0) {
    target.create();
    target.write(json);
    return target.uri;
  }

  const entries: ZipEntry[] = [
    { name: BACKUP_JSON_NAME, text: json },
    ...files.map((path) => ({
      name: path,
      open: () => fileSource(new File(Paths.document, path)),
    })),
  ];
  const sink = fileSink(target);
  try {
    await writeZip(sink, entries);
  } finally {
    sink.close();
  }
  return target.uri;
}

/** Sistem dosya seçicisi (iCloud Drive, Google Drive, Dosyalar…). Vazgeçilirse `null`. */
export async function pickBackupFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    // Paylaşılan JSON/zip bazı bulut uygulamalarında genel türle gelir; içerik ayrıca doğrulanır.
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}

export interface OpenedBackup {
  json: string;
  /** Geçici klasöre açılan dosyaların göreli yolları. */
  files: string[];
}

/**
 * Seçilen yedeği okur: düz JSON veya zip. Zip'teki belge ve logo dosyaları geçici klasöre yazılır;
 * yalnızca güvenli yollar (`isBackupFilePath`) kabul edilir, diğerleri atlanır.
 */
export async function openBackupFile(uri: string): Promise<OpenedBackup> {
  const file = new File(uri);
  const head = file.open(FileMode.ReadOnly);
  let zip: boolean;
  try {
    zip = isZip(head.readBytes(4));
  } finally {
    head.close();
  }
  if (!zip) return { json: await file.text(), files: [] };

  const staging = freshDirectory(Paths.cache, STAGING_FOLDER);
  const json = memorySink();
  let hasJson = false;
  const files: string[] = [];
  const source = fileSource(file);
  try {
    await readZip(source, (name) => {
      if (name === BACKUP_JSON_NAME) {
        hasJson = true;
        return json;
      }
      if (!isBackupFilePath(name)) return null;
      files.push(name);
      return fileSink(new File(staging, name));
    });
  } finally {
    source.close();
  }
  return { json: hasJson ? json.text() : '', files };
}

/**
 * Veritabanı geri yüklendikten sonra: mevcut belge ve logo klasörleri silinir, yedekteki dosyalar
 * geçici klasörden yerlerine taşınır.
 */
export async function installRestoredFiles(files: readonly string[]): Promise<void> {
  for (const folder of FILE_FOLDERS) freshDirectory(Paths.document, folder);
  const staging = new Directory(Paths.cache, STAGING_FOLDER);
  for (const path of files) {
    await new File(staging, path).move(new File(Paths.document, path));
  }
  discardRestoreFiles();
}

/** Geçici klasörü siler (vazgeçildiğinde / hata olduğunda). */
export function discardRestoreFiles() {
  try {
    const staging = new Directory(Paths.cache, STAGING_FOLDER);
    if (staging.exists) staging.delete();
  } catch {
    // Önbellek; sistem de temizleyebilir.
  }
}
