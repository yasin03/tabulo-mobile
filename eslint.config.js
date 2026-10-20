// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

// src/core saf TypeScript'tir; ileride web ile paylaşılacak (PROMPT.md Bölüm 9).
// Buraya React Native, Expo veya herhangi bir mobil/UI paketi girmez.
const CORE_FORBIDDEN_PATTERNS = [
  'react',
  'react-*',
  'react-native',
  'react-native-*',
  '@react-native/*',
  '@react-native-*/*',
  'expo',
  'expo-*',
  '@expo/*',
  '@expo-google-fonts/*',
  '@shopify/*',
  '@gorhom/*',
  'heroui-native',
  'heroui-native/*',
  'uniwind',
  'uniwind/*',
  'lucide-react-native',
  'i18next',
  'react-i18next',
  'zustand',
  'zustand/*',
  '@/components/*',
  '@/lib/*',
  '@/platform/*',
  '@/stores/*',
  '@/db/*',
  // Şema saf TypeScript'tir (drizzle-orm/sqlite-core + uuid); MOVEMENT_EFFECT gibi sabitler oradan gelir.
  '!@/db/schema',
  '@/features/*',
];

module.exports = defineConfig([
  expoConfig,
  eslintPluginPrettierRecommended,
  {
    ignores: [
      'dist/*',
      'ios/*',
      'android/*',
      '.expo/*',
      'docs/*',
      'src/uniwind-types.d.ts',
      'src/db/migrations/*',
      'expo-env.d.ts',
    ],
  },
  {
    files: ['src/core/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: CORE_FORBIDDEN_PATTERNS,
              message:
                'src/core saf TypeScript olmalı: React Native / Expo / mobil paket import edilemez (PROMPT.md Bölüm 9).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/db/**/*.ts'],
    ignores: ['src/db/**/*.test.ts', 'src/db/testing.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='get'][arguments.length=0]",
          message:
            "Drizzle .get() expo-sqlite'ta ifadeyi açık bırakır ve sonraki COMMIT başarısız olur; .all()[0] kullan (bkz. src/db/types.ts).",
        },
      ],
    },
  },
]);
