import { router, Stack } from 'expo-router';
import { Button, useToast } from 'heroui-native';
import { Square, SquareCheck, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { DATA_CATEGORIES, resolveDataSelection, type DataCategory } from '@/core/dataReset';
import { ConfirmPhraseDialog } from '@/features/dataReset/ConfirmPhraseDialog';
import { deleteData } from '@/features/dataReset/deleteData';
import { useMoney } from '@/lib/business';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { useColors } from '@/lib/theme';

/**
 * Verileri sil (Ayarlar → Veriler): silinecek gruplar seçilir; iki aşamalı onay (uyarı diyaloğu, ardından
 * "Verileri Sil" yazarak). Silinen veri geri alınamaz; önce yedek alınması önerilir.
 */
export default function DeleteDataScreen() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { language, currency } = useMoney();
  const [selected, setSelected] = useState<ReadonlySet<DataCategory>>(new Set());
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [isWorking, setWorking] = useState(false);

  const { categories, transactionsForced } = resolveDataSelection(selected);
  const toggle = (category: DataCategory) => {
    haptics.selection();
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const labels = categories.map((category) => `• ${t(`dataReset.categories.${category}.title`)}`);

  const start = () => {
    haptics.warning();
    Alert.alert(
      t('dataReset.firstConfirmTitle'),
      `${labels.join('\n')}\n\n${t('dataReset.firstConfirmMessage')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('dataReset.backupFirst'),
          onPress: () => router.push('/settings/backup'),
        },
        {
          text: t('dataReset.continue'),
          style: 'destructive',
          onPress: () => setConfirmOpen(true),
        },
      ],
      { cancelable: true },
    );
  };

  const confirm = async () => {
    setWorking(true);
    try {
      await deleteData(categories, { language, currency });
      haptics.success();
      setConfirmOpen(false);
      toast.show({ variant: 'success', label: t('dataReset.done') });
      router.back();
    } catch (error) {
      if (__DEV__) console.warn('[dataReset]', error);
      haptics.error();
      Alert.alert(t('dataReset.failedTitle'), t('dataReset.failed'));
      throw error;
    } finally {
      setWorking(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: t('dataReset.title'),
          gestureEnabled: !isWorking,
          headerBackVisible: !isWorking,
        }}
      />
      <ScrollView
        contentContainerClassName="gap-4 px-5 pt-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <View className="flex-row gap-3 rounded-[18px] bg-warning-bg p-4">
          <TriangleAlert size={22} color={colors['warning-fg']} />
          <AppText className="flex-1 text-[13px] leading-[19px] text-warning-fg">
            {t('dataReset.warning')}
          </AppText>
        </View>

        <View className="overflow-hidden rounded-[18px] border border-border bg-surface">
          {DATA_CATEGORIES.map((category, index) => {
            const isForced = category === 'transactions' && transactionsForced;
            const isChecked = categories.includes(category);
            const Icon = isChecked ? SquareCheck : Square;
            return (
              <Pressable
                key={category}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isChecked, disabled: isForced }}
                accessibilityHint={isForced ? t('dataReset.forcedHint') : undefined}
                disabled={isForced}
                onPress={() => toggle(category)}
                className={cn(
                  'min-h-16 flex-row items-center gap-3 px-4 py-3 active:bg-surface-secondary',
                  index > 0 && 'border-t border-separator',
                )}
              >
                <Icon
                  size={24}
                  color={isChecked ? colors.negative : colors.muted}
                  strokeWidth={2}
                />
                <View className={cn('flex-1 gap-0.5', isForced && 'opacity-60')}>
                  <AppText weight="bold" className="text-[15px] leading-[21px]">
                    {t(`dataReset.categories.${category}.title`)}
                  </AppText>
                  <AppText className="text-[13px] leading-[18px] text-muted">
                    {isForced
                      ? t('dataReset.forcedHint')
                      : t(`dataReset.categories.${category}.description`)}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Button
          variant="danger-soft"
          size="lg"
          className="h-[52px]"
          isDisabled={categories.length === 0 || isWorking}
          onPress={start}
        >
          <Button.Label className="text-[16px]">{t('dataReset.button')}</Button.Label>
        </Button>
      </ScrollView>

      <ConfirmPhraseDialog
        isOpen={isConfirmOpen}
        title={t('dataReset.secondConfirmTitle')}
        description={t('dataReset.secondConfirmMessage')}
        phrase={t('dataReset.phrase')}
        confirmLabel={t('dataReset.confirm')}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirm}
      />
    </View>
  );
}
