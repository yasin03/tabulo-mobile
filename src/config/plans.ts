// Ücretsiz / Premium sınırları (PROMPT.md 6.8). Fiyatlar RevenueCat panelinden yönetilir, burada yoktur.

export const FREE_LIMITS = {
  /** Aynı anda en fazla aktif cari. Pasif cariler sayılmaz. */
  activeContacts: 10,
  cashAccounts: 1,
  bankAccounts: 1,
} as const;

export const PREMIUM_FEATURES = [
  'unlimitedContacts',
  'unlimitedAccounts',
  'charts',
  'export',
  'whatsappStatement',
  'backup',
  'attachments',
] as const;
export type PremiumFeature = (typeof PREMIUM_FEATURES)[number];

/** Yeni bir aktif cari eklenebilir mi (veya pasif cari aktife alınabilir mi)? */
export function canAddActiveContact(activeCount: number, isPremium: boolean): boolean {
  return isPremium || activeCount < FREE_LIMITS.activeContacts;
}

/** Ücretsiz planda: 1 aktif kasa + 1 aktif banka hesabı (6.8). */
export function canAddActiveAccount(
  type: 'cash' | 'bank',
  activeCounts: Record<'cash' | 'bank', number>,
  isPremium: boolean,
): boolean {
  if (isPremium) return true;
  const limit = type === 'cash' ? FREE_LIMITS.cashAccounts : FREE_LIMITS.bankAccounts;
  return activeCounts[type] < limit;
}
