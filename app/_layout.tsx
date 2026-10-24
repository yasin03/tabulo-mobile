// uuid (v7) için crypto.getRandomValues; diğer tüm importlardan önce yüklenmeli.
import 'react-native-get-random-values';
import '../global.css';
import '@/lib/i18n';

import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { NavigationBar } from 'expo-navigation-bar';
import { router, Stack, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { HeroUINativeProvider } from 'heroui-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DatabaseGate } from '@/components/DatabaseGate';
import { fontFamilies } from '@/core/theme/tokens';
import { NotificationSync } from '@/features/notifications/NotificationSync';
import { BusinessProvider } from '@/lib/business';
import { applyThemePreference, useColors, useThemeSync } from '@/lib/theme';
import { subscribeToNotificationTaps } from '@/platform/notifications';
import { usePreferences } from '@/stores/preferences';

export { ErrorBoundary } from '@/components/ErrorScreen';

// Splash; fontlar, migration ve hazır veriler yüklenene kadar açık kalır (8.4). Kapatan: DatabaseGate.
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 200, fade: true });

// Kayıtlı tema ilk render'dan önce uygulanır; açılışta yanlış tema flaşı olmaz.
applyThemePreference(usePreferences.getState().theme);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });
  const fontsReady = fontsLoaded || !!fontError;

  useThemeSync();

  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <HeroUINativeProvider
            config={{
              textProps: { maxFontSizeMultiplier: 2 },
              textInputProps: { maxFontSizeMultiplier: 2 },
              devInfo: { stylingPrinciples: false },
            }}
          >
            <DatabaseGate>
              <BusinessProvider>
                <RootStack />
                <NotificationSync />
              </BusinessProvider>
            </DatabaseGate>
            <StatusBar style="auto" />
            <NavigationBar style="auto" />
          </HeroUINativeProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootStack() {
  const colors = useColors();
  const { t } = useTranslation();

  // Bildirime dokununca ilgili ekran (8.4); uygulama kapalıyken açıldıysa da.
  useEffect(() => subscribeToNotificationTaps((url) => router.push(url as Href)), []);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { fontFamily: fontFamilies.bold, color: colors.foreground },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        // Uzun basınca birden fazla ekran geri gitme menüsü, kaydedilmemiş değişiklik onayını atlatır.
        headerBackButtonMenuEnabled: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'default',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="transaction/new"
        options={{ presentation: 'modal', title: t('tabs.add') }}
      />
      <Stack.Screen
        name="transaction/[id]/edit"
        options={{ presentation: 'modal', title: t('transactionForm.editTitle') }}
      />
      <Stack.Screen
        name="transaction/[id]/index"
        options={{ title: t('transactionDetail.title') }}
      />
      <Stack.Screen name="transactions" options={{ title: t('transactions.title') }} />
      <Stack.Screen
        name="attachment-viewer"
        options={{ presentation: 'fullScreenModal', headerShown: false }}
      />
      <Stack.Screen name="contact/new" options={{ title: t('contactForm.newTitle') }} />
      <Stack.Screen name="contact/[id]/index" options={{ title: t('contactDetail.title') }} />
      <Stack.Screen name="contact/[id]/edit" options={{ title: t('contactForm.editTitle') }} />
      <Stack.Screen name="due-receivables" options={{ title: t('home.dueReceivables') }} />
      <Stack.Screen name="settings/business" options={{ title: t('settings.businessProfile') }} />
      <Stack.Screen name="settings/currency" options={{ title: t('settings.currency') }} />
      <Stack.Screen name="settings/accounts/index" options={{ title: t('settings.accounts') }} />
      <Stack.Screen name="settings/accounts/new" options={{ title: t('accounts.newTitle') }} />
      <Stack.Screen name="settings/accounts/[id]" options={{ title: t('accounts.editTitle') }} />
      <Stack.Screen
        name="settings/transaction-types"
        options={{ title: t('settings.transactionTypes') }}
      />
      <Stack.Screen name="settings/subjects" options={{ title: t('settings.subjects') }} />
      <Stack.Screen name="settings/backup" options={{ title: t('backup.title') }} />
      <Stack.Screen name="recurring/index" options={{ title: t('recurring.title') }} />
      <Stack.Screen name="recurring/new" options={{ title: t('recurring.newTitle') }} />
      <Stack.Screen name="recurring/[id]/index" options={{ title: t('recurring.editTitle') }} />
      <Stack.Screen
        name="recurring/[id]/pay"
        options={{ presentation: 'modal', title: t('recurring.title') }}
      />
      <Stack.Screen name="reminders/index" options={{ title: t('reminders.title') }} />
      <Stack.Screen
        name="reminders/new"
        options={{ presentation: 'modal', title: t('reminders.newTitle') }}
      />
      <Stack.Screen
        name="reminders/[id]"
        options={{ presentation: 'modal', title: t('reminders.editTitle') }}
      />
      <Stack.Screen
        name="export/statement"
        options={{ presentation: 'modal', title: t('export.statement.title') }}
      />
      <Stack.Screen
        name="export/report"
        options={{ presentation: 'modal', title: t('export.report.title') }}
      />
      <Stack.Screen name="dev/form-demo" options={{ title: t('formDemo.title') }} />
    </Stack>
  );
}
