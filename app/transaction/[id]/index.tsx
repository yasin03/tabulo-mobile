import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Button } from 'heroui-native';
import { ChevronRight, Pencil, SearchX, Trash2 } from 'lucide-react-native';
import { useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { EmptyState } from '@/components/ui/EmptyState';
import { generalDisplay } from '@/core/ledger';
import { transactionsRepo } from '@/db';
import { useLiveQuery } from '@/db/useLiveQuery';
import { AttachmentThumb } from '@/features/transactions/AttachmentThumb';
import { MOVEMENT_STYLE } from '@/features/transactions/movementStyle';
import { useTransactionActions } from '@/features/transactions/useTransactionActions';
import { useMoney } from '@/lib/business';
import { cn } from '@/lib/cn';
import { useDates } from '@/lib/dates';
import { useColors } from '@/lib/theme';
import { attachmentKind, resolveAttachmentUri } from '@/platform/attachments';

const TONE_CLASS = { positive: 'text-positive', negative: 'text-negative', neutral: '' } as const;

function InfoRow({
  label,
  value,
  isFirst,
  onPress,
}: {
  label: string;
  value: ReactNode;
  isFirst: boolean;
  onPress?: () => void;
}) {
  const colors = useColors();
  const content = (
    <>
      <AppText className="w-[38%] text-[13px] leading-[20px] text-muted">{label}</AppText>
      <View className="flex-1 flex-row items-center justify-end gap-1">
        {typeof value === 'string' ? (
          <AppText weight="semibold" className="shrink text-right">
            {value}
          </AppText>
        ) : (
          value
        )}
        {onPress ? <ChevronRight size={18} color={colors.muted} /> : null}
      </View>
    </>
  );
  const className = cn(
    'min-h-12 flex-row items-center gap-3 px-4 py-3',
    !isFirst && 'border-t border-separator',
  );
  return onPress ? (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      className={cn(className, 'active:bg-surface-secondary')}
    >
      {content}
    </Pressable>
  ) : (
    <View accessible className={className}>
      {content}
    </View>
  );
}

/** Hareket detay (7.7): tüm alanlar, belge önizlemeleri, Düzenle, Sil. */
export default function TransactionDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const money = useMoney();
  const dates = useDates();
  const actions = useTransactionActions();
  const query = useCallback(() => transactionsRepo.getDetail(id), [id]);
  const { data: tx, error } = useLiveQuery(query);

  const header = <Stack.Screen options={{ title: t('transactionDetail.title') }} />;

  // Silinen (veya bulunamayan) hareket.
  if (!tx || (error && !tx)) {
    return (
      <View className="flex-1 bg-background px-5 pt-4">
        {header}
        {error ? <EmptyState icon={SearchX} title={t('errors.domain.notFound')} /> : null}
      </View>
    );
  }

  const style = MOVEMENT_STYLE[tx.movementType];
  const Icon = style.icon;
  const display = generalDisplay(tx);

  const rows: { key: string; label: string; value: string; onPress?: () => void }[] = [];
  const add = (key: string, label: string, value: string | null, onPress?: () => void) => {
    if (value) rows.push({ key, label, value, onPress });
  };
  add('date', t('transactionForm.date'), dates.format(tx.date, 'full'));
  add('contact', t('transactionForm.contact'), tx.contactName, () =>
    router.push({ pathname: '/contact/[id]', params: { id: tx.contactId! } }),
  );
  add('account', t('transactionForm.account'), tx.accountName);
  add(
    'openingDirection',
    t('transactionForm.openingDirection'),
    tx.openingDirection
      ? t(
          tx.openingDirection === 'receivable'
            ? 'contactForm.openingReceivable'
            : 'contactForm.openingPayable',
        )
      : null,
  );
  add(
    'dueDate',
    t('transactionForm.dueDate'),
    tx.dueDate ? dates.format(tx.dueDate, 'full') : null,
  );
  add('type', t('transactionDetail.type'), tx.transactionTypeName);
  add('subject', t('transactionForm.subject'), tx.subjectName);
  add('documentNo', t('transactionForm.documentNo'), tx.documentNo);
  add('description', t('transactionForm.description'), tx.description);

  const remove = async () => {
    if (await actions.remove(tx)) router.back();
  };

  return (
    <View className="flex-1 bg-background">
      {header}
      <ScrollView
        contentContainerClassName="gap-4 px-5 pt-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
      >
        <View className="items-center gap-2 rounded-[22px] border border-border bg-surface px-5 py-6">
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-surface-secondary">
            <Icon size={24} color={colors[style.color]} strokeWidth={2} />
          </View>
          <AppText weight="semibold" className="text-[13px] text-muted">
            {t(`movementTypes.${tx.movementType}`)}
          </AppText>
          <AppText
            weight="extrabold"
            accessibilityRole="header"
            className={cn(
              'text-center text-[32px] leading-[40px] tracking-[-0.6px]',
              TONE_CLASS[display.tone],
            )}
          >
            {money.formatSigned(display.sign * tx.amountMinor)}
          </AppText>
        </View>

        <View className="overflow-hidden rounded-[18px] border border-border bg-surface">
          {rows.map((row, index) => (
            <InfoRow
              key={row.key}
              label={row.label}
              value={row.value}
              isFirst={index === 0}
              onPress={row.onPress}
            />
          ))}
        </View>

        {tx.attachments.length > 0 ? (
          <View className="gap-2">
            <AppText weight="extrabold" accessibilityRole="header" className="text-[17px]">
              {t('attachments.title')}
            </AppText>
            <View className="flex-row flex-wrap gap-3">
              {tx.attachments.map((item) => (
                <AttachmentThumb
                  key={item.id}
                  uri={resolveAttachmentUri(item.fileUri)}
                  kind={attachmentKind(item.mimeType)}
                  fileName={item.fileName}
                />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View
        className="absolute inset-x-0 bottom-0 flex-row gap-3 border-t border-border bg-background px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <Button variant="danger-soft" size="lg" className="h-[52px] flex-1" onPress={remove}>
          <Trash2 size={18} color={colors.negative} />
          <Button.Label>{t('common.delete')}</Button.Label>
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="h-[52px] flex-1"
          onPress={() => actions.edit(tx)}
        >
          <Pencil size={18} color={colors['accent-foreground']} />
          <Button.Label>{t('common.edit')}</Button.Label>
        </Button>
      </View>
    </View>
  );
}
