import { router, Stack, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { FormScreen } from '@/components/ui/FormScreen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import type { MovementType } from '@/core/ledger';
import { formatPeriod, PERIOD_UNITS, type Period } from '@/core/periods';
import { isIsoDate } from '@/core/validation';
import {
  accountsRepo,
  contactsRepo,
  subjectsRepo,
  transactionsRepo,
  transactionTypesRepo,
} from '@/db';
import type { TransactionSearchFilter } from '@/db/repositories';
import { MOVEMENT_TYPES } from '@/db/schema';
import { useLiveQuery } from '@/db/useLiveQuery';
import { exportExcel, exportReportPdf } from '@/features/export/exporters';
import { PreviewCard, SwitchRow } from '@/features/export/ExportOptions';
import { useFormatContext, useShareExport } from '@/features/export/useExport';
import { PremiumRequiredScreen } from '@/features/premium/PremiumRequiredScreen';
import { useDates } from '@/lib/dates';
import { useIsPremium } from '@/lib/premium';
import { useColors } from '@/lib/theme';

type Format = 'pdf' | 'excel';

/** Rota parametreleri: raporlardan `source=report` + dönem; tüm hareketlerden `source=transactions` + filtreler. */
type Params = {
  source?: 'report' | 'transactions';
  unit?: string;
  from?: string;
  to?: string;
  types?: string;
  accountId?: string;
  transactionTypeId?: string;
  subjectId?: string;
  contactId?: string;
  search?: string;
};

const validDate = (value?: string) => (value && isIsoDate(value) ? value : undefined);

function searchFilterFrom(params: Params): TransactionSearchFilter {
  const types = (params.types ?? '')
    .split(',')
    .filter((type): type is MovementType => (MOVEMENT_TYPES as readonly string[]).includes(type));
  return {
    from: validDate(params.from),
    to: validDate(params.to),
    movementTypes: types.length > 0 ? types : undefined,
    accountId: params.accountId || undefined,
    transactionTypeId: params.transactionTypeId || undefined,
    subjectId: params.subjectId || undefined,
    contactId: params.contactId || undefined,
    search: params.search?.trim() || undefined,
  };
}

/** Kayıt silinmiş olabilir; adı bulunamayan filtre yine de "?" yerine atlanır. */
const nameOf = (load: () => Promise<{ name: string }>) =>
  load().then(
    (row) => row.name,
    () => null,
  );

/**
 * Dışa aktar (7.9, 10.2): raporlardan PDF dönem raporu veya Excel; tüm hareketlerden Excel (filtreler uygulanır).
 */
export default function ReportExportScreen() {
  const { t } = useTranslation();
  const isPremium = useIsPremium();
  if (!isPremium) return <PremiumRequiredScreen title={t('export.report.title')} />;
  return <ReportExportForm />;
}

function ReportExportForm() {
  const { t } = useTranslation();
  const colors = useColors();
  const ctx = useFormatContext();
  const dates = useDates();
  const params = useLocalSearchParams<Params>();
  const { isBusy, run } = useShareExport();
  const isReport = params.source !== 'transactions';

  const [format, setFormat] = useState<Format>(isReport ? 'pdf' : 'excel');
  const [includeNationalId, setIncludeNationalId] = useState(false);

  const filter = useMemo(() => searchFilterFrom(params), [params]);
  const period = useMemo<Period | null>(() => {
    if (!isReport || !filter.from || !filter.to) return null;
    const unit = (PERIOD_UNITS as readonly string[]).includes(params.unit ?? '')
      ? (params.unit as Period['unit'])
      : 'custom';
    return { unit, from: filter.from, to: filter.to };
  }, [isReport, filter.from, filter.to, params.unit]);
  const periodLabel = period ? formatPeriod(period, ctx.locale) : '';

  const query = useCallback(async () => {
    const [count, account, transactionType, subject, contact] = await Promise.all([
      transactionsRepo.search(filter).then((rows) => rows.length),
      filter.accountId ? nameOf(() => accountsRepo.getById(filter.accountId!)) : null,
      filter.transactionTypeId
        ? nameOf(() => transactionTypesRepo.getById(filter.transactionTypeId!))
        : null,
      filter.subjectId ? nameOf(() => subjectsRepo.getById(filter.subjectId!)) : null,
      filter.contactId ? nameOf(() => contactsRepo.getById(filter.contactId!)) : null,
    ]);
    return { count, account, transactionType, subject, contact };
  }, [filter]);
  const { data } = useLiveQuery(query);

  /** Excel "Dönem özeti" sayfasına ve ekrana yazılan filtreler. */
  const filterLabels = useMemo(() => {
    const labels: string[] = [];
    if (filter.movementTypes) {
      labels.push(
        t('export.excel.filter.types', {
          value: filter.movementTypes.map((type) => t(`movementTypes.${type}`)).join(', '),
        }),
      );
    }
    if (data?.account) labels.push(t('export.excel.filter.account', { value: data.account }));
    if (data?.transactionType) {
      labels.push(t('export.excel.filter.transactionType', { value: data.transactionType }));
    }
    if (data?.subject) labels.push(t('export.excel.filter.subject', { value: data.subject }));
    if (data?.contact) labels.push(t('export.excel.filter.contact', { value: data.contact }));
    if (filter.search) labels.push(t('export.excel.filter.search', { value: filter.search }));
    return labels;
  }, [filter, data, t]);

  const rangeLabel = (() => {
    if (periodLabel) return periodLabel;
    if (!filter.from && !filter.to) return t('export.periods.all');
    const fmt = (iso?: string) => (iso ? dates.format(iso, 'dayMonthYear') : '…');
    return `${fmt(filter.from)} – ${fmt(filter.to)}`;
  })();

  const submit = () => {
    if (format === 'pdf' && period) {
      void run('pdf', t('export.report.shareTitle'), () =>
        exportReportPdf({ period, periodLabel }, ctx),
      );
      return;
    }
    void run('xlsx', t('export.report.shareTitle'), () =>
      exportExcel({ filter, filterLabels, includeNationalId }, ctx),
    );
  };

  return (
    <FormScreen
      onSubmit={submit}
      submitLabel={t(format === 'pdf' ? 'export.report.submitPdf' : 'export.report.submitExcel')}
      isSubmitting={isBusy}
      isSubmitDisabled={!data}
    >
      <Stack.Screen
        options={{
          title: t('export.report.title'),
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

      <PreviewCard title={t('export.period')}>
        <AppText weight="bold" className="text-[17px]">
          {rangeLabel}
        </AppText>
        {data ? (
          <AppText className="text-[13px] text-muted">
            {t('export.report.transactionCount', { count: data.count })}
          </AppText>
        ) : null}
        {filterLabels.length > 0 ? (
          <View className="gap-1 pt-1">
            <AppText weight="semibold" className="text-[13px]">
              {t('export.report.filters')}
            </AppText>
            {filterLabels.map((label) => (
              <AppText key={label} className="text-[13px] leading-[18px] text-muted">
                {label}
              </AppText>
            ))}
          </View>
        ) : null}
      </PreviewCard>

      {isReport && period ? (
        <View className="gap-3">
          <AppText weight="bold" accessibilityRole="header">
            {t('export.report.format')}
          </AppText>
          <SegmentedControl
            accessibilityLabel={t('export.report.format')}
            options={[
              { value: 'pdf', label: t('export.report.formats.pdf') },
              { value: 'excel', label: t('export.report.formats.excel') },
            ]}
            value={format}
            onChange={setFormat}
          />
          <AppText className="text-[13px] leading-[19px] text-muted">
            {t(`export.report.formatHints.${format}`)}
          </AppText>
        </View>
      ) : (
        <AppText className="text-[13px] leading-[19px] text-muted">
          {t('export.report.formatHints.excel')}
        </AppText>
      )}

      {format === 'excel' ? (
        <SwitchRow
          label={t('export.includeIds')}
          hint={t('export.includeIdsHint')}
          value={includeNationalId}
          onChange={setIncludeNationalId}
        />
      ) : null}
    </FormScreen>
  );
}
