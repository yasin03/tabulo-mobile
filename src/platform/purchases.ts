// Abonelik (6.8): RevenueCat. Uygulamanın geri kalanı yalnızca bu dosyadaki sade tipleri görür.
// Anahtarlar `.env`'den (EXPO_PUBLIC_REVENUECAT_*); fiyatlar mağazadan gelir, kodda yoktur.

import { Linking, Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesError,
  type PurchasesPackage,
} from 'react-native-purchases';

import { PREMIUM_ENTITLEMENT, selectRevenueCatKey, type PremiumCache } from '@/config/plans';

export type PlanPeriod = 'monthly' | 'annual';

export interface PlanOption {
  /** RevenueCat paket kimliği. */
  id: string;
  period: PlanPeriod;
  /** Mağazanın yerelleştirilmiş fiyatı (ör. `₺49,99`). */
  price: string;
  /** Yıllık pakette aylık karşılığı; mağaza vermezse `null`. */
  pricePerMonth: string | null;
  /** Ücretsiz deneme süresi (ISO 8601, ör. `P1W`); yoksa `null`. */
  freeTrialPeriod: string | null;
}

export type PurchaseResult =
  { outcome: 'purchased'; status: PremiumCache } | { outcome: 'cancelled' | 'pending' };

let configured = false;
/** Son `loadPlans` çağrısındaki paketler: satın almada mağaza nesnesi buradan bulunur. */
const packages = new Map<string, PurchasesPackage>();

function apiKey(): string | null {
  return selectRevenueCatKey(
    {
      ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
      android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
      test: process.env.EXPO_PUBLIC_REVENUECAT_TEST_KEY,
    },
    Platform.OS,
    __DEV__,
  );
}

/** Uygulama açılışında bir kez. Anahtar yoksa `false` (satın alma kullanılamaz, uygulama çalışır). */
export function configurePurchases(): boolean {
  if (configured) return true;
  const key = apiKey();
  if (!key) return false;
  if (__DEV__) void Purchases.setLogLevel(LOG_LEVEL.WARN);
  // Hesap yok: RevenueCat anonim kimlik üretir; kişisel veri gönderilmez.
  Purchases.configure({ apiKey: key });
  configured = true;
  return true;
}

export function isPurchasesAvailable(): boolean {
  return configured;
}

function toCache(info: CustomerInfo): PremiumCache {
  const entitlement = info.entitlements.active[PREMIUM_ENTITLEMENT];
  return {
    entitled: !!entitlement?.isActive,
    expiresAt: entitlement?.expirationDateMillis ?? null,
    willRenew: entitlement?.willRenew ?? false,
  };
}

/** Güncel durum. İnternetsizken SDK'nın kendi önbelleğinden döner. */
export async function fetchPremiumStatus(): Promise<PremiumCache> {
  return toCache(await Purchases.getCustomerInfo());
}

/** Abonelik değişince (satın alma, yenileme, iptal, başka cihazdan geri yükleme). */
export function subscribeToPremiumStatus(listener: (status: PremiumCache) => void): () => void {
  if (!configured) return () => {};
  const handler = (info: CustomerInfo) => listener(toCache(info));
  Purchases.addCustomerInfoUpdateListener(handler);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(handler);
  };
}

function toPlan(pkg: PurchasesPackage, period: PlanPeriod): PlanOption {
  const { product } = pkg;
  const trial = product.introPrice?.price === 0 ? product.introPrice.period : null;
  return {
    id: pkg.identifier,
    period,
    price: product.priceString,
    pricePerMonth: period === 'annual' ? product.pricePerMonthString : null,
    freeTrialPeriod: trial,
  };
}

/** Geçerli teklifteki aylık ve yıllık paket (panelde tanımlı olanlar; önce yıllık). */
export async function loadPlans(): Promise<PlanOption[]> {
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  packages.clear();
  if (!current) return [];
  const plans: PlanOption[] = [];
  const add = (pkg: PurchasesPackage | null, period: PlanPeriod) => {
    if (!pkg) return;
    packages.set(pkg.identifier, pkg);
    plans.push(toPlan(pkg, period));
  };
  add(current.annual, 'annual');
  add(current.monthly, 'monthly');
  return plans;
}

function isPurchasesError(error: unknown): error is PurchasesError {
  return typeof error === 'object' && error !== null && 'code' in error;
}

export async function purchasePlan(planId: string): Promise<PurchaseResult> {
  const pkg = packages.get(planId);
  if (!pkg) throw new Error(`Bilinmeyen paket: ${planId}`);
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    const status = toCache(customerInfo);
    return status.entitled ? { outcome: 'purchased', status } : { outcome: 'pending' };
  } catch (error) {
    if (isPurchasesError(error)) {
      if (error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR)
        return { outcome: 'cancelled' };
      // Ebeveyn onayı vb.: ödeme tamamlanınca dinleyici durumu günceller.
      if (error.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) return { outcome: 'pending' };
    }
    throw error;
  }
}

/** Mağazadaki satın alımları bu cihaza geri yükler; güncel durumu döner. */
export async function restorePurchases(): Promise<PremiumCache> {
  return toCache(await Purchases.restorePurchases());
}

/** Mağazanın abonelik yönetimi ekranı (iOS'ta uygulama içi sayfa, Android'de Play Store). */
export async function openManageSubscriptions(): Promise<void> {
  if (Platform.OS === 'ios') {
    try {
      await Purchases.showManageSubscriptions();
      return;
    } catch {
      // Aşağıdaki bağlantıya düşer.
    }
  }
  const info = await Purchases.getCustomerInfo();
  const url =
    info.managementURL ??
    (Platform.OS === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions');
  await Linking.openURL(url);
}
