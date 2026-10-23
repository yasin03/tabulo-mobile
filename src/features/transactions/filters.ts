import { monthRange, toIsoDate, yearRange } from '@/core/dates';
import type { MovementType } from '@/core/ledger';
import { isIsoDate } from '@/core/validation';
import { MOVEMENT_TYPES } from '@/db/schema';
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

/** Ekrana bağlantıyla gelen filtreler (hesap kartı, raporlardaki kırılımlar). */
export type TransactionFilterParams = {
  accountId?: string;
  transactionTypeId?: string;
  subjectId?: string;
  /** Virgülle ayrılmış hareket tipleri: `payment` veya `collection,payment`. */
  types?: string;
  from?: string;
  to?: string;
};

export function filtersFromParams(params: TransactionFilterParams): TransactionFilters {
  const from = params.from && isIsoDate(params.from) ? params.from : '';
  const to = params.to && isIsoDate(params.to) ? params.to : '';
  const movementTypes = (params.types ?? '')
    .split(',')
    .filter((type): type is MovementType => (MOVEMENT_TYPES as readonly string[]).includes(type));
  return {
    ...EMPTY_FILTERS,
    period: from || to ? 'custom' : 'all',
    from,
    to,
    movementTypes,
    accountId: params.accountId ?? '',
    transactionTypeId: params.transactionTypeId ?? '',
    subjectId: params.subjectId ?? '',
  };
}

/** Dönem seçimini tarih aralığına çevirir; `all` ve boş özel sınırlar sınırsızdır. */
export function periodRange(
  filters: Pick<TransactionFilters, 'period' | 'from' | 'to'>,
  today: string,
): { from?: string; to?: string } {
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
