// Yedek al / geri yükle akışı (10.3): repository (tablolar) + platform (dosyalar) + core (biçim, doğrulama).

import Constants from 'expo-constants';

import {
  backupFileName,
  backupFilePaths,
  createBackupData,
  parseBackup,
  summarizeBackup,
  type BackupData,
  type BackupSummary,
} from '@/core/backup';
import { toIsoDate } from '@/core/dates';
import { DomainError, isDomainError } from '@/core/errors';
import type { Language } from '@/core/i18n';
import { backupRepo } from '@/db';
import {
  discardRestoreFiles,
  existingBackupFiles,
  installRestoredFiles,
  openBackupFile,
  writeBackupFile,
} from '@/platform/backupFiles';
import { usePreferences } from '@/stores/preferences';
import { clearTransactionDraft } from '@/stores/transactionDraft';

export interface CreatedBackup {
  uri: string;
  kind: 'json' | 'zip';
}

/** Tüm tabloları (+ varsa belgeleri) tek dosyaya yazar: belge yoksa JSON, varsa zip. */
export async function createBackup(language: Language): Promise<CreatedBackup> {
  const tables = await backupRepo.exportTables();
  const files = existingBackupFiles(backupFilePaths(tables));
  const data = createBackupData({
    tables,
    files,
    createdAt: new Date(),
    appVersion: Constants.expoConfig?.version ?? null,
    settings: { defaultRemindTime: usePreferences.getState().defaultRemindTime },
  });
  const kind = files.length > 0 ? 'zip' : 'json';
  const uri = await writeBackupFile(
    JSON.stringify(data),
    files,
    backupFileName(toIsoDate(), language, kind),
  );
  return { uri, kind };
}

export interface PreparedRestore {
  data: BackupData;
  summary: BackupSummary;
}

/**
 * Seçilen dosyayı açar ve doğrular; henüz hiçbir şeyi değiştirmez (onay bundan sonra sorulur).
 * Okunamayan / eksik dosyalı yedek `backupInvalid` olur.
 */
export async function prepareRestore(uri: string): Promise<PreparedRestore> {
  try {
    const opened = await openBackupFile(uri);
    const data = parseBackup(opened.json);
    const extracted = new Set(opened.files);
    if (!data.files.every((path) => extracted.has(path))) throw new DomainError('backupInvalid');
    return { data, summary: summarizeBackup(data) };
  } catch (error) {
    discardRestoreFiles();
    if (isDomainError(error)) throw error;
    if (__DEV__) console.warn('[backup] okunamadı', error);
    throw new DomainError('backupInvalid');
  }
}

/**
 * Mevcut verileri silip yedeği yükler. Veritabanı tek transaction'dır: başarısız olursa hiçbir şey
 * değişmez. Ardından yedekteki ayarlar (varsayılan hatırlatma saati) uygulanır, belgeler yerine konur ve
 * yarım kalan hareket taslağı silinir (eski carilere bağlı).
 */
export async function applyRestore(prepared: PreparedRestore, language: Language): Promise<void> {
  try {
    await backupRepo.restore(prepared.data.tables, language);
  } catch (error) {
    discardRestoreFiles();
    throw error;
  }
  clearTransactionDraft();
  const { defaultRemindTime } = prepared.data.settings;
  if (defaultRemindTime) usePreferences.getState().setDefaultRemindTime(defaultRemindTime);
  await installRestoredFiles(prepared.data.files);
}

export { discardRestoreFiles as cancelRestore };
