import { monthRange, toIsoDate, yearRange } from '@/core/dates';
import type { MovementType } from '@/core/ledger';
import type { TransactionSearchFilter } from '@/db/repositories';

export const PERIODS = ['all', 'thisMonth', 'lastMonth', 'thisYear', 'custom'] as const;
export type Period = (typeof PERIODS)[number];

/** Tüm hareketler ekranının filtreleri (7.8). Boş metin = filtre yok. */
export interface TransactionFilters {
  period: Period;
  /** Yalnızca `custom` dönemde. */
  from: string;
  to: string;
  movementTypes: MovementType[];
  accountId: string;
  transactionTypeId: string;
  subjectId: string;
  contactId: string;
}

export const EMPTY_FILTERS: TransactionFilters = {
  period: 'all',
  from: '',
  to: '',
  movementTypes: [],
  accountId: '',
  transactionTypeId: '',
  subjectId: '',
  contactId: '',
};

function periodRange(filters: TransactionFilters, today: string): { from?: string; to?: string } {
  switch (filters.period) {
    case 'thisMonth':
      return monthRange(today);
    case 'lastMonth':
      return monthRange(today, -1);
    case 'thisYear':
      return yearRange(today);
    case 'custom':
      return { from: filters.from || undefined, to: filters.to || undefined };
    default:
      return {};
  }
}

/** Ekran filtrelerini repository sorgusuna çevirir. */
export function toSearchFilter(
  filters: TransactionFilters,
  search: string,
  today = toIsoDate(),
): TransactionSearchFilter {
  return {
    ...periodRange(filters, today),
    movementTypes: filters.movementTypes.length > 0 ? filters.movementTypes : undefined,
    accountId: filters.accountId || undefined,
    transactionTypeId: filters.transactionTypeId || undefined,
    subjectId: filters.subjectId || undefined,
    contactId: filters.contactId || undefined,
    search: search.trim() || undefined,
  };
}

/** Filtre düğmesindeki rozet için etkin filtre sayısı. */
export function activeFilterCount(filters: TransactionFilters): number {
  return [
    filters.period !== 'all',
    filters.movementTypes.length > 0,
    !!filters.accountId,
    !!filters.transactionTypeId,
    !!filters.subjectId,
    !!filters.contactId,
  ].filter(Boolean).length;
}
