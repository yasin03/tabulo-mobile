import { router, Stack, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { FormScreen } from '@/components/ui/FormScreen';
import { PickerField, type PickerOption } from '@/components/ui/PickerField';
import { buildStatement, balanceSide } from '@/core/statement';
import { contactsRepo, transactionsRepo } from '@/db';
import { useLiveQuery } from '@/db/useLiveQuery';
import { statementBalanceText } from '@/features/export/documents';
import { exportStatement } from '@/features/export/exporters';
import {
  PeriodChoice,
  PreviewCard,
  PreviewRow,
  SwitchRow,
  type PeriodValue,
} from '@/features/export/ExportOptions';
import { useFormatContext, useShareExport } from '@/features/export/useExport';
import { PremiumRequiredScreen } from '@/features/premium/PremiumRequiredScreen';
import { periodRange } from '@/features/transactions/filters';
import { useMoney } from '@/lib/business';
import { haptics } from '@/lib/haptics';
import { useIsPremium } from '@/lib/premium';
import { useColors } from '@/lib/theme';

/**
 * PDF cari ekstresi (10.1, 6.7): dönem + KVKK seçeneği → PDF → paylaş ekranı (WhatsApp).
 * Cari detayından `contactId` ile gelir; ana sayfadaki "Ekstre"den cari seçilir.
 */
export default function StatementExportScreen() {
  const { t } = useTranslation();
  const isPremium = useIsPremium();
  if (!isPremium) return <PremiumRequiredScreen title={t('export.statement.title')} />;
  return <StatementExportForm />;
}

function StatementExportForm() {
  const { t } = useTranslation();
  const colors = useColors();
  const money = useMoney();
  const ctx = useFormatContext();
  const params = useLocalSearchParams<{ contactId?: string }>();
  const { isBusy, run } = useShareExport();

  const [contactId, setContactId] = useState(params.contactId ?? '');
  const [contactError, setContactError] = useState<string>();
  // Varsayılan "Tümü" (kullanıcı kararı, Faz 7).
  const [period, setPeriod] = useState<PeriodValue>({ period: 'all', from: '', to: '' });
  const [includeNationalId, setIncludeNationalId] = useState(false);

  const contactsQuery = useCallback(
    () =>
      params.contactId
        ? Promise.resolve([])
        : contactsRepo.list({ status: 'all', locale: ctx.locale }),
    [params.contactId, ctx.locale],
  );
  const { data: contacts } = useLiveQuery(contactsQuery);

  const detailQuery = useCallback(async () => {
    if (!contactId) return null;
    const [contact, transactions] = await Promise.all([
      contactsRepo.getById(contactId),
      transactionsRepo.listForContact(contactId),
    ]);
    return { contact, chronological: [...transactions].reverse() };
  }, [contactId]);
  const { data: detail } = useLiveQuery(detailQuery);

  const range = useMemo(() => {
    const { from, to } = periodRange(period, ctx.today);
    return from && to && from > to ? { from: to, to: from } : { from, to };
  }, [period, ctx.today]);
  const statement = useMemo(
    () => (detail ? buildStatement(detail.chronological, range) : null),
    [detail, range],
  );

  const contactOptions = useMemo<PickerOption[]>(
    () =>
      (contacts ?? []).map((c) => ({
        value: c.id,
        label: c.name,
        description: statementBalanceText(c.balanceMinor, ctx),
      })),
    [contacts, ctx],
  );

  const contact = detail?.contact;
  const canIncludeId = contact?.personType === 'individual' && !!contact.nationalId;

  const submit = () => {
    if (!contactId) {
      haptics.error();
      setContactError(t('export.statement.contactRequired'));
      return;
    }
    void run('pdf', t('export.statement.shareTitle'), () =>
      exportStatement(
        { contactId, range, includeNationalId: canIncludeId && includeNationalId },
        ctx,
      ),
    );
  };

  const tone = (minor: number) =>
    minor > 0 ? ('positive' as const) : minor < 0 ? ('negative' as const) : ('neutral' as const);

  return (
    <FormScreen
      onSubmit={submit}
      submitLabel={t('export.statement.submit')}
      isSubmitting={isBusy}
      isSubmitDisabled={!!contactId && !contact}
    >
      <Stack.Screen
        options={{
          title: t('export.statement.title'),
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={() => router.back()}
              hitSlop={8}
              className="h-11 w-11 items-center justify-center active:opacity-70"
            >
              <X size={24} color={colors.primary} />
            </Pressable>
          ),
        }}
      />

      {params.contactId ? (
        <View className="gap-0.5 rounded-[18px] border border-border bg-surface p-4">
          <AppText className="text-[12px] leading-[17px] text-muted">
            {t('export.statement.contact')}
          </AppText>
          <AppText weight="bold">{contact?.name ?? ''}</AppText>
        </View>
      ) : (
        <PickerField
          label={t('export.statement.contact')}
          placeholder={t('export.statement.contactPlaceholder')}
          disabledPlaceholder={t('transactionForm.noContacts')}
          isRequired
          isClearable={false}
          value={contactId}
          options={contactOptions}
          onChange={(value) => {
            setContactId(value);
            setContactError(undefined);
          }}
          error={contactError}
        />
      )}

      <PeriodChoice value={period} onChange={setPeriod} />

      {statement ? (
        <PreviewCard title={t('export.statement.preview')}>
          <AppText className="text-[13px] text-muted">
            {t('export.statement.movementCount', { count: statement.rows.length })}
          </AppText>
          {range.from ? (
            <PreviewRow
              label={t('export.statement.opening')}
              value={statementBalanceText(statement.openingBalanceMinor, ctx)}
              tone={tone(statement.openingBalanceMinor)}
            />
          ) : null}
          <PreviewRow
            label={t('export.statement.periodDebit')}
            value={money.format(statement.totalDebitMinor)}
            tone="positive"
          />
          <PreviewRow
            label={t('export.statement.periodCredit')}
            value={money.format(statement.totalCreditMinor)}
            tone="negative"
          />
          <PreviewRow
            label={t('export.statement.closingShort')}
            value={statementBalanceText(statement.closingBalanceMinor, ctx)}
            tone={tone(statement.closingBalanceMinor)}
            isStrong
          />
          <AppText className="text-[13px] leading-[18px] text-muted">
            {t(
              `export.statement.closingCaption.${balanceSide(statement.closingBalanceMinor) ?? 'settled'}`,
            )}
          </AppText>
        </PreviewCard>
      ) : null}

      {canIncludeId ? (
        <SwitchRow
          label={t('export.includeIds')}
          hint={t('export.includeIdsHint')}
          value={includeNationalId}
          onChange={setIncludeNationalId}
        />
      ) : null}

      <AppText className="text-[13px] leading-[19px] text-muted">
        {t('export.statement.hint')}
      </AppText>
    </FormScreen>
  );
}
