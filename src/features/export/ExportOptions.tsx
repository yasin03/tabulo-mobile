import { Switch } from 'heroui-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { ChipGroup } from '@/components/ui/ChipGroup';
import { DateField } from '@/components/ui/DateField';
import { PERIODS, type Period } from '@/features/transactions/filters';
import { cn } from '@/lib/cn';

type SwitchRowProps = {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

/** Açıklamalı aç/kapa satırı ("Kimlik numaralarını dahil et", 6.3). */
export function SwitchRow({ label, hint, value, onChange }: SwitchRowProps) {
  return (
    <View className="flex-row items-center gap-3 rounded-[18px] border border-border bg-surface px-4 py-3">
      <View className="flex-1 gap-0.5">
        <AppText weight="bold">{label}</AppText>
        {hint ? <AppText className="text-[13px] leading-[18px] text-muted">{hint}</AppText> : null}
      </View>
      <Switch accessibilityLabel={label} isSelected={value} onSelectedChange={onChange} />
    </View>
  );
}

export interface PeriodValue {
  period: Period;
  /** Yalnızca `custom`'da. */
  from: string;
  to: string;
}

/** Ekstre dönemi: Tümü / Bu ay / Geçen ay / Bu yıl / Özel (özelde başlangıç ve bitiş). */
export function PeriodChoice({
  value,
  onChange,
}: {
  value: PeriodValue;
  onChange: (value: PeriodValue) => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="gap-3">
      <AppText weight="bold" accessibilityRole="header">
        {t('export.period')}
      </AppText>
      <ChipGroup
        layout="wrap"
        accessibilityLabel={t('export.period')}
        options={PERIODS.map((period) => ({ value: period, label: t(`export.periods.${period}`) }))}
        isSelected={(period) => period === value.period}
        onPress={(period) => onChange({ ...value, period })}
      />
      {value.period === 'custom' ? (
        <>
          <DateField
            label={t('export.from')}
            value={value.from}
            onChange={(from) => onChange({ ...value, from })}
            isClearable
          />
          <DateField
            label={t('export.to')}
            value={value.to}
            onChange={(to) => onChange({ ...value, to })}
            isClearable
          />
        </>
      ) : null}
    </View>
  );
}

/** Önizleme kutusu: etiket–değer satırları. */
export function PreviewCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-2 rounded-[18px] border border-border bg-surface p-4">
      <AppText weight="extrabold" accessibilityRole="header" className="text-[15px]">
        {title}
      </AppText>
      {children}
    </View>
  );
}

export function PreviewRow({
  label,
  value,
  tone,
  isStrong,
}: {
  label: string;
  value: string;
  tone?: 'positive' | 'negative' | 'neutral';
  isStrong?: boolean;
}) {
  return (
    <View className="flex-row flex-wrap items-baseline justify-between gap-x-3">
      <AppText className="text-[14px] text-muted">{label}</AppText>
      <AppText
        weight={isStrong ? 'extrabold' : 'semibold'}
        className={cn(
          isStrong ? 'text-[17px]' : 'text-[14px]',
          tone === 'positive' && 'text-positive',
          tone === 'negative' && 'text-negative',
        )}
      >
        {value}
      </AppText>
    </View>
  );
}
