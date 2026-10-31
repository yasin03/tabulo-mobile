// Verileri silme akışı (Ayarlar → Veriler): repository (tablolar) + platform (dosyalar) + cihaz ayarları.

import type { DataCategory } from '@/core/dataReset';
import type { Language } from '@/core/i18n';
import type { Currency } from '@/core/money';
import { dataResetRepo } from '@/db';
import { deleteAllAttachmentFiles, deleteLogoFiles } from '@/platform/attachments';
import { usePreferences } from '@/stores/preferences';
import { clearTransactionDraft } from '@/stores/transactionDraft';

/**
 * Seçilen grupları siler. Veritabanı tek transaction'dır; ancak başarılı olursa dosyalar silinir ve cihaz
 * ayarları sıfırlanır. Bildirimler `NotificationSync` ile kendiliğinden eşitlenir.
 */
export async function deleteData(
  selected: readonly DataCategory[],
  options: { language: Language; currency: Currency },
): Promise<void> {
  const deleted = await dataResetRepo.wipe(selected, options);

  if (deleted.includes('transactions')) {
    deleteAllAttachmentFiles();
    // Taslak silinen carilere / hesaplara / tanımlara bağlı olabilir.
    clearTransactionDraft();
  }
  if (deleted.includes('settings')) {
    deleteLogoFiles();
    usePreferences.getState().resetSettings();
  } else if (deleted.includes('accounts')) {
    usePreferences.setState({ lastAccountId: null });
  }
}
