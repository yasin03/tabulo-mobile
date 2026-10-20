import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { Uniwind, useUniwind } from 'uniwind';

import { colorTokens, type ThemeColors, type ThemeMode } from '@/core/theme/tokens';
import { usePreferences, type ThemePreference } from '@/stores/preferences';

export function applyThemePreference(preference: ThemePreference) {
  Uniwind.setTheme(preference);
}

/** Etkin tema (Sistem seçiliyse cihazın o anki teması). */
export function useThemeMode(): ThemeMode {
  const { theme } = useUniwind();
  return theme === 'dark' ? 'dark' : 'light';
}

/**
 * className kullanılamayan yerler için (SVG simgeleri, sistem çubukları, klavye araç çubuğu)
 * etkin temanın renk tokenları.
 */
export function useColors(): ThemeColors {
  return colorTokens[useThemeMode()];
}

/**
 * Tercihi Uniwind'e uygular ve kök görünüm zeminini temaya eşitler
 * (geçişlerde ve klavye animasyonlarında beyaz flaş olmasın).
 */
export function useThemeSync() {
  const preference = usePreferences((s) => s.theme);
  const mode = useThemeMode();

  useEffect(() => {
    applyThemePreference(preference);
  }, [preference]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colorTokens[mode].background);
  }, [mode]);
}
