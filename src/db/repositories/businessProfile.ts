import { eq, ne, sql } from 'drizzle-orm';

import { DomainError } from '@/core/errors';
import { convertMinor, exceedsMaxAmount, type ExchangeRate } from '@/core/exchange';
import type { Currency } from '@/core/money';

import { accounts, businessProfile, recurringPayments, transactions } from '../schema';
import { DEFAULT_PROFILE_ID } from '../seed';
import type { BusinessProfile, Db } from '../types';
import { definedOnly, emptyToNull, requireRow } from './shared';

export interface BusinessProfileInput {
  name?: string;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  taxNumber?: string | null;
  taxOffice?: string | null;
  logoUri?: string | null;
}

/** İşletme profili: tek satır, hazır verilerle birlikte oluşturulur. Para birimi yalnızca `changeCurrency` ile değişir. */
export function createBusinessProfileRepo(db: Db) {
  function getSync(): BusinessProfile {
    return requireRow(
      db.select().from(businessProfile).where(eq(businessProfile.id, DEFAULT_PROFILE_ID)).all()[0],
    );
  }

  return {
    async get(): Promise<BusinessProfile> {
      return getSync();
    },

    async currency(): Promise<Currency> {
      return getSync().currency as Currency;
    },

    /**
     * Para birimini değiştirmek için kur gerekir mi? (Tutarı olan herhangi bir kayıt varsa.)
     * Silinmiş hareketler de sayılır: geri alınırsa doğru para biriminde olmalı.
     */
    async needsConversion(): Promise<boolean> {
      const count = (rows: { n: number }[]) => rows[0]?.n ?? 0;
      const n = sql<number>`COUNT(*)`.mapWith(Number);
      return (
        count(db.select({ n }).from(transactions).all()) > 0 ||
        count(db.select({ n }).from(accounts).where(ne(accounts.openingBalanceMinor, 0)).all()) >
          0 ||
        count(db.select({ n }).from(recurringPayments).all()) > 0
      );
    },

    /**
     * İşletme para birimini değiştirir (kullanıcı kararı, Faz 4): tüm tutarlar — silinmişler dahil hareketler,
     * hesap açılış bakiyeleri, düzenli ödemeler — değişim gününün TEK kuruyla çevrilir; tek transaction'dır.
     * Tutarlı kayıt yoksa kur gerekmez (`rate` null olabilir).
     */
    async changeCurrency(to: Currency, rate: ExchangeRate | null): Promise<void> {
      db.transaction((tx) => {
        const from = requireRow(
          tx
            .select({ currency: businessProfile.currency })
            .from(businessProfile)
            .where(eq(businessProfile.id, DEFAULT_PROFILE_ID))
            .all()[0],
        ).currency as Currency;
        if (from === to) return;

        const convert = (minor: number) => {
          if (!rate) throw new DomainError('exchangeRateRequired');
          const result = convertMinor(minor, from, rate);
          if (exceedsMaxAmount(result)) throw new DomainError('conversionOverflow');
          return result;
        };

        for (const row of tx
          .select({ id: transactions.id, amount: transactions.amountMinor })
          .from(transactions)
          .all()) {
          // Hareket tutarı > 0 olmalı; çok küçük tutar sıfıra yuvarlanırsa en az 1 kuruş kalır.
          const amount = Math.max(1, convert(row.amount));
          tx.update(transactions)
            .set({ amountMinor: amount, currency: to })
            .where(eq(transactions.id, row.id))
            .run();
        }

        for (const row of tx
          .select({ id: accounts.id, amount: accounts.openingBalanceMinor })
          .from(accounts)
          .all()) {
          tx.update(accounts)
            .set({ openingBalanceMinor: row.amount === 0 ? 0 : convert(row.amount), currency: to })
            .where(eq(accounts.id, row.id))
            .run();
        }

        for (const row of tx
          .select({ id: recurringPayments.id, amount: recurringPayments.amountMinor })
          .from(recurringPayments)
          .all()) {
          tx.update(recurringPayments)
            .set({ amountMinor: Math.max(1, convert(row.amount)), currency: to })
            .where(eq(recurringPayments.id, row.id))
            .run();
        }

        tx.update(businessProfile)
          .set({ currency: to })
          .where(eq(businessProfile.id, DEFAULT_PROFILE_ID))
          .run();
      });
    },

    async update(input: BusinessProfileInput): Promise<void> {
      db.update(businessProfile)
        .set(
          definedOnly({
            ...input,
            name: input.name?.trim(),
            phone: emptyToNull(input.phone),
            email: emptyToNull(input.email),
            city: emptyToNull(input.city),
            district: emptyToNull(input.district),
            address: emptyToNull(input.address),
            taxNumber: emptyToNull(input.taxNumber),
            taxOffice: emptyToNull(input.taxOffice),
            logoUri: emptyToNull(input.logoUri),
          }),
        )
        .where(eq(businessProfile.id, DEFAULT_PROFILE_ID))
        .run();
    },
  };
}

export type BusinessProfileRepo = ReturnType<typeof createBusinessProfileRepo>;
