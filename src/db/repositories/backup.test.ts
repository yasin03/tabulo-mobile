/** @jest-environment node */
import { createBackupData, parseBackup, type BackupTables } from '@/core/backup';

import { createSeededTestDb } from '../testing';

const DATE = '2026-10-19';

/** Her tabloda en az bir satırı olan veritabanı (silinmiş kayıt ve belge dahil). */
async function populated() {
  const ctx = createSeededTestDb();
  const [cash] = await ctx.accountsRepo.list();
  const contactId = await ctx.contactsRepo.create({
    personType: 'individual',
    role: 'customer',
    name: 'Ayşe Demir',
    phone: '+905320000000',
  });
  const saleId = await ctx.transactionsRepo.create(
    { movementType: 'credit_sale', amountMinor: 150_000, date: DATE, contactId, dueDate: DATE },
    [{ id: 'att-1', fileUri: 'attachments/att-1.jpg', mimeType: 'image/jpeg', sizeBytes: 1200 }],
  );
  const deletedId = await ctx.transactionsRepo.create({
    movementType: 'collection',
    amountMinor: 5_000,
    date: DATE,
    accountId: cash!.id,
    contactId,
  });
  await ctx.transactionsRepo.softDelete(deletedId);
  const recurringId = await ctx.recurringPaymentsRepo.create({
    title: 'Kira',
    movementType: 'payment',
    amountMinor: 1_000_000,
    accountId: cash!.id,
    frequency: 'monthly',
    interval: 1,
    startDate: DATE,
    remindDaysBefore: 1,
    remindTime: '09:00',
  });
  await ctx.recurringPaymentsRepo.markPaid(recurringId, {
    amountMinor: 1_000_000,
    date: DATE,
    accountId: cash!.id,
  });
  await ctx.remindersRepo.create({
    contactId,
    transactionId: saleId,
    remindDate: '2026-12-01',
    remindTime: '10:00',
    note: 'Ara',
  });
  await ctx.businessProfileRepo.update({ name: 'Demir Ticaret', logoUri: 'logo/logo-1.jpg' });
  return ctx;
}

/** Yedek dosyasına yazılıp geri okunmuş tablolar. */
function throughFile(tables: BackupTables): BackupTables {
  const data = createBackupData({
    tables,
    files: [],
    createdAt: new Date('2026-10-23T10:00:00Z'),
    appVersion: '1.0.0',
    settings: { defaultRemindTime: null },
  });
  return parseBackup(JSON.stringify(data)).tables;
}

describe('backupRepo', () => {
  it('tüm tabloları ham satırlarıyla dışa aktarır (silinmişler dahil)', async () => {
    const ctx = await populated();
    const tables = await ctx.backupRepo.exportTables();

    for (const name of ['contacts', 'transactions', 'attachments', 'recurring_payments']) {
      expect(tables[name]!.length).toBeGreaterThan(0);
    }
    expect(tables.reminders).toHaveLength(1);
    expect(tables.transactions!.some((row) => row.deleted_at !== null)).toBe(true);
    const profile = tables.business_profile![0]!;
    expect(profile).toEqual(expect.objectContaining({ id: 'default', name: 'Demir Ticaret' }));
    // Zaman damgası ms tam sayı, boolean 0/1 (ham SQLite değeri).
    expect(typeof profile.created_at).toBe('number');
    expect(tables.transaction_types!.every((row) => row.is_system === 1)).toBe(true);
  });

  it('geri yükleme mevcut verileri silip yedeği birebir kurar', async () => {
    const source = await populated();
    const tables = await source.backupRepo.exportTables();

    const target = createSeededTestDb();
    await target.contactsRepo.create({
      personType: 'company',
      role: 'supplier',
      name: 'Eski Cari',
    });
    await target.backupRepo.restore(throughFile(tables), 'tr');

    expect(await target.backupRepo.exportTables()).toEqual(tables);
    const contacts = await target.contactsRepo.list();
    expect(contacts.map((c) => c.name)).toEqual(['Ayşe Demir']);
    expect(contacts[0]!.balanceMinor).toBe(150_000);
  });

  it('hata olursa hiçbir şey değişmez', async () => {
    const source = await populated();
    const tables = await source.backupRepo.exportTables();
    const broken = structuredClone(tables);
    broken.transactions!.push({ ...broken.transactions![0]!, id: 'tx-x', contact_id: 'yok' });

    const target = createSeededTestDb();
    await target.contactsRepo.create({
      personType: 'company',
      role: 'supplier',
      name: 'Eski Cari',
    });
    const before = await target.backupRepo.exportTables();

    await expect(target.backupRepo.restore(broken, 'tr')).rejects.toThrow();
    expect(await target.backupRepo.exportTables()).toEqual(before);
  });

  it('hazır kayıt adları geri yüklenince uygulama diline uyar', async () => {
    const source = await populated();
    const target = createSeededTestDb({ language: 'en', currency: 'USD' });
    await target.backupRepo.restore(await source.backupRepo.exportTables(), 'en');

    const names = (await target.accountsRepo.list()).map((a) => a.name);
    expect(names).toEqual(['Cash', 'Bank']);
    // Para birimi yedekten gelir.
    expect(await target.businessProfileRepo.currency()).toBe('TRY');
  });

  it('hasData: cari veya hareket varsa true', async () => {
    expect(await createSeededTestDb().backupRepo.hasData()).toBe(false);
    expect(await (await populated()).backupRepo.hasData()).toBe(true);
  });
});
