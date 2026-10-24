// Repository katmanının fırlattığı iş kuralı hataları. Arayüz `code`'u çeviri anahtarına eşler.

import type { MovementIssue } from './ledger';

export type DomainErrorCode =
  | MovementIssue
  | 'notFound' // Kayıt yok veya silinmiş
  | 'nameRequired' // Ad boş
  | 'systemRecordNotDeletable' // Hazır kayıt silinemez, yalnızca pasife alınır (5.2)
  | 'contactHasTransactions' // Hareketi olan cari silinemez, yalnızca pasife alınır (7.4)
  | 'accountHasTransactions' // Hareketi olan hesap silinemez
  | 'contactPassive' // Pasif cari yeni harekette seçilemez (6.2)
  | 'accountPassive' // Pasif hesap yeni harekette seçilemez
  | 'transactionTypeMismatch' // İşlem türünün yönü hareket tipine uymuyor (5.1)
  | 'transactionTypePassive'
  | 'subjectPassive'
  | 'exchangeRateRequired' // Tutar varken para birimi kur olmadan değiştirilemez
  | 'conversionOverflow' // Dönüştürülen tutar girilebilir en büyük tutarı aşıyor
  | 'recurringEnded' // Bitiş tarihi geçmiş / pasif düzenli ödeme ödenemez veya aktife alınamaz
  | 'backupInvalid' // Seçilen dosya Tabulo yedeği değil veya bozuk
  | 'backupTooNew'; // Yedek uygulamanın daha yeni bir sürümüyle alınmış

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'DomainError';
    this.code = code;
  }
}

export function isDomainError(error: unknown, code?: DomainErrorCode): error is DomainError {
  return error instanceof DomainError && (code === undefined || error.code === code);
}
