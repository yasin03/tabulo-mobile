import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useEffect, useState } from 'react';

import { isSupportedLanguage } from '@/core/i18n';
import i18n, { deviceCurrency, resolveLanguage } from '@/lib/i18n';

import { db } from './client';
import migrations from './migrations/migrations';
import { localizeSeedRecords, seedDatabase } from './seed';

export type DatabaseSetupState =
  { status: 'pending' } | { status: 'ready' } | { status: 'error'; error: Error };

/**
 * Açılışta migration'ları uygular, ardından hazır verileri (yalnızca ilk sefer) ekler (8.4).
 * Hazır kayıtların adları uygulama diline uydurulur; dil değişince de yeniden adlandırılır.
 * Splash bu hook `pending` dışına çıkana kadar açık kalır.
 */
export function useDatabaseSetup(): DatabaseSetupState {
  // drizzle-kit'in ürettiği migrations.js, tipteki `journal` alanını içermiyor; Expo migrator onu kullanmıyor.
  const migration = useMigrations(db, migrations as unknown as Parameters<typeof useMigrations>[1]);
  const [seed, setSeed] = useState<{ done: boolean; error?: Error }>({ done: false });

  useEffect(() => {
    if (!migration.success) return;
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        const language = resolveLanguage();
        seedDatabase(db, { language, currency: deviceCurrency() });
        localizeSeedRecords(db, language);
      })
      .then(
        () => !cancelled && setSeed({ done: true }),
        (error: unknown) => !cancelled && setSeed({ done: true, error: error as Error }),
      );
    return () => {
      cancelled = true;
    };
  }, [migration.success]);

  const ready = migration.success && seed.done && !seed.error;
  useEffect(() => {
    if (!ready) return;
    const onLanguageChanged = (language: string) => {
      if (isSupportedLanguage(language)) localizeSeedRecords(db, language);
    };
    i18n.on('languageChanged', onLanguageChanged);
    return () => i18n.off('languageChanged', onLanguageChanged);
  }, [ready]);

  const error = migration.error ?? seed.error;
  if (error) return { status: 'error', error };
  if (migration.success && seed.done) return { status: 'ready' };
  return { status: 'pending' };
}
