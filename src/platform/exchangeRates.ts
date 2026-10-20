// Güncel döviz kuru: Frankfurter (Avrupa Merkez Bankası referans kurları; anahtar gerekmez,
// yalnızca para birimi kodları gönderilir — kişisel veri yok). İnternet yoksa kullanıcı kuru elle girer.

import { normalizeRate, type ExchangeRate } from '@/core/exchange';
import type { Currency } from '@/core/money';

const ENDPOINT = 'https://api.frankfurter.dev/v1/latest';
const TIMEOUT_MS = 8000;

export interface FetchedRate {
  rate: ExchangeRate;
  /** Kurun yayın tarihi (`YYYY-AA-GG`; hafta sonunda son iş günü). */
  date: string;
}

async function fetchValue(from: Currency, to: Currency): Promise<{ value: number; date: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${ENDPOINT}?base=${from}&symbols=${to}`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Kur alınamadı: ${response.status}`);
    const body = (await response.json()) as { date?: string; rates?: Record<string, number> };
    const value = body.rates?.[to];
    if (typeof value !== 'number' || !(value > 0)) throw new Error('Kur yanıtı geçersiz');
    return { value, date: body.date ?? '' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * `from` → `to` güncel kuru. Hassasiyet için 1'den büyük yönde ayrıca istenir
 * (`1 TRY = 0,0202 USD` yerine `1 USD = 49,553 TRY`).
 */
export async function fetchExchangeRate(from: Currency, to: Currency): Promise<FetchedRate> {
  const direct = await fetchValue(from, to);
  if (direct.value >= 1) return { rate: normalizeRate(from, to, direct.value), date: direct.date };
  const inverse = await fetchValue(to, from);
  return { rate: normalizeRate(to, from, inverse.value), date: inverse.date };
}
