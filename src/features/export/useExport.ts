import { useToast } from 'heroui-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform } from 'react-native';

import { useMoney } from '@/lib/business';
import { useDates } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { useToday } from '@/lib/useToday';
import { shareFile, type ExportKind } from '@/platform/exportFiles';

import type { FormatContext } from './documents';

/** Belgeler uygulama dili + işletme para birimiyle biçimlenir. */
export function useFormatContext(): FormatContext {
  const { t } = useTranslation();
  const { language, currency } = useMoney();
  const { locale } = useDates();
  const today = useToday();
  return useMemo(
    () => ({
      t,
      language,
      currency,
      locale,
      today,
      // expo-print Android'de JavaScript çalıştırmaz; orada Chromium'un baskı kuralları yeterli.
      pdfPagination: Platform.OS === 'ios' ? ('script' as const) : ('css' as const),
    }),
    [t, language, currency, locale, today],
  );
}

/**
 * Dosyayı üretip paylaş ekranını açar. Üretim sürerken `isBusy` (düğmede yükleniyor, 8.3);
 * çift dokunuş ikinci bir dosya üretmez.
 */
export function useShareExport() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isBusy, setBusy] = useState(false);
  const busy = useRef(false);

  const run = useCallback(
    async (kind: ExportKind, dialogTitle: string, create: () => Promise<string>) => {
      if (busy.current) return;
      busy.current = true;
      setBusy(true);
      try {
        const uri = await create();
        haptics.success();
        const shared = await shareFile(uri, kind, dialogTitle);
        if (!shared) Alert.alert(t('export.shareUnavailable'));
      } catch (error) {
        if (__DEV__) console.warn('[export]', error);
        haptics.error();
        toast.show({ variant: 'danger', label: t('export.failed') });
      } finally {
        busy.current = false;
        setBusy(false);
      }
    },
    [t, toast],
  );

  return { isBusy, run };
}
