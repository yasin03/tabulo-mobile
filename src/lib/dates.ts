import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { daysBetween, formatDate, toIsoDate, type DateStyle } from '@/core/dates';
import { formatLocale } from '@/core/money';
import { useMoney } from '@/lib/business';

/** Tarih biçimlendirme: uygulama dili + işletme para birimi (EN'de UK / US biçimi). */
export function useDates() {
  const { t } = useTranslation();
  const { language, currency } = useMoney();
  return useMemo(() => {
    const locale = formatLocale(language, currency);
    const format = (iso: string, style: DateStyle) => formatDate(iso, locale, style);
    return {
      locale,
      format,
      /** Listelerde gün: "Bugün", "Dün", aksi halde `15 Eki` (home.html). */
      day: (iso: string) => {
        const diff = daysBetween(toIsoDate(), iso);
        if (diff === 0) return t('dates.today');
        if (diff === -1) return t('dates.yesterday');
        return format(iso, 'dayMonth');
      },
    };
  }, [language, currency, t]);
}
