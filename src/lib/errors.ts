import type { TFunction } from 'i18next';

import { isDomainError } from '@/core/errors';

/** Repository hatasını kullanıcıya gösterilecek metne çevirir; bilinmeyen hatada genel mesaj. */
export function errorMessage(t: TFunction, error: unknown): string {
  if (isDomainError(error)) {
    switch (error.code) {
      case 'notFound':
        return t('errors.domain.notFound');
      case 'nameRequired':
        return t('errors.domain.nameRequired');
      case 'contactHasTransactions':
        return t('errors.domain.contactHasTransactions');
      case 'contactPassive':
        return t('errors.domain.contactPassive');
      case 'accountPassive':
        return t('errors.domain.accountPassive');
      case 'transactionTypePassive':
        return t('errors.domain.transactionTypePassive');
      case 'subjectPassive':
        return t('errors.domain.subjectPassive');
      case 'transactionTypeMismatch':
        return t('errors.domain.transactionTypeMismatch');
      case 'accountHasTransactions':
        return t('errors.domain.accountHasTransactions');
      case 'systemRecordNotDeletable':
        return t('errors.domain.systemRecordNotDeletable');
      case 'exchangeRateRequired':
        return t('errors.domain.exchangeRateRequired');
      case 'conversionOverflow':
        return t('errors.domain.conversionOverflow');
      case 'recurringEnded':
        return t('errors.domain.recurringEnded');
      case 'backupInvalid':
        return t('errors.domain.backupInvalid');
      case 'backupTooNew':
        return t('errors.domain.backupTooNew');
    }
  }
  if (__DEV__) console.warn(error);
  return t('errors.domain.generic');
}
