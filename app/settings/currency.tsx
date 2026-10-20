import { router, Stack } from 'expo-router';
import { Button, Spinner, useToast } from 'heroui-native';
import { Check, RefreshCw, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { FormField } from '@/components/ui/FormField';
import { formatDate } from '@/core/dates';
import {
  convertMinor,
  formatRate,
  formatRateForInput,
  parseRate,
  RATE_SCALE,
  type ExchangeRate,
} from '@/core/exchange';
import { CURRENCIES, formatLocale, formatMoney, type Currency } from '@/core/money';
import { businessProfileRepo } from '@/db';
import { useLiveQuery } from '@/db/useLiveQuery';
import { useMoney } from '@/lib/business';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { useColors } from '@/lib/theme';
import { fetchExchangeRate } from '@/platform/exchangeRates';

/** Kurun gösterim yönü: güçlü para birimi solda (`1 USD = 49,553 TRY`, `1 GBP = 1,33 USD`). */
const STRENGTH: Record<Currency, number> = { GBP: 3, USD: 2, TRY: 1 };
function rateDirection(a: Currency, b: Currency): Pick<ExchangeRate, 'base' | 'quote'> {
  return STRENGTH[a] >= STRENGTH[b] ? { base: a, quote: b } : { base: b, quote: a };
}

/** Örnek tutar: 1.000 birim. */
const SAMPLE_MINOR = 100_000;

const needsConversionQuery = () => businessProfileRepo.needsConversion();

/**
 * Para birimi (7.11). Kayıtlı tutar varsa hepsi değişim gününün TEK kuruyla dönüştürülür
 * (kullanıcı kararı, Faz 4); kur internetten gelir, kullanıcı düzeltebilir.
 */
export default function CurrencyScreen() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currency: current, language } = useMoney();
  const { data: needsConversion } = useLiveQuery(needsConversionQuery);

  const [target, setTarget] = useState<Currency>(current);
  const [rateText, setRateText] = useState('');
  const [rateDate, setRateDate] = useState<string | null>(null);
  const [fetchState, setFetchState] = useState<'idle' | 'loading' | 'failed'>('idle');
  const [isSaving, setSaving] = useState(false);

  const direction = rateDirection(current, target);
  const parsed = parseRate(rateText);
  const rate: ExchangeRate | null = parsed.ok ? { ...direction, micro: parsed.micro } : null;
  const isChanged = target !== current;
  const requiresRate = isChanged && needsConversion === true;

  const loadRate = async (next: Currency) => {
    setFetchState('loading');
    try {
      const fetched = await fetchExchangeRate(current, next);
      // Ekrandaki yön (güçlü para birimi solda) ile aynı olmalı.
      const micro =
        fetched.rate.base === rateDirection(current, next).base
          ? fetched.rate.micro
          : Math.round((RATE_SCALE * RATE_SCALE) / fetched.rate.micro);
      setRateText(formatRateForInput(micro, language));
      setRateDate(fetched.date || null);
      setFetchState('idle');
    } catch {
      setFetchState('failed');
    }
  };

  const select = (next: Currency) => {
    if (next === target) return;
    haptics.selection();
    setTarget(next);
    setRateText('');
    setRateDate(null);
    setFetchState('idle');
    if (next !== current && needsConversion) void loadRate(next);
  };

  const apply = async () => {
    setSaving(true);
    try {
      await businessProfileRepo.changeCurrency(target, requiresRate ? rate : null);
      haptics.success();
      toast.show({ variant: 'success', label: t('currency.changed', { currency: target }) });
      router.back();
    } catch (error) {
      haptics.error();
      toast.show({ variant: 'danger', label: errorMessage(t, error) });
      setSaving(false);
    }
  };

  const confirm = () => {
    if (!requiresRate) {
      void apply();
      return;
    }
    if (!rate) return;
    haptics.warning();
    Alert.alert(
      t('currency.confirmTitle'),
      t('currency.confirmMessage', {
        rate: `1 ${rate.base} = ${formatRate(rate.micro, language, target)} ${rate.quote}`,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('currency.convert'), style: 'destructive', onPress: () => void apply() },
      ],
    );
  };

  const sample =
    rate && requiresRate
      ? `${formatMoney(SAMPLE_MINOR, { currency: current, language })} → ${formatMoney(
          convertMinor(SAMPLE_MINOR, current, rate),
          { currency: target, language },
        )}`
      : null;
  const rateError =
    rateText && !parsed.ok ? t(`currency.rateErrors.${parsed.error}` as const) : undefined;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: t('settings.currency') }} />
      <ScrollView
        contentContainerClassName="gap-4 px-5 pt-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        keyboardShouldPersistTaps="handled"
      >
        <View
          accessibilityRole="radiogroup"
          className="overflow-hidden rounded-[18px] border border-border bg-surface"
        >
          {CURRENCIES.map((code, index) => {
            const selected = code === target;
            return (
              <Pressable
                key={code}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => select(code)}
                className={cn(
                  'min-h-14 flex-row items-center gap-3 px-4 active:bg-surface-secondary',
                  index > 0 && 'border-t border-separator',
                )}
              >
                <View className="flex-1 gap-0.5">
                  <AppText weight={selected ? 'bold' : 'semibold'}>
                    {t(`currency.names.${code}`)}
                  </AppText>
                  <AppText className="text-[12px] leading-[17px] text-muted">
                    {formatMoney(123_456, { currency: code, language })}
                    {code === current ? ` · ${t('currency.current')}` : ''}
                  </AppText>
                </View>
                {selected ? <Check size={20} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>

        {requiresRate ? (
          <View className="gap-3">
            <View className="flex-row gap-3 rounded-[18px] bg-warning-bg p-4">
              <TriangleAlert size={20} color={colors['warning-fg']} />
              <AppText className="flex-1 text-[13px] leading-[19px] text-warning-fg">
                {t('currency.conversionNote')}
              </AppText>
            </View>

            <View className="flex-row items-end gap-2">
              <View className="flex-1">
                <FormField
                  label={t('currency.rateLabel', { base: direction.base, quote: direction.quote })}
                  value={rateText}
                  onChangeText={setRateText}
                  error={rateError}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  placeholder="0"
                  editable={fetchState !== 'loading'}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('currency.refreshRate')}
                disabled={fetchState === 'loading'}
                onPress={() => void loadRate(target)}
                className="mb-0 h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface active:opacity-70"
              >
                {fetchState === 'loading' ? (
                  <Spinner color={colors.primary} />
                ) : (
                  <RefreshCw size={20} color={colors.primary} />
                )}
              </Pressable>
            </View>

            {fetchState === 'failed' ? (
              <AppText className="text-[13px] leading-[19px] text-negative">
                {t('currency.fetchFailed')}
              </AppText>
            ) : rateDate ? (
              <AppText className="text-[12px] leading-[17px] text-muted">
                {t('currency.rateSource', {
                  date: formatDate(rateDate, formatLocale(language, current), 'full'),
                })}
              </AppText>
            ) : null}

            {sample ? (
              <AppText weight="semibold" className="text-[14px]">
                {t('currency.sample', { sample })}
              </AppText>
            ) : null}
          </View>
        ) : isChanged ? (
          <AppText className="text-[13px] leading-[19px] text-muted">
            {t('currency.noDataNote')}
          </AppText>
        ) : null}
      </ScrollView>

      <View
        className="absolute inset-x-0 bottom-0 border-t border-border bg-background px-5 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <Button
          variant="primary"
          size="lg"
          className="h-[52px]"
          isDisabled={
            !isChanged || isSaving || (requiresRate && !rate) || needsConversion === undefined
          }
          onPress={confirm}
        >
          {isSaving ? (
            <Spinner color={colors['accent-foreground']} />
          ) : (
            <Button.Label className="text-[16px]">{t('currency.apply')}</Button.Label>
          )}
        </Button>
      </View>
    </View>
  );
}
