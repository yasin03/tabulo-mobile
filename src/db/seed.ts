// İlk açılışta, migration'dan sonra tek sefer eklenen hazır veriler (PROMPT.md 5.2).
// Adlar seçili dile göre çeviri dosyasından gelir; TR adları şemadaki SEED_* listeleriyle aynıdır (test kontrol eder).

import { and, eq, inArray, ne } from 'drizzle-orm';

import { resources, SUPPORTED_LANGUAGES, type Language } from '@/core/i18n';
import type { Currency } from '@/core/money';

import {
  accounts,
  businessProfile,
  SEED_ACCOUNTS,
  SEED_SUBJECTS,
  SEED_TRANSACTION_TYPES,
  subjects,
  transactionTypes,
} from './schema';
import type { Db, DbOrTx } from './types';

type SeedTranslations = (typeof resources)['tr']['translation']['seed'];

/** Çeviri anahtarları, şemadaki SEED_* listeleriyle aynı sırada. */
export const SEED_ACCOUNT_KEYS = [
  'cash',
  'bank',
] as const satisfies readonly (keyof SeedTranslations['accounts'])[];

export const SEED_TRANSACTION_TYPE_KEYS = [
  'sales',
  'serviceFee',
  'contactCollection',
  'rentIncome',
  'interestIncome',
  'otherIncome',
  'naturalGas',
  'electricity',
  'shipping',
  'rent',
  'officeExpense',
  'personnel',
  'socialSecurity',
  'water',
  'tax',
  'fuel',
  'food',
  'otherExpense',
] as const satisfies readonly (keyof SeedTranslations['transactionTypes'])[];

export const SEED_SUBJECT_KEYS = [
  'general',
  'vehicle',
  'office',
  'other',
] as const satisfies readonly (keyof SeedTranslations['subjects'])[];

export const DEFAULT_PROFILE_ID = 'default';

export interface SeedOptions {
  language: Language;
  currency: Currency;
}

/**
 * Hazır verileri ekler. İşletme profili satırı "hazır veriler eklendi" işaretidir: varsa hiçbir şey yapılmaz.
 * Tek transaction içinde çalışır; yarıda kalırsa hiçbiri eklenmez.
 * @returns Bu çağrıda ekleme yapıldıysa `true`.
 */
export function seedDatabase(db: Db, { language, currency }: SeedOptions): boolean {
  return db.transaction((tx) => {
    const existing = tx
      .select({ id: businessProfile.id })
      .from(businessProfile)
      .where(eq(businessProfile.id, DEFAULT_PROFILE_ID))
      .all()[0];
    if (existing) return false;

    tx.insert(businessProfile).values({ id: DEFAULT_PROFILE_ID, currency }).run();
    insertSeedAccounts(tx, { language, currency });
    insertSeedDefinitions(tx, language);
    return true;
  });
}

/** Varsayılan hesaplar (Kasa + Banka). Verileri silme ekranı hesaplar silinince de çağırır. */
export function insertSeedAccounts(db: DbOrTx, { language, currency }: SeedOptions) {
  const names = resources[language].translation.seed;
  db.insert(accounts)
    .values(
      SEED_ACCOUNTS.map((account, i) => ({
        name: names.accounts[SEED_ACCOUNT_KEYS[i]!],
        type: account.type,
        currency,
        sortOrder: i,
      })),
    )
    .run();
}

/** Varsayılan işlem türleri ve konular. Verileri silme ekranı tanımlar silinince de çağırır. */
export function insertSeedDefinitions(db: DbOrTx, language: Language) {
  const names = resources[language].translation.seed;
  const orderByDirection = { income: 0, expense: 0 };
  db.insert(transactionTypes)
    .values(
      SEED_TRANSACTION_TYPES.map((type, i) => ({
        name: names.transactionTypes[SEED_TRANSACTION_TYPE_KEYS[i]!],
        direction: type.direction,
        isSystem: true,
        sortOrder: orderByDirection[type.direction]++,
      })),
    )
    .run();

  db.insert(subjects)
    .values(
      SEED_SUBJECTS.map((_, i) => ({
        name: names.subjects[SEED_SUBJECT_KEYS[i]!],
        isSystem: true,
        sortOrder: i,
      })),
    )
    .run();
}

/** Bir hazır kaydın tüm dillerdeki varsayılan adları. */
export function namesInAllLanguages<G extends keyof SeedTranslations>(
  group: G,
  key: keyof SeedTranslations[G],
): string[] {
  return SUPPORTED_LANGUAGES.map(
    (language) => resources[language].translation.seed[group][key] as string,
  );
}

/**
 * Hazır kayıtların adlarını verilen dile çevirir (dil değişince ve her açılışta çalışır).
 * Yalnızca adı hâlâ herhangi bir dildeki varsayılan ad olan kayıtlar değişir;
 * kullanıcının yeniden adlandırdığı kayıtlara dokunulmaz.
 * @returns Yeniden adlandırılan kayıt sayısı.
 */
export function localizeSeedRecords(db: Db, language: Language): number {
  const names = resources[language].translation.seed;
  let changed = 0;

  db.transaction((tx) => {
    SEED_ACCOUNTS.forEach((account, i) => {
      const key = SEED_ACCOUNT_KEYS[i]!;
      const target = names.accounts[key];
      changed += tx
        .update(accounts)
        .set({ name: target })
        .where(
          and(
            eq(accounts.type, account.type),
            inArray(accounts.name, namesInAllLanguages('accounts', key)),
            ne(accounts.name, target),
          ),
        )
        .run().changes as number;
    });

    SEED_TRANSACTION_TYPES.forEach((type, i) => {
      const key = SEED_TRANSACTION_TYPE_KEYS[i]!;
      const target = names.transactionTypes[key];
      changed += tx
        .update(transactionTypes)
        .set({ name: target })
        .where(
          and(
            eq(transactionTypes.isSystem, true),
            eq(transactionTypes.direction, type.direction),
            inArray(transactionTypes.name, namesInAllLanguages('transactionTypes', key)),
            ne(transactionTypes.name, target),
          ),
        )
        .run().changes as number;
    });

    SEED_SUBJECT_KEYS.forEach((key) => {
      const target = names.subjects[key];
      changed += tx
        .update(subjects)
        .set({ name: target })
        .where(
          and(
            eq(subjects.isSystem, true),
            inArray(subjects.name, namesInAllLanguages('subjects', key)),
            ne(subjects.name, target),
          ),
        )
        .run().changes as number;
    });
  });

  return changed;
}
