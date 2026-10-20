import en from './en.json';
import tr from './tr.json';

export const SUPPORTED_LANGUAGES = ['tr', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'tr';

export const resources = {
  tr: { translation: tr },
  en: { translation: en },
} as const;

export function isSupportedLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/** Cihaz dil kodlarından (ör. ['en-GB', 'tr-TR']) desteklenen ilk dili seçer. */
export function pickLanguage(
  deviceLanguageCodes: readonly (string | null | undefined)[],
): Language {
  for (const code of deviceLanguageCodes) {
    const base = code?.toLowerCase().split('-')[0];
    if (isSupportedLanguage(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}
