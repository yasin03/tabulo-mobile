import type { ConfigContext, ExpoConfig } from 'expo/config';

// Marka renkleri (logo / ikon / splash). Uygulama içi renkler src/core/theme/tokens.ts'de.
const BRAND_NAVY = '#1E3A5F';
const DARK_BACKGROUND = '#0E1620';
const LIGHT_BACKGROUND = '#F6F7F9';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Tabulo',
  slug: 'tabulo',
  scheme: 'tabulo',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  backgroundColor: LIGHT_BACKGROUND,
  icon: './assets/images/icon.png',
  ios: {
    bundleIdentifier: 'app.tabulo',
    supportsTablet: false,
    infoPlist: {
      CFBundleAllowMixedLocalizations: true,
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'app.tabulo',
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon-foreground.png',
      backgroundColor: BRAND_NAVY,
    },
    predictiveBackGestureEnabled: false,
  },
  locales: {
    tr: './assets/locales/tr.json',
    en: './assets/locales/en.json',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-localization',
    'expo-system-ui',
    'expo-sqlite',
    'expo-image',
    '@react-native-community/datetimepicker',
    [
      'expo-image-picker',
      {
        // Varsayılan (İngilizce) metinler; Türkçesi assets/locales/tr.json'da (8.6).
        cameraPermission:
          'Tabulo uses the camera to photograph receipts and invoices for your records.',
        photosPermission:
          'Tabulo uses your photos to attach receipts and invoices to your records.',
        microphonePermission: false,
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-logo.png',
        imageWidth: 120,
        resizeMode: 'contain',
        backgroundColor: BRAND_NAVY,
        dark: {
          image: './assets/images/splash-logo.png',
          backgroundColor: DARK_BACKGROUND,
        },
      },
    ],
    [
      'expo-notifications',
      {
        // Android durum çubuğu simgesi: beyaz siluet (yalnızca saydamlık kullanılır).
        icon: './assets/images/notification-icon.png',
        color: BRAND_NAVY,
      },
    ],
    ['expo-navigation-bar', { enforceContrast: false }],
    [
      'expo-build-properties',
      {
        // iOS 27 SDK (Xcode 27) UIScene yaşam döngüsünü zorunlu kılıyor; SDK 58'de kaldırılabilir.
        ios: { enableSceneSupport: true },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
});
