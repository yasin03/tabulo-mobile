import { shouldLockOnResume } from './appLock';

describe('shouldLockOnResume', () => {
  const t0 = 1_000_000;

  it('locks right away for "immediate"', () => {
    expect(shouldLockOnResume(t0, t0, 'immediate')).toBe(true);
    expect(shouldLockOnResume(t0, t0 + 500, 'immediate')).toBe(true);
  });

  it('waits for the chosen duration', () => {
    expect(shouldLockOnResume(t0, t0 + 59_999, '1m')).toBe(false);
    expect(shouldLockOnResume(t0, t0 + 60_000, '1m')).toBe(true);
    expect(shouldLockOnResume(t0, t0 + 4 * 60_000, '5m')).toBe(false);
    expect(shouldLockOnResume(t0, t0 + 5 * 60_000, '5m')).toBe(true);
  });

  it('locks when the clock moved backwards', () => {
    expect(shouldLockOnResume(t0, t0 - 1, '5m')).toBe(true);
  });
});
