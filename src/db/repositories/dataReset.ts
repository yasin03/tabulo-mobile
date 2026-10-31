// Verileri silme (Ayarlar → Veriler): seçilen gruplar kalıcı olarak (yumuşak silme değil) tek transaction'da
// silinir. Grup seçimi ve bağımlılıklar src/core/dataReset.ts'te; dosyalar ve cihaz ayarları
// src/features/dataReset'te.

import { resolveDataSelection, type DataCategory } from '@/core/dataReset';
import type { Language } from '@/core/i18n';
import type { Currency } from '@/core/money';

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
} from '../schema';
import { insertSeedAccounts, insertSeedDefinitions } from '../seed';
import type { Db } from '../types';

export function createDataResetRepo(db: Db) {
  return {
    /**
     * Seçilen grupları siler; bağımlılık gereği hareketler de eklenebilir (`resolveDataSelection`).
     * Hesaplar / tanımlar silinirse varsayılanları yeniden eklenir. Hata olursa hiçbir şey değişmez.
     * - Hareketler: hareketler, belge kayıtları, düzenli ödemeler (hatırlatıcıların hareket bağı kalkar)
     * - Cariler: cariler ve tahsilat hatırlatıcıları
     * - İşlem tanımları: işlem türleri ve konular
     * - Hesaplar: kasa ve banka hesapları
     * - Ayarlar: işletme profili (para birimi hariç; tutarlar ona göre saklı)
     * @returns Gerçekte silinen gruplar.
     */
    async wipe(
      selected: readonly DataCategory[],
      options: { language: Language; currency: Currency },
    ): Promise<DataCategory[]> {
      const { categories } = resolveDataSelection(selected);
      const has = (category: DataCategory) => categories.includes(category);

      db.transaction((tx) => {
        if (has('transactions')) {
          tx.delete(attachments).run();
          tx.update(reminders).set({ transactionId: null }).run();
          tx.delete(transactions).run();
          tx.delete(recurringPayments).run();
        }
        if (has('contacts')) {
          tx.delete(reminders).run();
          tx.delete(contacts).run();
        }
        if (has('definitions')) {
          tx.delete(transactionTypes).run();
          tx.delete(subjects).run();
          insertSeedDefinitions(tx, options.language);
        }
        if (has('accounts')) {
          tx.delete(accounts).run();
          insertSeedAccounts(tx, options);
        }
        if (has('settings')) {
          tx.update(businessProfile)
            .set({
              name: '',
              phone: null,
              email: null,
              city: null,
              district: null,
              address: null,
              taxNumber: null,
              taxOffice: null,
              logoUri: null,
            })
            .run();
        }
      });
      return categories;
    },
  };
}

export type DataResetRepo = ReturnType<typeof createDataResetRepo>;
