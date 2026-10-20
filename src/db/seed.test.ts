/** @jest-environment node */
import { resources } from '@/core/i18n';

import {
  accounts,
  businessProfile,
  SEED_SUBJECTS,
  SEED_TRANSACTION_TYPES,
  subjects,
  transactionTypes,
  SEED_ACCOUNTS,
} from './schema';
import {
  SEED_ACCOUNT_KEYS,
  SEED_SUBJECT_KEYS,
  SEED_TRANSACTION_TYPE_KEYS,
  localizeSeedRecords,
  seedDatabase,
} from './seed';
import { createRepositories } from './repositories';
import { createTestDb } from './testing';

describe('çeviri anahtarları şemadaki SEED_* listeleriyle eşleşir', () => {
  const tr = resources.tr.translation.seed;

  it('Türkçe adlar şemadakiyle aynı ve aynı sırada', () => {
    expect(SEED_ACCOUNT_KEYS.map((k) => tr.accounts[k])).toEqual(SEED_ACCOUNTS.map((a) => a.name));
    expect(SEED_TRANSACTION_TYPE_KEYS.map((k) => tr.transactionTypes[k])).toEqual(
      SEED_TRANSACTION_TYPES.map((t) => t.name),
    );
    expect(SEED_SUBJECT_KEYS.map((k) => tr.subjects[k])).toEqual(SEED_SUBJECTS);
  });
});

describe('seedDatabase', () => {
  it('hazır verileri ekler', () => {
    const db = createTestDb();
    expect(seedDatabase(db, { language: 'tr', currency: 'TRY' })).toBe(true);

    expect(db.select().from(businessProfile).all()).toHaveLength(1);

    const accountRows = db.select().from(accounts).all();
    expect(accountRows).toEqual([
      expect.objectContaining({ name: 'Kasa', type: 'cash', currency: 'TRY', status: 'active' }),
      expect.objectContaining({ name: 'Banka', type: 'bank', currency: 'TRY', status: 'active' }),
    ]);

    const types = db.select().from(transactionTypes).all();
    expect(types).toHaveLength(18);
    expect(types.every((t) => t.isSystem)).toBe(true);
    expect(types.filter((t) => t.direction === 'income').map((t) => t.name)).toEqual([
      'Satış',
      'Hizmet Bedeli',
      'Cari Tahsilatı',
      'Kira Geliri',
      'Faiz Geliri',
      'Diğer Gelir',
    ]);
    expect(types.filter((t) => t.direction === 'expense').map((t) => t.sortOrder)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);

    const subjectRows = db.select().from(subjects).all();
    expect(subjectRows.map((s) => s.name)).toEqual(['Genel', 'Araç', 'Ofis', 'Diğer']);
    expect(subjectRows.every((s) => s.isSystem)).toBe(true);
  });

  it('yalnızca bir kez ekler', () => {
    const db = createTestDb();
    expect(seedDatabase(db, { language: 'tr', currency: 'TRY' })).toBe(true);
    expect(seedDatabase(db, { language: 'tr', currency: 'TRY' })).toBe(false);
    expect(seedDatabase(db, { language: 'en', currency: 'GBP' })).toBe(false);

    expect(db.select().from(accounts).all()).toHaveLength(2);
    expect(db.select().from(transactionTypes).all()).toHaveLength(18);
    expect(db.select().from(subjects).all()).toHaveLength(4);
  });

  it('İngilizce adlar ve para birimi', () => {
    const db = createTestDb();
    seedDatabase(db, { language: 'en', currency: 'GBP' });

    expect(db.select().from(businessProfile).get()?.currency).toBe('GBP');
    expect(db.select().from(accounts).all()).toEqual([
      expect.objectContaining({ name: 'Cash', currency: 'GBP' }),
      expect.objectContaining({ name: 'Bank', currency: 'GBP' }),
    ]);
    expect(
      db
        .select()
        .from(subjects)
        .all()
        .map((s) => s.name),
    ).toEqual(['General', 'Vehicle', 'Office', 'Other']);
  });

  it('kayıtlar UUIDv7 kimlik ve zaman damgası alır', () => {
    const db = createTestDb();
    seedDatabase(db, { language: 'tr', currency: 'TRY' });
    const account = db.select().from(accounts).get()!;
    expect(account.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(account.createdAt).toBeInstanceOf(Date);
    expect(account.updatedAt).toBeInstanceOf(Date);
    expect(account.deletedAt).toBeNull();
  });
});

describe('localizeSeedRecords', () => {
  it('varsayılan adları dile çevirir, kullanıcının adlandırdıklarına dokunmaz', async () => {
    const db = createTestDb();
    seedDatabase(db, { language: 'tr', currency: 'TRY' });
    const repos = createRepositories(db);

    const [cash] = await repos.accountsRepo.list();
    const sales = (await repos.transactionTypesRepo.list({ direction: 'income' }))[0]!;
    await repos.accountsRepo.update(cash!.id, { name: 'Dükkan Kasası' });
    const userType = await repos.transactionTypesRepo.create({
      name: 'Satış',
      direction: 'expense',
    });

    const changed = localizeSeedRecords(db, 'en');
    expect(changed).toBe(1 + 18 + 4); // Banka (Kasa yeniden adlandırıldı) + 18 hazır tür + 4 konu

    expect((await repos.accountsRepo.list()).map((a) => a.name)).toEqual(['Dükkan Kasası', 'Bank']);
    expect((await repos.transactionTypesRepo.getById(sales.id)).name).toBe('Sales');
    // Kullanıcının eklediği kayıt (isSystem değil) adı varsayılanla aynı olsa da değişmez.
    expect((await repos.transactionTypesRepo.getById(userType)).name).toBe('Satış');
    expect((await repos.subjectsRepo.list()).map((s) => s.name)).toEqual([
      'General',
      'Vehicle',
      'Office',
      'Other',
    ]);
    const expenses = (await repos.transactionTypesRepo.list({ direction: 'expense' })).map(
      (t) => t.name,
    );
    expect(expenses).toContain('Payroll Taxes');
    expect(expenses).toContain('Natural Gas');

    // Geri Türkçeye; tekrar çalıştırmak bir şey değiştirmez.
    localizeSeedRecords(db, 'tr');
    expect(localizeSeedRecords(db, 'tr')).toBe(0);
    expect((await repos.accountsRepo.list()).map((a) => a.name)).toEqual([
      'Dükkan Kasası',
      'Banka',
    ]);
    expect((await repos.subjectsRepo.list()).map((s) => s.name)).toEqual([
      'Genel',
      'Araç',
      'Ofis',
      'Diğer',
    ]);
  });
});
