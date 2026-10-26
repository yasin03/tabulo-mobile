import Constants from 'expo-constants';
import { router } from 'expo-router';
import {
  BellRing,
  Building2,
  CalendarClock,
  Coins,
  Crown,
  DatabaseBackup,
  FlaskConical,
  Landmark,
  RotateCcw,
  ShieldCheck,
  Tags,
  TrendingUpDown,
  TriangleAlert,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { TabScreen } from '@/components/ui/TabScreen';
import { TimeField } from '@/components/ui/TimeField';
import type { PremiumOverride } from '@/config/plans';
import { toIsoDate } from '@/core/dates';
import type { Language } from '@/core/i18n';
import { CURRENCY_SYMBOLS } from '@/core/money';
import { useBackupReminder } from '@/features/backup/useBackupReminder';
import { PermissionBanner } from '@/features/notifications/PermissionBanner';
import { useRestorePurchases } from '@/features/premium/useRestorePurchases';
import { useBusinessProfile, useMoney } from '@/lib/business';
import { useDates } from '@/lib/dates';
import { resolveLanguage } from '@/lib/i18n';
import { openPaywall, useIsPremium, useSubscriptionTerm } from '@/lib/premium';
import { useColors } from '@/lib/theme';
import { isPurchasesAvailable, openManageSubscriptions } from '@/platform/purchases';
import { usePreferences, type ThemePreference } from '@/stores/preferences';
import { usePremiumStore } from '@/stores/premium';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2.5">
      <AppText weight="extrabold" accessibilityRole="header" className="text-[17px] leading-[24px]">
        {title}
      </AppText>
      {children}
    </View>
  );
}

/** Ayarlar (7.11). */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const profile = useBusinessProfile();
  const { currency } = useMoney();
  const theme = usePreferences((s) => s.theme);
  const setTheme = usePreferences((s) => s.setTheme);
  const language = usePreferences((s) => s.language) ?? resolveLanguage();
  const setLanguage = usePreferences((s) => s.setLanguage);
  const remindTime = usePreferences((s) => s.defaultRemindTime);
  const setRemindTime = usePreferences((s) => s.setDefaultRemindTime);
  const lastBackupDate = usePreferences((s) => s.lastBackupDate);
  const backupReminder = useBackupReminder();
  const dates = useDates();
  const isPremium = useIsPremium();
  const subscription = useSubscriptionTerm();
  const premiumOverride = usePremiumStore((s) => s.override);
  const setPremiumOverride = usePremiumStore((s) => s.setOverride);
  const restorePurchases = useRestorePurchases();
  const [isRestoring, setRestoring] = useState(false);

  const restore = async () => {
    if (isRestoring) return;
    setRestoring(true);
    try {
      await restorePurchases();
    } finally {
      setRestoring(false);
    }
  };

  return (
    <TabScreen title={t('tabs.settings')}>
      <SettingsGroup title={t('premium.title')}>
        <SettingsRow
          icon={Crown}
          label={t('premium.title')}
          value={
            !isPremium
              ? t('premium.statusFree')
              : subscription?.kind === 'ends'
                ? t('premium.statusEnds', {
                    date: dates.format(toIsoDate(new Date(subscription.at)), 'dayMonthYear'),
                  })
                : t('premium.statusActive')
          }
          onPress={() => openPaywall()}
        />
        {isPremium && isPurchasesAvailable() ? (
          <SettingsRow
            icon={CalendarClock}
            label={t('premium.manage')}
            onPress={() => void openManageSubscriptions().catch(() => undefined)}
          />
        ) : null}
        {isPurchasesAvailable() ? (
          <SettingsRow
            icon={RotateCcw}
            label={t('premium.restore')}
            value={isRestoring ? t('premium.restoring') : undefined}
            onPress={() => void restore()}
          />
        ) : null}
      </SettingsGroup>

      <SettingsGroup title={t('settings.business')}>
        <SettingsRow
          icon={Building2}
          label={t('settings.businessProfile')}
          value={profile.name || undefined}
          onPress={() => router.push('/settings/business')}
        />
        <SettingsRow
          icon={Coins}
          label={t('settings.currency')}
          value={`${currency} (${CURRENCY_SYMBOLS[currency]})`}
          onPress={() => router.push('/settings/currency')}
        />
      </SettingsGroup>

      <SettingsGroup title={t('settings.definitions')}>
        <SettingsRow
          icon={Landmark}
          label={t('settings.accounts')}
          onPress={() => router.push('/settings/accounts')}
        />
        <SettingsRow
          icon={TrendingUpDown}
          label={t('settings.transactionTypes')}
          onPress={() => router.push('/settings/transaction-types')}
        />
        <SettingsRow
          icon={Tags}
          label={t('settings.subjects')}
          onPress={() => router.push('/settings/subjects')}
        />
      </SettingsGroup>

      <SettingsGroup title={t('settings.reminders')}>
        <SettingsRow
          icon={CalendarClock}
          label={t('recurring.title')}
          onPress={() => router.push('/recurring')}
        />
        <SettingsRow
          icon={BellRing}
          label={t('reminders.title')}
          onPress={() => router.push('/reminders')}
        />
      </SettingsGroup>

      <View className="gap-2.5">
        <SettingsGroup title={t('settings.data')}>
          <SettingsRow
            icon={DatabaseBackup}
            label={t('backup.title')}
            value={
              lastBackupDate ? dates.format(lastBackupDate, 'dayMonthYear') : t('backup.neverShort')
            }
            onPress={() => router.push('/settings/backup')}
          />
        </SettingsGroup>
        {backupReminder !== 'none' ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/settings/backup')}
            className="flex-row gap-3 rounded-[18px] bg-warning-bg p-4 active:opacity-80"
          >
            <TriangleAlert size={20} color={colors['warning-fg']} />
            <AppText className="flex-1 text-[13px] leading-[19px] text-warning-fg">
              {t(backupReminder === 'stale' ? 'backup.reminderStale' : 'backup.reminderNever')}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <Section title={t('settings.notifications')}>
        <TimeField
          label={t('settings.defaultRemindTime')}
          value={remindTime}
          onChange={setRemindTime}
        />
        <AppText className="text-[13px] leading-[19px] text-muted">
          {t('settings.defaultRemindTimeHint')}
        </AppText>
        <PermissionBanner />
      </Section>

      <Section title={t('settings.appearance')}>
        <AppText weight="semibold" className="text-[13px] text-muted">
          {t('settings.theme')}
        </AppText>
        <SegmentedControl<ThemePreference>
          accessibilityLabel={t('settings.theme')}
          value={theme}
          onChange={setTheme}
          options={[
            { value: 'light', label: t('settings.themeLight') },
            { value: 'dark', label: t('settings.themeDark') },
            { value: 'system', label: t('settings.themeSystem') },
          ]}
        />
      </Section>

      <Section title={t('settings.language')}>
        <SegmentedControl<Language>
          accessibilityLabel={t('settings.language')}
          value={language}
          onChange={setLanguage}
          options={[
            { value: 'tr', label: t('settings.languageTr') },
            { value: 'en', label: t('settings.languageEn') },
          ]}
        />
      </Section>

      {__DEV__ ? (
        <SettingsGroup title={t('settings.developer')}>
          <SettingsRow
            icon={FlaskConical}
            label={t('settings.formDemo')}
            onPress={() => router.push('/dev/form-demo')}
          />
        </SettingsGroup>
      ) : null}

      {__DEV__ ? (
        <Section title={t('premium.devToggle')}>
          <SegmentedControl<PremiumOverride>
            accessibilityLabel={t('premium.devToggle')}
            value={premiumOverride}
            onChange={setPremiumOverride}
            options={[
              { value: 'auto', label: t('premium.devAuto') },
              { value: 'on', label: t('premium.devOn') },
              { value: 'off', label: t('premium.devOff') },
            ]}
          />
          <AppText className="text-[13px] leading-[19px] text-muted">
            {t('premium.devHint')}
          </AppText>
        </Section>
      ) : null}

      <View className="flex-row items-center gap-3 rounded-[18px] border border-border bg-surface p-4">
        <ShieldCheck size={22} color={colors.positive} />
        <AppText className="flex-1 text-[13px] leading-[19px] text-muted">
          {t('settings.privacyNote')}
        </AppText>
      </View>

      <AppText className="text-center text-[12px] text-muted">
        {t('settings.version', { version: Constants.expoConfig?.version ?? '' })}
      </AppText>
    </TabScreen>
  );
}
