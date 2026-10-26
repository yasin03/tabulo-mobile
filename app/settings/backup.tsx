import { router, Stack } from 'expo-router';
import { Button, Spinner, useToast } from 'heroui-native';
import { ShieldCheck, TriangleAlert } from 'lucide-react-native';
import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { formatTimeOfDay, toIsoDate, toTimeOfDay } from '@/core/dates';
import type { BackupSummary } from '@/core/backup';
import {
  applyRestore,
  cancelRestore,
  createBackup,
  prepareRestore,
} from '@/features/backup/backup';
import { useBackupReminder } from '@/features/backup/useBackupReminder';
import { useMoney } from '@/lib/business';
import { useDates } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { usePremiumGate } from '@/lib/premium';
import { useColors } from '@/lib/theme';
import { pickBackupFile } from '@/platform/backupFiles';
import { shareFile } from '@/platform/exportFiles';
import { usePreferences } from '@/stores/preferences';

type Busy = 'create' | 'restore' | null;

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-3 rounded-[18px] border border-border bg-surface p-4">
      <AppText weight="extrabold" accessibilityRole="header" className="text-[17px] leading-[24px]">
        {title}
      </AppText>
      <AppText className="text-[14px] leading-[20px] text-muted">{description}</AppText>
      {children}
    </View>
  );
}

/**
 * Yedekleme ve geri yükleme (10.3). Yedek almak Premium; geri yükleme herkese açık (kullanıcı kararı:
 * daha önce alınmış veriyi kurtarmak hiçbir zaman engellenmez).
 */
export default function BackupScreen() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const dates = useDates();
  const { language } = useMoney();
  const lastBackupDate = usePreferences((s) => s.lastBackupDate);
  const setLastBackupDate = usePreferences((s) => s.setLastBackupDate);
  const reminder = useBackupReminder();
  const requirePremium = usePremiumGate();

  const [busy, setBusy] = useState<Busy>(null);
  // Çift dokunuş ikinci bir işlem başlatmasın (8.1).
  const running = useRef(false);

  const run = async (kind: Exclude<Busy, null>, task: () => Promise<void>) => {
    if (running.current) return;
    running.current = true;
    setBusy(kind);
    try {
      await task();
    } finally {
      running.current = false;
      setBusy(null);
    }
  };

  const backup = () => {
    if (!requirePremium('backup')) return;
    return run('create', async () => {
      try {
        const { uri, kind } = await createBackup(language);
        haptics.success();
        const shared = await shareFile(uri, kind, t('backup.create.shareTitle'));
        if (!shared) {
          Alert.alert(t('export.shareUnavailable'));
          return;
        }
        // Paylaş ekranı dosyanın gerçekten kaydedilip kaydedilmediğini bildirmez; kapanınca yedek sayılır.
        setLastBackupDate(toIsoDate());
      } catch (error) {
        if (__DEV__) console.warn('[backup]', error);
        haptics.error();
        toast.show({ variant: 'danger', label: t('backup.create.failed') });
      }
    });
  };

  const summaryText = (summary: BackupSummary) => {
    const created = new Date(summary.createdAt);
    const lines = [
      t('backup.restore.summaryDate', {
        date: dates.format(toIsoDate(created), 'full'),
        time: formatTimeOfDay(toTimeOfDay(created), dates.locale),
      }),
      summary.businessName
        ? t('backup.restore.summaryBusiness', { name: summary.businessName })
        : null,
      t('backup.restore.summaryCounts', {
        contacts: summary.contacts,
        transactions: summary.transactions,
        attachments: summary.attachments,
      }),
    ];
    return lines.filter(Boolean).join('\n');
  };

  const restore = () =>
    run('restore', async () => {
      const uri = await pickBackupFile();
      if (!uri) return;
      let prepared: Awaited<ReturnType<typeof prepareRestore>>;
      try {
        prepared = await prepareRestore(uri);
      } catch (error) {
        haptics.error();
        Alert.alert(t('backup.restore.invalidTitle'), errorMessage(t, error));
        return;
      }

      haptics.warning();
      const confirmed = await new Promise<boolean>((resolve) =>
        Alert.alert(
          t('backup.restore.confirmTitle'),
          `${summaryText(prepared.summary)}\n\n${t('backup.restore.confirmWarning')}`,
          [
            { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
            {
              text: t('backup.restore.confirm'),
              style: 'destructive',
              onPress: () => resolve(true),
            },
          ],
          { cancelable: true, onDismiss: () => resolve(false) },
        ),
      );
      if (!confirmed) {
        cancelRestore();
        return;
      }

      try {
        await applyRestore(prepared, language);
        haptics.success();
        toast.show({ variant: 'success', label: t('backup.restore.done') });
        router.back();
      } catch (error) {
        if (__DEV__) console.warn('[restore]', error);
        haptics.error();
        Alert.alert(t('backup.restore.failedTitle'), t('backup.restore.failed'));
      }
    });

  const lastBackupText = lastBackupDate
    ? t('backup.lastBackup', { date: dates.format(lastBackupDate, 'full') })
    : t('backup.never');

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{ title: t('backup.title'), gestureEnabled: !busy, headerBackVisible: !busy }}
      />
      <ScrollView
        contentContainerClassName="gap-4 px-5 pt-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <View
          className={
            reminder === 'none'
              ? 'flex-row items-center gap-3 rounded-[18px] border border-border bg-surface p-4'
              : 'flex-row items-center gap-3 rounded-[18px] bg-warning-bg p-4'
          }
        >
          {reminder === 'none' ? (
            <ShieldCheck size={22} color={colors.positive} />
          ) : (
            <TriangleAlert size={22} color={colors['warning-fg']} />
          )}
          <View className="flex-1 gap-1">
            <AppText
              weight="bold"
              className={reminder === 'none' ? 'text-[15px]' : 'text-[15px] text-warning-fg'}
            >
              {lastBackupText}
            </AppText>
            {reminder !== 'none' ? (
              <AppText className="text-[13px] leading-[19px] text-warning-fg">
                {t(reminder === 'stale' ? 'backup.reminderStale' : 'backup.reminderNeverHint')}
              </AppText>
            ) : null}
          </View>
        </View>

        <Card title={t('backup.create.title')} description={t('backup.create.description')}>
          <Button
            variant="primary"
            size="lg"
            className="h-[52px]"
            isDisabled={busy !== null}
            onPress={() => void backup()}
          >
            {busy === 'create' ? (
              <>
                <Spinner color={colors['accent-foreground']} />
                <Button.Label className="text-[16px]">{t('backup.create.working')}</Button.Label>
              </>
            ) : (
              <Button.Label className="text-[16px]">{t('backup.create.button')}</Button.Label>
            )}
          </Button>
        </Card>

        <Card title={t('backup.restore.title')} description={t('backup.restore.description')}>
          <Button
            variant="secondary"
            size="lg"
            className="h-[52px]"
            isDisabled={busy !== null}
            onPress={() => void restore()}
          >
            {busy === 'restore' ? (
              <>
                <Spinner color={colors.primary} />
                <Button.Label className="text-[16px]">{t('backup.restore.working')}</Button.Label>
              </>
            ) : (
              <Button.Label className="text-[16px]">{t('backup.restore.button')}</Button.Label>
            )}
          </Button>
        </Card>

        <AppText className="px-1 text-[13px] leading-[19px] text-muted">
          {t('backup.privacyNote')}
        </AppText>
      </ScrollView>
    </View>
  );
}
