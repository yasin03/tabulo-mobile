// Yedekleme / geri yükleme (10.3): tüm tablolar ham satırlarıyla okunur ve tek transaction'da geri yazılır.
// Biçim ve doğrulama src/core/backup.ts'te; dosyalar src/platform/backupFiles.ts'te.

import { sql } from 'drizzle-orm';

import { BACKUP_TABLES, type BackupRow, type BackupTables } from '@/core/backup';
import type { Language } from '@/core/i18n';

import { localizeSeedRecords } from '../seed';
import type { Db } from '../types';

/** Tek INSERT'teki en fazla satır (SQLite değişken sınırının çok altında kalır). */
const INSERT_CHUNK = 200;

const columnList = (columns: readonly string[]) =>
  sql.join(
    columns.map((column) => sql.identifier(column)),
    sql`, `,
  );

export function createBackupRepo(db: Db) {
  return {
    /** Tüm tabloların ham satırları (silinmişler dahil), ekleme sırasıyla. */
    async exportTables(): Promise<BackupTables> {
      const tables: BackupTables = {};
      for (const { name, columns } of BACKUP_TABLES) {
        tables[name] = db.all<BackupRow>(
          sql`SELECT ${columnList(columns)} FROM ${sql.identifier(name)} ORDER BY rowid`,
        );
      }
      return tables;
    },

    /** Yedeğe değer veri var mı (cari veya hareket)? Hatırlatma için. */
    async hasData(): Promise<boolean> {
      const rows = db.all<{ n: number }>(
        sql`SELECT (SELECT COUNT(*) FROM contacts) + (SELECT COUNT(*) FROM transactions) AS n`,
      );
      return (rows[0]?.n ?? 0) > 0;
    },

    /**
     * Mevcut verilerin tamamını siler ve yedektekileri yükler; tek transaction'dır, herhangi bir hata
     * (yabancı anahtar, NOT NULL…) olursa hiçbir şey değişmez. `tables` `parseBackup` ile doğrulanmış olmalı.
     * Ardından hazır kayıt adları uygulama diline uydurulur (açılıştaki gibi).
     */
    async restore(tables: BackupTables, language: Language): Promise<void> {
      db.transaction((tx) => {
        for (const { name } of [...BACKUP_TABLES].reverse()) {
          tx.run(sql`DELETE FROM ${sql.identifier(name)}`);
        }
        for (const { name, columns } of BACKUP_TABLES) {
          const rows = tables[name] ?? [];
          for (let start = 0; start < rows.length; start += INSERT_CHUNK) {
            const values = rows.slice(start, start + INSERT_CHUNK).map(
              (row) =>
                sql`(${sql.join(
                  columns.map((column) => sql`${row[column] ?? null}`),
                  sql`, `,
                )})`,
            );
            tx.run(
              sql`INSERT INTO ${sql.identifier(name)} (${columnList(columns)}) VALUES ${sql.join(values, sql`, `)}`,
            );
          }
        }
      });
      localizeSeedRecords(db, language);
    },
  };
}

export type BackupRepo = ReturnType<typeof createBackupRepo>;
