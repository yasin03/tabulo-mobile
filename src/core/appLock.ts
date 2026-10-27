// Uygulama kilidi zamanlaması (8.5): ne zaman yeniden kimlik doğrulaması istenir.

export const LOCK_TIMEOUTS = ['immediate', '1m', '5m'] as const;
export type LockTimeout = (typeof LOCK_TIMEOUTS)[number];

const TIMEOUT_MS: Record<LockTimeout, number> = {
  immediate: 0,
  '1m': 60_000,
  '5m': 5 * 60_000,
};

/**
 * Arka plandan dönüşte kilit gerekir mi? `backgroundAt` uygulamanın arka plana geçtiği an (ms).
 * Saat geri alınmışsa (now < backgroundAt) güvenli tarafta kalınır: kilitlenir.
 */
export function shouldLockOnResume(
  backgroundAt: number,
  now: number,
  timeout: LockTimeout,
): boolean {
  const elapsed = now - backgroundAt;
  if (elapsed < 0) return true;
  return elapsed >= TIMEOUT_MS[timeout];
}
