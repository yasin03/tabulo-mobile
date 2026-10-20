// Tasarım tokenları – PROMPT.md 4.2.
// global.css içindeki @variant light / @variant dark değerleri bu dosyayla birebir aynı olmalıdır
// (tokens.test.ts bunu doğrular). className kullanılamayan yerlerde (SVG simgeleri, durum çubuğu,
// klavye araç çubuğu, grafikler) renkler buradan okunur.

export type ThemeMode = 'light' | 'dark';

export const colorTokens = {
  light: {
    primary: '#1E3A5F',
    'primary-foreground': '#FFFFFF',
    accent: '#F2A93B',
    'accent-foreground': '#16202B',
    background: '#F6F7F9',
    surface: '#FFFFFF',
    foreground: '#16202B',
    muted: '#5B6472',
    border: '#E3E6EB',
    positive: '#15803D',
    negative: '#B91C1C',
    'warning-bg': '#FDF3E1',
    'warning-fg': '#8A5300',
    // Tasarımdan türetilen yardımcı tonlar (home.html / client-detail.html)
    separator: '#EEF0F3',
    'surface-secondary': '#EAF0F7',
    // Ana sayfa özet kartı: iki temada da lacivert kart (home.html, 7.2)
    summary: '#1E3A5F',
    'summary-foreground': '#FFFFFF',
    'summary-muted': '#C9D3E0',
    'summary-positive': '#6EE7A0',
    'summary-negative': '#FCA5A5',
    'summary-tile': 'rgba(255, 255, 255, 0.08)',
  },
  dark: {
    primary: '#8FB4E3',
    'primary-foreground': '#0E1620',
    accent: '#F2A93B',
    'accent-foreground': '#16202B',
    background: '#0E1620',
    surface: '#16202B',
    foreground: '#F2F4F7',
    muted: '#AEB7C3',
    border: '#273242',
    positive: '#4ADE80',
    negative: '#F87171',
    'warning-bg': '#3A2A10',
    'warning-fg': '#F5C77A',
    separator: '#1F2A38',
    'surface-secondary': '#1D2B3D',
    summary: '#1B3354',
    'summary-foreground': '#F2F4F7',
    'summary-muted': '#B9C6D6',
    'summary-positive': '#6EE7A0',
    'summary-negative': '#FCA5A5',
    'summary-tile': 'rgba(255, 255, 255, 0.07)',
  },
} as const satisfies Record<ThemeMode, Record<string, string>>;

export type ColorToken = keyof (typeof colorTokens)['light'];
export type ThemeColors = Record<ColorToken, string>;

/** Marka renkleri – yalnızca logo, uygulama ikonu ve splash için (temadan bağımsız). */
export const brandColors = {
  navy: '#1E3A5F',
  amber: '#F2A93B',
  white: '#FFFFFF',
} as const;

/** Plus Jakarta Sans yüz adları (expo-font ile yüklenen anahtarlar; global.css --font-* ile aynı). */
export const fontFamilies = {
  normal: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

/** 4.3: Köşe yuvarlaklıkları (px). */
export const radii = {
  card: 18,
  cardLarge: 22,
  button: 14,
  input: 12,
} as const;

/** 4.3: Dokunulabilir alanlar en az 44×44. */
export const MIN_TOUCH_TARGET = 44;
