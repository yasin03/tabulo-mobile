import { DomainError } from '@/core/errors';

/** Kayıt yoksa (veya silinmişse) `notFound` fırlatır. */
export function requireRow<T>(row: T | undefined): T {
  if (!row) throw new DomainError('notFound');
  return row;
}

/** Adı kırpar; boşsa `nameRequired` fırlatır. */
export function requireName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new DomainError('nameRequired');
  return trimmed;
}

/** Boş/boşluk metni `null`'a çevirir (isteğe bağlı alanlar veritabanında boş string değil NULL tutulur). */
export function emptyToNull(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** `undefined` alanları atar; böylece kısmi güncellemede verilmeyen alanlara dokunulmaz. */
export function definedOnly<T extends object>(patch: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
}
