import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { formatMoney, formatSignedMoney, type Currency } from '@/core/money';
import { defaultPhoneCountry } from '@/core/validation';
import { businessProfileRepo, type BusinessProfile } from '@/db';
import { useLiveQuery } from '@/db/useLiveQuery';
import { useLanguage } from '@/lib/i18n';

const BusinessContext = createContext<BusinessProfile | null>(null);

const getProfile = () => businessProfileRepo.get();

/** İşletme profilini (para birimi vb.) tüm ekranlara sağlar; profil değişince güncellenir. */
export function BusinessProvider({ children }: { children: ReactNode }) {
  const { data } = useLiveQuery(getProfile);
  if (!data) return null;
  return <BusinessContext.Provider value={data}>{children}</BusinessContext.Provider>;
}

export function useBusinessProfile(): BusinessProfile {
  const profile = useContext(BusinessContext);
  if (!profile) throw new Error('useBusinessProfile, BusinessProvider içinde kullanılmalı');
  return profile;
}

/** Tutar biçimlendirme: işletmenin para birimi + uygulama dili (6.1). */
export function useMoney() {
  const language = useLanguage();
  const currency = useBusinessProfile().currency as Currency;
  return useMemo(
    () => ({
      language,
      currency,
      phoneCountry: defaultPhoneCountry(currency),
      format: (minor: number) => formatMoney(minor, { currency, language }),
      formatSigned: (minor: number) => formatSignedMoney(minor, { currency, language }),
    }),
    [language, currency],
  );
}
