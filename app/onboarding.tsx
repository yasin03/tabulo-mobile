import { router } from 'expo-router';
import { Button, useToast } from 'heroui-native';
import { BellRing, Check, Landmark, Users, type LucideIcon } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Logo } from '@/components/brand/Logo';
import { AppText } from '@/components/ui/AppText';
import { FormField } from '@/components/ui/FormField';
import { FormScreen } from '@/components/ui/FormScreen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import type { Language } from '@/core/i18n';
import { CURRENCIES, CURRENCY_SYMBOLS, type Currency } from '@/core/money';
import { businessProfileRepo } from '@/db';
import { useMoney } from '@/lib/business';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { resolveLanguage } from '@/lib/i18n';
import { useColors } from '@/lib/theme';
import { usePreferences } from '@/stores/preferences';

const SLIDES: { icon: LucideIcon; key: 'contacts' | 'accounts' | 'reminders' }[] = [
  { icon: Users, key: 'contacts' },
  { icon: Landmark, key: 'accounts' },
  { icon: BellRing, key: 'reminders' },
];

/** İlk açılış (7.1): 3 tanıtım ekranı, sonra dil, para birimi ve isteğe bağlı işletme adı. */
export default function OnboardingScreen() {
  const [step, setStep] = useState<'intro' | 'setup'>('intro');
  return step === 'intro' ? (
    <Intro onDone={() => setStep('setup')} />
  ) : (
    <Setup onBack={() => setStep('intro')} />
  );
}

function Intro({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scroller = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  const next = () => {
    if (isLast) return onDone();
    scroller.current?.scrollTo({ x: (index + 1) * width, animated: true });
    setIndex(index + 1);
  };

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }}
    >
      <View className="flex-row items-center justify-between px-5 py-2">
        <Logo size={28} />
        <Pressable
          accessibilityRole="button"
          onPress={onDone}
          hitSlop={8}
          className="min-h-11 justify-center px-2 active:opacity-60"
        >
          <AppText weight="bold" className="text-primary">
            {t('onboarding.skip')}
          </AppText>
        </Pressable>
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        className="flex-1"
      >
        {SLIDES.map(({ icon: Icon, key }, i) => (
          <View
            key={key}
            style={{ width }}
            className="flex-1 items-center justify-center gap-5 px-8"
            accessibilityElementsHidden={i !== index}
            importantForAccessibility={i === index ? 'auto' : 'no-hide-descendants'}
          >
            <View className="h-28 w-28 items-center justify-center rounded-[28px] bg-surface-secondary">
              <Icon size={52} color={colors.primary} strokeWidth={1.75} />
            </View>
            <AppText
              weight="extrabold"
              accessibilityRole="header"
              className="text-center text-[26px] leading-[34px]"
            >
              {t(`onboarding.slides.${key}.title`)}
            </AppText>
            <AppText className="text-center text-[16px] leading-[24px] text-muted">
              {t(`onboarding.slides.${key}.body`)}
            </AppText>
          </View>
        ))}
      </ScrollView>

      <View
        className="flex-row justify-center gap-2 py-5"
        accessible
        accessibilityLabel={t('onboarding.page', { current: index + 1, total: SLIDES.length })}
      >
        {SLIDES.map(({ key }, i) => (
          <View
            key={key}
            className={cn('h-2 rounded-full', i === index ? 'w-6 bg-accent' : 'w-2 bg-border')}
          />
        ))}
      </View>

      <View className="px-5">
        <Button variant="primary" size="lg" className="h-[52px]" onPress={next}>
          <Button.Label className="text-[16px]">
            {isLast ? t('onboarding.getStarted') : t('onboarding.next')}
          </Button.Label>
        </Button>
      </View>
    </View>
  );
}

function Setup({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currency: savedCurrency } = useMoney();
  const language = usePreferences((s) => s.language) ?? resolveLanguage();
  const setLanguage = usePreferences((s) => s.setLanguage);
  const completeOnboarding = usePreferences((s) => s.completeOnboarding);
  const [currency, setCurrency] = useState<Currency>(savedCurrency);
  const [name, setName] = useState('');
  const [isSaving, setSaving] = useState(false);

  const save = async () => {
    // Henüz tutarlı kayıt yok: para birimi kur gerektirmeden değişir.
    if (currency !== savedCurrency) await businessProfileRepo.changeCurrency(currency, null);
    if (name.trim()) await businessProfileRepo.update({ name: name.trim() });
    // Dil seçilmediyse cihaz dili; açıkça kaydedilir ki sonradan cihaz dili değişince uygulama dili kaymasın.
    setLanguage(language);
    completeOnboarding();
  };

  const finish = async (then?: () => void) => {
    if (isSaving) return;
    setSaving(true);
    try {
      await save();
      haptics.success();
      router.replace('/');
      then?.();
    } catch (error) {
      haptics.error();
      toast.show({ variant: 'danger', label: errorMessage(t, error) });
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-3 py-2">
        <Pressable
          accessibilityRole="button"
          onPress={onBack}
          hitSlop={8}
          className="min-h-11 justify-center px-2 active:opacity-60"
        >
          <AppText weight="bold" className="text-primary">
            {t('common.back')}
          </AppText>
        </Pressable>
      </View>
      <FormScreen
        onSubmit={() => void finish()}
        submitLabel={t('onboarding.start')}
        isSubmitting={isSaving}
      >
        <View className="gap-1">
          <AppText
            weight="extrabold"
            accessibilityRole="header"
            className="text-[24px] leading-[32px]"
          >
            {t('onboarding.setup.title')}
          </AppText>
          <AppText className="text-muted">{t('onboarding.setup.description')}</AppText>
        </View>

        <View className="gap-2">
          <AppText weight="semibold" className="text-[13px] text-muted">
            {t('settings.language')}
          </AppText>
          <SegmentedControl<Language>
            accessibilityLabel={t('settings.language')}
            value={language}
            onChange={setLanguage}
            options={[
              { value: 'tr', label: t('settings.languageTr') },
              { value: 'en', label: t('settings.languageEn') },
            ]}
          />
        </View>

        <View className="gap-2">
          <AppText weight="semibold" className="text-[13px] text-muted">
            {t('settings.currency')}
          </AppText>
          <View
            accessibilityRole="radiogroup"
            className="overflow-hidden rounded-[18px] border border-border bg-surface"
          >
            {CURRENCIES.map((code, i) => {
              const selected = code === currency;
              return (
                <Pressable
                  key={code}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setCurrency(code)}
                  className={cn(
                    'min-h-14 flex-row items-center gap-3 px-4 py-3 active:bg-surface-secondary',
                    i > 0 && 'border-t border-separator',
                  )}
                >
                  <View className="h-9 w-9 items-center justify-center rounded-xl bg-surface-secondary">
                    <AppText weight="extrabold" className="text-primary">
                      {CURRENCY_SYMBOLS[code]}
                    </AppText>
                  </View>
                  <AppText weight="semibold" className="flex-1">
                    {t(`currency.names.${code}`)}
                  </AppText>
                  {selected ? <Check size={20} color={colors.accent} strokeWidth={2.5} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="gap-1.5">
          <FormField
            label={t('onboarding.setup.businessName')}
            placeholder={t('onboarding.setup.businessNamePlaceholder')}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="organization"
            textContentType="organizationName"
            returnKeyType="done"
            onSubmitEditing={() => void finish()}
            maxLength={120}
          />
          <AppText className="text-[13px] leading-[19px] text-muted">
            {t('onboarding.setup.businessNameHint')}
          </AppText>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => void finish(() => router.push('/settings/backup'))}
          className="min-h-11 items-center justify-center active:opacity-60"
        >
          <AppText weight="bold" className="text-primary">
            {t('onboarding.restore')}
          </AppText>
        </Pressable>
      </FormScreen>
    </View>
  );
}
