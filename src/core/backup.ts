// Yedek dosyası (10.3): tüm tablolar + `schemaVersion` + oluşturulma zamanı tek bir JSON'da.
// Belge/logo dosyaları varsa JSON onlarla birlikte bir zip'e konur (zip'i src/platform/backupFiles.ts yazar).
//
// Satırlar veritabanındaki HAM haliyle saklanır (sütun adları snake_case, zaman damgası ms tam sayı,
// boolean 0/1); silinmiş (`deleted_at` dolu) kayıtlar da yedeğe girer. Böylece geri yükleme birebir aynı
// veritabanını kurar ve ileride senkronizasyonla çakışmaz (kimlikler UUIDv7).

import { getTableColumns, getTableName } from 'drizzle-orm';

import {
  accounts,
  attachments,
  businessProfile,
  contacts,
  recurringPayments,
  reminders,
  subjects,
  transactions,
  transactionTypes,
} from '@/db/schema';

import { daysBetween, isTimeOfDay } from './dates';
import { DomainError } from './errors';
import type { Language } from './i18n';

export const BACKUP_APP_ID = 'tabulo';

/**
 * Yedeğin veritabanı şema sürümü = migration sayısı (test kontrol eder). Yeni migration eklenince artır;
 * eski sürümlü yedekler için `upgradeBackup`'a dönüştürme adımı ekle.
 */
export const BACKUP_SCHEMA_VERSION = 1;

/** Zip içinde JSON'un adı. */
export const BACKUP_JSON_NAME = 'tabulo-backup.json';

/** "Son yedek 30 günden eski" hatırlatması (10.3). */
export const BACKUP_REMINDER_DAYS = 30;

/** Yedekteki tablolar, yabancı anahtar sırasıyla: geri yüklemede bu sırayla eklenir, tersiyle silinir. */
const TABLES = [
  businessProfile,
  contacts,
  accounts,
  transactionTypes,
  subjects,
  recurringPayments,
  transactions,
  attachments,
  reminders,
] as const;

export interface BackupTableSpec {
  name: string;
  columns: readonly string[];
}

export const BACKUP_TABLES: readonly BackupTableSpec[] = TABLES.map((table) => ({
  name: getTableName(table),
  columns: Object.values(getTableColumns(table)).map((column) => column.name),
}));

export type BackupValue = string | number | null;
export type BackupRow = Record<string, BackupValue>;
/** Tablo adı → ham satırlar. */
export type BackupTables = Record<string, BackupRow[]>;

export interface BackupData {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  /** ISO 8601 zaman damgası. */
  createdAt: string;
  appVersion: string | null;
  tables: BackupTables;
  /** Zip'teki belge/logo dosyalarının göreli yolları (`attachments/<id>.jpg`, `logo/<id>.jpg`). */
  files: string[];
  /** Cihaz ayarlarından yedeğe girenler (veritabanında değil, MMKV'de tutulur). */
  settings: BackupSettings;
}

export interface BackupSettings {
  /** Yeni düzenli ödeme / hatırlatıcıda varsayılan saat (`SS:DD`). Eski yedeklerde yoksa `null`. */
  defaultRemindTime: string | null;
}

/**
 * Yedeğe girebilecek dosya yolu: yalnızca belgeler ve logo klasörü, kimlikten türeyen ad.
 * Geri yüklemede zip'ten gelen adlar bununla süzülür (`../` gibi yollar dışarı yazamaz).
 */
export function isBackupFilePath(path: string): boolean {
  return /^(attachments|logo)\/[A-Za-z0-9_-]{1,64}\.(jpg|jpeg|png|pdf)$/i.test(path);
}

/** Kayıtlardaki belge ve logo dosyalarının göreli yolları (silinmiş belgeler dahil, tekrarsız). */
export function backupFilePaths(tables: BackupTables): string[] {
  const paths = new Set<string>();
  for (const row of tables.attachments ?? []) {
    if (typeof row.file_uri === 'string' && isBackupFilePath(row.file_uri)) paths.add(row.file_uri);
  }
  for (const row of tables.business_profile ?? []) {
    if (typeof row.logo_uri === 'string' && isBackupFilePath(row.logo_uri)) paths.add(row.logo_uri);
  }
  return [...paths];
}

export function createBackupData(input: {
  tables: BackupTables;
  files: string[];
  createdAt: Date;
  appVersion: string | null;
  settings: BackupSettings;
}): BackupData {
  return {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: input.createdAt.toISOString(),
    appVersion: input.appVersion,
    tables: input.tables,
    files: input.files,
    settings: input.settings,
  };
}

/** `tabulo-yedek-2026-10-23.json` / `tabulo-backup-2026-10-23.zip`. */
export function backupFileName(isoDate: string, language: Language, kind: 'json' | 'zip'): string {
  return `tabulo-${language === 'tr' ? 'yedek' : 'backup'}-${isoDate}.${kind}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBackupValue(value: unknown): value is BackupValue {
  return (
    value === null ||
    typeof value === 'string' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

/** Eski şema sürümlü yedeği güncel sürüme getirir. Şimdilik tek sürüm var. */
function upgradeBackup(data: BackupData): BackupData {
  return data;
}

/** Ayarlar isteğe bağlıdır: eksik veya geçersiz değer yok sayılır (geri yüklemede mevcut ayar kalır). */
function parseSettings(value: unknown): BackupSettings {
  const settings = isRecord(value) ? value : {};
  const time = settings.defaultRemindTime;
  return { defaultRemindTime: typeof time === 'string' && isTimeOfDay(time) ? time : null };
}

/**
 * Yedek JSON'unu okur ve doğrular. Biçim bozuksa `backupInvalid`, uygulamadan yeni bir şema sürümüyle
 * alınmışsa `backupTooNew` fırlatır. Her tablo bulunmalı, her satırda tam olarak tablonun sütunları olmalı;
 * yabancı anahtar ve NOT NULL kuralları geri yükleme transaction'ında SQLite tarafından denetlenir.
 */
export function parseBackup(text: string): BackupData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new DomainError('backupInvalid');
  }
  if (!isRecord(raw) || raw.app !== BACKUP_APP_ID) throw new DomainError('backupInvalid');

  const { schemaVersion, createdAt, appVersion, tables, files, settings } = raw;
  if (typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 1) {
    throw new DomainError('backupInvalid');
  }
  if (schemaVersion > BACKUP_SCHEMA_VERSION) throw new DomainError('backupTooNew');
  if (typeof createdAt !== 'string' || Number.isNaN(Date.parse(createdAt))) {
    throw new DomainError('backupInvalid');
  }
  if (!isRecord(tables)) throw new DomainError('backupInvalid');
  if (!Array.isArray(files) || !files.every((f) => typeof f === 'string' && isBackupFilePath(f))) {
    throw new DomainError('backupInvalid');
  }

  const parsed: BackupTables = {};
  for (const spec of BACKUP_TABLES) {
    const rows = tables[spec.name];
    if (!Array.isArray(rows)) throw new DomainError('backupInvalid');
    const ids = new Set<string>();
    for (const row of rows) {
      if (!isRecord(row)) throw new DomainError('backupInvalid');
      const keys = Object.keys(row);
      if (keys.length !== spec.columns.length || !spec.columns.every((c) => c in row)) {
        throw new DomainError('backupInvalid');
      }
      if (!keys.every((key) => isBackupValue(row[key]))) throw new DomainError('backupInvalid');
      const id = row.id;
      if (typeof id !== 'string' || !id || ids.has(id)) throw new DomainError('backupInvalid');
      ids.add(id);
    }
    parsed[spec.name] = rows as BackupRow[];
  }

  // Uygulama tek işletme profili satırıyla çalışır (hazır veri işareti de odur).
  const profiles = parsed.business_profile ?? [];
  if (profiles.length !== 1 || profiles[0]?.id !== 'default')
    throw new DomainError('backupInvalid');

  return upgradeBackup({
    app: BACKUP_APP_ID,
    schemaVersion,
    createdAt,
    appVersion: typeof appVersion === 'string' ? appVersion : null,
    tables: parsed,
    files: [...new Set(files as string[])],
    settings: parseSettings(settings),
  });
}

export interface BackupSummary {
  /** ISO 8601 zaman damgası. */
  createdAt: string;
  businessName: string;
  contacts: number;
  transactions: number;
  attachments: number;
}

/** Geri yükleme onayında gösterilen özet: silinmemiş kayıt sayıları. */
export function summarizeBackup(data: BackupData): BackupSummary {
  const live = (name: string) =>
    (data.tables[name] ?? []).filter((row) => row.deleted_at === null).length;
  const name = data.tables.business_profile?.[0]?.name;
  return {
    createdAt: data.createdAt,
    businessName: typeof name === 'string' ? name : '',
    contacts: live('contacts'),
    transactions: live('transactions'),
    attachments: live('attachments'),
  };
}

export type BackupReminder = 'none' | 'never' | 'stale';

/**
 * Ayarlar'daki nazik hatırlatma: son yedek 30 günden eskiyse `stale`; hiç yedek alınmadıysa ve
 * kaydedilmeye değer veri varsa `never`.
 */
export function backupReminder(input: {
  lastBackupDate: string | null;
  today: string;
  hasData: boolean;
}): BackupReminder {
  if (!input.lastBackupDate) return input.hasData ? 'never' : 'none';
  return daysBetween(input.lastBackupDate, input.today) > BACKUP_REMINDER_DAYS ? 'stale' : 'none';
}
