import { getLocales } from 'expo-localization';
import i18n, { changeLanguage } from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';

import {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  pickLanguage,
  resources,
  type Language,
} from '@/core/i18n';
import { pickCurrency, type Currency } from '@/core/money';
import { usePreferences } from '@/stores/preferences';

export function deviceLanguage(): Language {
  return pickLanguage(getLocales().map((l) => l.languageCode));
}

/** Cihaz bölgesinin para birimi (TRY/GBP/USD değilse TRY). Onboarding'de kullanıcı değiştirebilir. */
export function deviceCurrency(): Currency {
  return pickCurrency(getLocales().map((l) => l.currencyCode));
}

export function resolveLanguage(): Language {
  return usePreferences.getState().language ?? deviceLanguage();
}

// MMKV senkron olduğu için kayıtlı dil ilk render'dan önce hazırdır.
// eslint-disable-next-line import/no-named-as-default-member
void i18n.use(initReactI18next).init({
  resources,
  lng: resolveLanguage(),
  fallbackLng: 'tr',
  interpolation: { escapeValue: false },
  returnNull: false,
});

usePreferences.subscribe((state, prev) => {
  if (state.language !== prev.language) {
    void changeLanguage(state.language ?? deviceLanguage());
  }
});

export default i18n;

/** Uygulamanın o anki dili (değişince bileşen yeniden çizilir). */
export function useLanguage(): Language {
  const { i18n: instance } = useTranslation();
  return isSupportedLanguage(instance.language) ? instance.language : DEFAULT_LANGUAGE;
}
