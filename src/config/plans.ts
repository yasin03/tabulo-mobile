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

/** RevenueCat panelindeki entitlement kimliği (6.8). */
export const PREMIUM_ENTITLEMENT = 'premium';

/** Cihazda saklanan son abonelik durumu: açılışta ve internetsizken bununla karar verilir. */
export interface PremiumCache {
  entitled: boolean;
  /** Ms; `null` süresiz (ömür boyu) veya bilinmiyor. */
  expiresAt: number | null;
  /** Dönem sonunda kendiliğinden yenilenecek mi (kullanıcı mağazadan iptal ettiyse `false`). */
  willRenew: boolean;
}

/** Geliştirici anahtarı (yalnızca `__DEV__`): `auto` gerçek abonelik durumunu kullanır. */
export type PremiumOverride = 'auto' | 'on' | 'off';

/**
 * Premium açık mı? Geliştirici anahtarı önce gelir; sonra saklanan durum. İnternetsiz açılışta
 * süresi dolmuş bir abonelik, yenilendiği doğrulanana kadar Premium sayılmaz.
 */
export function resolvePremium(
  cache: PremiumCache,
  override: PremiumOverride,
  nowMs: number,
): boolean {
  if (override !== 'auto') return override === 'on';
  if (!cache.entitled) return false;
  return cache.expiresAt === null || cache.expiresAt > nowMs;
}

/** Ayarlar ve paywall'da gösterilecek abonelik tarihi: yenilenme mi, bitiş mi? */
export type SubscriptionTerm = { kind: 'renews' | 'ends'; at: number };

/** Etkin ve süreli bir abonelik yoksa (ücretsiz, süresi geçmiş, ömür boyu) `null`. */
export function subscriptionTerm(cache: PremiumCache, nowMs: number): SubscriptionTerm | null {
  if (!cache.entitled || cache.expiresAt === null || cache.expiresAt <= nowMs) return null;
  return { kind: cache.willRenew ? 'renews' : 'ends', at: cache.expiresAt };
}

export interface RevenueCatKeys {
  ios?: string;
  android?: string;
  /** Test Store anahtarı (`test_…`): yalnızca geliştirme derlemesinde kullanılır. */
  test?: string;
}

/**
 * Hangi RevenueCat anahtarı? Geliştirmede Test Store anahtarı varsa o; aksi halde platformun anahtarı.
 * Sürüm derlemesinde Test Store anahtarı asla seçilmez (SDK bilerek çöker).
 */
export function selectRevenueCatKey(
  keys: RevenueCatKeys,
  platform: string,
  isDev: boolean,
): string | null {
  const clean = (key: string | undefined) => key?.trim() || null;
  const test = clean(keys.test);
  if (isDev && test) return test;
  const key = clean(
    platform === 'ios' ? keys.ios : platform === 'android' ? keys.android : undefined,
  );
  if (!key || key.startsWith('test_')) return null;
  return key;
}
