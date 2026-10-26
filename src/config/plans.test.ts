import { resolvePremium, selectRevenueCatKey, subscriptionTerm } from './plans';

describe('resolvePremium', () => {
  const now = Date.UTC(2026, 9, 26);

  it('geliştirici anahtarı saklanan durumu ezer', () => {
    expect(resolvePremium({ entitled: false, expiresAt: null, willRenew: true }, 'on', now)).toBe(
      true,
    );
    expect(resolvePremium({ entitled: true, expiresAt: null, willRenew: true }, 'off', now)).toBe(
      false,
    );
  });

  it('otomatikte saklanan entitlement ve bitiş tarihi', () => {
    expect(resolvePremium({ entitled: false, expiresAt: null, willRenew: true }, 'auto', now)).toBe(
      false,
    );
    expect(resolvePremium({ entitled: true, expiresAt: null, willRenew: true }, 'auto', now)).toBe(
      true,
    );
    expect(
      resolvePremium({ entitled: true, expiresAt: now + 1, willRenew: true }, 'auto', now),
    ).toBe(true);
    // İnternetsiz açılışta süresi dolmuş abonelik Premium sayılmaz.
    expect(resolvePremium({ entitled: true, expiresAt: now, willRenew: true }, 'auto', now)).toBe(
      false,
    );
  });
});

describe('selectRevenueCatKey', () => {
  const keys = { ios: 'appl_x', android: 'goog_y', test: 'test_z' };

  it('geliştirmede Test Store anahtarı önce gelir', () => {
    expect(selectRevenueCatKey(keys, 'ios', true)).toBe('test_z');
    expect(selectRevenueCatKey({ ios: 'appl_x' }, 'ios', true)).toBe('appl_x');
  });

  it('sürüm derlemesinde platform anahtarı; Test Store anahtarı asla', () => {
    expect(selectRevenueCatKey(keys, 'ios', false)).toBe('appl_x');
    expect(selectRevenueCatKey(keys, 'android', false)).toBe('goog_y');
    expect(selectRevenueCatKey({ test: 'test_z' }, 'ios', false)).toBeNull();
    expect(selectRevenueCatKey({ ios: 'test_z' }, 'ios', false)).toBeNull();
  });

  it('boş veya desteklenmeyen platform', () => {
    expect(selectRevenueCatKey({ ios: '  ' }, 'ios', false)).toBeNull();
    expect(selectRevenueCatKey(keys, 'web', false)).toBeNull();
  });
});

describe('subscriptionTerm', () => {
  const now = Date.UTC(2026, 9, 26);
  const later = now + 60_000;

  it('yenilenecek abonelikte yenilenme, iptal edilmişte bitiş tarihi', () => {
    expect(subscriptionTerm({ entitled: true, expiresAt: later, willRenew: true }, now)).toEqual({
      kind: 'renews',
      at: later,
    });
    expect(subscriptionTerm({ entitled: true, expiresAt: later, willRenew: false }, now)).toEqual({
      kind: 'ends',
      at: later,
    });
  });

  it('ücretsiz, süresi geçmiş veya ömür boyu aboneliğin tarihi yok', () => {
    expect(
      subscriptionTerm({ entitled: false, expiresAt: later, willRenew: true }, now),
    ).toBeNull();
    expect(subscriptionTerm({ entitled: true, expiresAt: now, willRenew: true }, now)).toBeNull();
    expect(subscriptionTerm({ entitled: true, expiresAt: null, willRenew: false }, now)).toBeNull();
  });
});
