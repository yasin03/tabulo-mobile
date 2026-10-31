/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';

import {
  BACKUP_SCHEMA_VERSION,
  BACKUP_TABLES,
  backupFileName,
  backupFilePaths,
  backupReminder,
  createBackupData,
  isBackupFilePath,
  parseBackup,
  summarizeBackup,
  type BackupData,
  type BackupRow,
  type BackupTables,
} from './backup';
import type { DomainErrorCode } from './errors';

function row(table: string, values: BackupRow = {}): BackupRow {
  const spec = BACKUP_TABLES.find((t) => t.name === table)!;
  return { ...Object.fromEntries(spec.columns.map((c) => [c, null])), ...values };
}

function emptyTables(): BackupTables {
  const tables: BackupTables = Object.fromEntries(BACKUP_TABLES.map((t) => [t.name, []]));
  tables.business_profile = [row('business_profile', { id: 'default', name: 'Demir Ticaret' })];
  return tables;
}

function backup(patch: Partial<BackupData> = {}): BackupData {
  return {
    ...createBackupData({
      tables: emptyTables(),
      files: [],
      createdAt: new Date('2026-10-23T10:00:00Z'),
      appVersion: '1.0.0',
      settings: { defaultRemindTime: '08:30' },
    }),
    ...patch,
  };
}

function expectIssue(text: string, code: DomainErrorCode) {
  expect(() => parseBackup(text)).toThrow(expect.objectContaining({ code }));
}

describe('BACKUP_SCHEMA_VERSION', () => {
  it('migration sayısına eşit (yeni migration eklenince artırılmalı)', () => {
    const folder = path.join(__dirname, '../db/migrations');
    const migrations = fs
      .readdirSync(folder, { withFileTypes: true })
      .filter((entry) => entry.isDirectory());
    expect(BACKUP_SCHEMA_VERSION).toBe(migrations.length);
  });
});

describe('parseBackup', () => {
  it('geçerli yedeği okur', () => {
    const data = backup({ files: ['attachments/a-1.jpg'] });
    expect(parseBackup(JSON.stringify(data))).toEqual(data);
  });

  it('sürüm 1 yedeğini yükseltir: düzenli ödemeden gelen cari hareketleri peşin', () => {
    const tables = emptyTables();
    const tx = (id: string, values: BackupRow) => {
      const { is_cash: _, ...rest } = row('transactions', { id, ...values });
      return rest;
    };
    tables.transactions = [
      tx('t1', { movement_type: 'payment', contact_id: 'c1', recurring_payment_id: 'r1' }),
      tx('t2', { movement_type: 'payment', contact_id: 'c1' }),
      tx('t3', { movement_type: 'payment', recurring_payment_id: 'r1' }),
    ];
    const parsed = parseBackup(JSON.stringify(backup({ schemaVersion: 1, tables })));
    expect(parsed.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(parsed.tables.transactions!.map((r) => [r.id, r.is_cash])).toEqual([
      ['t1', 1],
      ['t2', 0],
      ['t3', 0],
    ]);
  });

  it('JSON olmayan veya başka uygulamanın dosyasını reddeder', () => {
    expectIssue('merhaba', 'backupInvalid');
    expectIssue('[]', 'backupInvalid');
    expectIssue(JSON.stringify({ ...backup(), app: 'baska' }), 'backupInvalid');
  });

  it('daha yeni şema sürümünü ayrı hatayla reddeder', () => {
    expectIssue(
      JSON.stringify(backup({ schemaVersion: BACKUP_SCHEMA_VERSION + 1 })),
      'backupTooNew',
    );
    expectIssue(JSON.stringify(backup({ schemaVersion: 0 })), 'backupInvalid');
  });

  it('eksik tabloyu, eksik/fazla sütunu ve tekrar eden kimliği reddeder', () => {
    const missingTable = backup();
    delete missingTable.tables.reminders;
    expectIssue(JSON.stringify(missingTable), 'backupInvalid');

    const missingColumn = backup();
    const contact = row('contacts', { id: 'c1', name: 'Ali' });
    delete contact.phone;
    missingColumn.tables.contacts = [contact];
    expectIssue(JSON.stringify(missingColumn), 'backupInvalid');

    const extraColumn = backup();
    extraColumn.tables.contacts = [{ ...row('contacts', { id: 'c1', name: 'Ali' }), hacked: 1 }];
    expectIssue(JSON.stringify(extraColumn), 'backupInvalid');

    const duplicate = backup();
    duplicate.tables.contacts = [row('contacts', { id: 'c1' }), row('contacts', { id: 'c1' })];
    expectIssue(JSON.stringify(duplicate), 'backupInvalid');
  });

  it('nesne değerlerini ve güvenli olmayan dosya yollarını reddeder', () => {
    const nested = backup();
    nested.tables.contacts = [row('contacts', { id: 'c1', name: { x: 1 } as unknown as string })];
    expectIssue(JSON.stringify(nested), 'backupInvalid');
    expectIssue(JSON.stringify(backup({ files: ['../tabulo.db'] })), 'backupInvalid');
  });

  it('tek işletme profili satırı ister', () => {
    const noProfile = backup();
    noProfile.tables.business_profile = [];
    expectIssue(JSON.stringify(noProfile), 'backupInvalid');
  });
});

describe('ayarlar', () => {
  it('varsayılan hatırlatma saatini taşır; eksik veya geçersizse null', () => {
    expect(parseBackup(JSON.stringify(backup())).settings).toEqual({ defaultRemindTime: '08:30' });
    const { settings: _omit, ...old } = backup();
    expect(parseBackup(JSON.stringify(old)).settings).toEqual({ defaultRemindTime: null });
    const invalid = backup({ settings: { defaultRemindTime: '25:99' } });
    expect(parseBackup(JSON.stringify(invalid)).settings).toEqual({ defaultRemindTime: null });
  });
});

describe('dosya yolları', () => {
  it('yalnızca belgeler ve logo klasöründeki kimlik adlı dosyalar', () => {
    expect(isBackupFilePath('attachments/0199f2a4-7c1e-7b3a-9d1e-1c2b3a4d5e6f.jpg')).toBe(true);
    expect(isBackupFilePath('attachments/x.pdf')).toBe(true);
    expect(isBackupFilePath('logo/x.jpg')).toBe(true);
    expect(isBackupFilePath('attachments/../x.jpg')).toBe(false);
    expect(isBackupFilePath('/attachments/x.jpg')).toBe(false);
    expect(isBackupFilePath('SQLite/tabulo.db')).toBe(false);
    expect(isBackupFilePath('attachments/x.exe')).toBe(false);
  });

  it('kayıtlardan belge ve logo yollarını toplar', () => {
    const tables = emptyTables();
    tables.business_profile![0]!.logo_uri = 'logo/l1.jpg';
    tables.attachments = [
      row('attachments', { id: 'a1', file_uri: 'attachments/a1.jpg' }),
      row('attachments', { id: 'a2', file_uri: 'attachments/a2.pdf', deleted_at: 1 }),
      row('attachments', { id: 'a3', file_uri: 'file:///eski/yol.jpg' }),
    ];
    expect(backupFilePaths(tables).sort()).toEqual([
      'attachments/a1.jpg',
      'attachments/a2.pdf',
      'logo/l1.jpg',
    ]);
  });
});

describe('backupFileName', () => {
  it('dile göre ad (10.3)', () => {
    expect(backupFileName('2026-10-23', 'tr', 'json')).toBe('tabulo-yedek-2026-10-23.json');
    expect(backupFileName('2026-10-23', 'en', 'zip')).toBe('tabulo-backup-2026-10-23.zip');
  });
});

describe('summarizeBackup', () => {
  it('silinmemiş kayıtları sayar', () => {
    const data = backup();
    data.tables.contacts = [
      row('contacts', { id: 'c1' }),
      row('contacts', { id: 'c2', deleted_at: 5 }),
    ];
    data.tables.transactions = [row('transactions', { id: 't1' })];
    expect(summarizeBackup(data)).toEqual({
      createdAt: '2026-10-23T10:00:00.000Z',
      businessName: 'Demir Ticaret',
      contacts: 1,
      transactions: 1,
      attachments: 0,
    });
  });
});

describe('backupReminder', () => {
  const today = '2026-10-23';
  it('30 günden eskiyse hatırlatır', () => {
    expect(backupReminder({ lastBackupDate: '2026-09-23', today, hasData: true })).toBe('none');
    expect(backupReminder({ lastBackupDate: '2026-09-22', today, hasData: true })).toBe('stale');
  });
  it('hiç yedek yoksa yalnızca veri varken hatırlatır', () => {
    expect(backupReminder({ lastBackupDate: null, today, hasData: true })).toBe('never');
    expect(backupReminder({ lastBackupDate: null, today, hasData: false })).toBe('none');
  });
});
