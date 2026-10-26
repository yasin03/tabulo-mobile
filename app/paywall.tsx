import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Button, Spinner, useToast } from 'heroui-native';
import { BadgeCheck, Crown, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { PRIVACY_POLICY_URL, TERMS_URL } from '@/config/legal';
import { FREE_LIMITS, PREMIUM_FEATURES, type PremiumFeature } from '@/config/plans';
import { PlanCard } from '@/features/premium/PlanCard';
import { PremiumFeatureList } from '@/features/premium/PremiumFeatureList';
import { useRestorePurchases } from '@/features/premium/useRestorePurchases';
import { toIsoDate } from '@/core/dates';
import { useDates } from '@/lib/dates';
import { haptics } from '@/lib/haptics';
import { useIsPremium, useSubscriptionTerm } from '@/lib/premium';
import { useColors } from '@/lib/theme';
import {
  isPurchasesAvailable,
  loadPlans,
  openManageSubscriptions,
  purchasePlan,
  type PlanOption,
} from '@/platform/purchases';
import { usePremiumStore } from '@/stores/premium';

type Plans =
  | { state: 'loading' }
  | { state: 'unavailable' }
  | { state: 'error' }
  | { state: 'ready'; plans: PlanOption[] };

type Busy = 'purchase' | 'restore' | null;

function isFeature(value: string | undefined): value is PremiumFeature {
  return !!value && (PREMIUM_FEATURES as readonly string[]).includes(value);
}

/**
 * Paywall (7.12, 6.8): Premium özellikleri, aylık / yıllık paket (fiyat mağazadan), satın alımları geri
 * yükle, koşullar ve gizlilik. Bir sınırdan açıldıysa (`feature`) üstte nedeni nazikçe söyler.
 */
export default function PaywallScreen() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ feature?: string }>();
  const feature = isFeature(params.feature) ? params.feature : undefined;
  const isPremium = useIsPremium();
  const term = useSubscriptionTerm();
  const dates = useDates();
  const setStatus = usePremiumStore((s) => s.setStatus);
  const restorePurchasesFlow = useRestorePurchases();

  const [plans, setPlans] = useState<Plans>(() =>
    isPurchasesAvailable() ? { state: 'loading' } : { state: 'unavailable' },
  );
  const [selectedId, setSelectedId] = useState<string>();
  const [busy, setBusy] = useState<Busy>(null);
  // Çift dokunuş ikinci bir satın alma başlatmasın.
  const running = useRef(false);

  const fetchPlans = useCallback(() => {
    loadPlans()
      .then((loaded) => {
        setPlans(loaded.length > 0 ? { state: 'ready', plans: loaded } : { state: 'unavailable' });
        setSelectedId((current) => current ?? loaded[0]?.id);
      })
      .catch((error: unknown) => {
        if (__DEV__) console.warn('[paywall]', error);
        setPlans({ state: 'error' });
      });
  }, []);

  useEffect(() => {
    if (!isPremium && isPurchasesAvailable()) fetchPlans();
  }, [isPremium, fetchPlans]);

  const retry = () => {
    setPlans({ state: 'loading' });
    fetchPlans();
  };

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

  const unlocked = () => {
    haptics.success();
    toast.show({ variant: 'success', label: t('premium.unlocked') });
    router.back();
  };

  const purchase = () =>
    run('purchase', async () => {
      if (!selectedId) return;
      try {
        const result = await purchasePlan(selectedId);
        if (result.outcome === 'purchased') {
          setStatus(result.status);
          unlocked();
        } else if (result.outcome === 'pending') {
          Alert.alert(t('premium.pendingTitle'), t('premium.pendingMessage'));
        }
      } catch (error) {
        if (__DEV__) console.warn('[purchase]', error);
        haptics.error();
        toast.show({ variant: 'danger', label: t('premium.purchaseFailed') });
      }
    });

  const restore = () =>
    run('restore', async () => {
      if (await restorePurchasesFlow()) router.back();
    });

  const reason = feature
    ? feature === 'unlimitedContacts'
      ? t('premium.reason.unlimitedContacts', { count: FREE_LIMITS.activeContacts })
      : t(`premium.reason.${feature}`)
    : null;

  const selected = plans.state === 'ready' ? plans.plans.find((p) => p.id === selectedId) : null;
  const canBuy = !!selected && busy === null;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: t('premium.title'),
          gestureEnabled: !busy,
          headerLeft: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={() => router.back()}
              disabled={!!busy}
              hitSlop={8}
              className="h-11 w-11 items-center justify-center active:opacity-70"
            >
              <X size={24} color={colors.primary} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentContainerClassName="gap-5 px-5 pt-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <View className="items-center gap-3 rounded-[22px] bg-summary px-5 py-6">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-summary-tile">
            <Crown size={28} color={colors.accent} strokeWidth={2.2} />
          </View>
          <AppText
            weight="extrabold"
            accessibilityRole="header"
            className="text-center text-[22px] leading-[30px] text-summary-foreground"
          >
            {isPremium ? t('premium.activeTitle') : t('premium.headline')}
          </AppText>
          <AppText className="text-center text-[14px] leading-[20px] text-summary-muted">
            {isPremium ? t('premium.activeDescription') : (reason ?? t('premium.subheadline'))}
          </AppText>
        </View>

        {isPremium ? (
          <View className="gap-3">
            <View className="flex-row items-center gap-3 rounded-[18px] border border-border bg-surface p-4">
              <BadgeCheck
                size={22}
                color={term?.kind === 'ends' ? colors['warning-fg'] : colors.positive}
              />
              <View className="flex-1 gap-0.5">
                <AppText weight="semibold" className="text-[15px]">
                  {t(term?.kind === 'ends' ? 'premium.cancelledBadge' : 'premium.activeBadge')}
                </AppText>
                {term ? (
                  <AppText
                    className={
                      term.kind === 'ends'
                        ? 'text-[13px] leading-[19px] text-warning-fg'
                        : 'text-[13px] leading-[19px] text-muted'
                    }
                  >
                    {t(term.kind === 'ends' ? 'premium.endsOn' : 'premium.renewsOn', {
                      date: dates.format(toIsoDate(new Date(term.at)), 'full'),
                    })}
                  </AppText>
                ) : null}
              </View>
            </View>
            <Button
              variant="secondary"
              size="lg"
              className="h-[52px]"
              onPress={() =>
                void openManageSubscriptions().catch(() =>
                  toast.show({ variant: 'danger', label: t('premium.manageFailed') }),
                )
              }
            >
              <Button.Label className="text-[16px]">{t('premium.manage')}</Button.Label>
            </Button>
          </View>
        ) : null}

        <PremiumFeatureList highlight={feature} />

        {!isPremium ? (
          <View className="gap-3">
            {plans.state === 'loading' ? (
              <View className="items-center py-6">
                <Spinner color={colors.primary} />
              </View>
            ) : null}

            {plans.state === 'unavailable' || plans.state === 'error' ? (
              <View className="gap-3 rounded-[18px] border border-border bg-surface p-4">
                <AppText className="text-[14px] leading-[20px] text-muted">
                  {t(plans.state === 'error' ? 'premium.loadFailed' : 'premium.unavailable')}
                </AppText>
                {plans.state === 'error' ? (
                  <Button variant="secondary" onPress={retry}>
                    <Button.Label>{t('common.retry')}</Button.Label>
                  </Button>
                ) : null}
              </View>
            ) : null}

            {plans.state === 'ready' ? (
              <View accessibilityRole="radiogroup" className="gap-3">
                {plans.plans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    isSelected={plan.id === selectedId}
                    onPress={() => {
                      haptics.selection();
                      setSelectedId(plan.id);
                    }}
                  />
                ))}
              </View>
            ) : null}

            <Button
              variant="primary"
              size="lg"
              className="h-[52px]"
              isDisabled={!canBuy}
              onPress={() => void purchase()}
            >
              {busy === 'purchase' ? (
                <Spinner color={colors['accent-foreground']} />
              ) : (
                <Button.Label className="text-[16px]">
                  {selected?.freeTrialPeriod ? t('premium.startTrial') : t('premium.subscribe')}
                </Button.Label>
              )}
            </Button>

            {selected ? (
              <AppText className="text-center text-[12px] leading-[17px] text-muted">
                {t(selected.period === 'annual' ? 'premium.renewAnnual' : 'premium.renewMonthly', {
                  price: selected.price,
                })}
              </AppText>
            ) : null}
          </View>
        ) : null}

        {isPurchasesAvailable() ? (
          <Button
            variant="ghost"
            isDisabled={busy !== null}
            onPress={() => void restore()}
            className="self-center"
          >
            {busy === 'restore' ? (
              <Spinner color={colors.primary} />
            ) : (
              <Button.Label className="text-primary">{t('premium.restore')}</Button.Label>
            )}
          </Button>
        ) : null}

        <View className="flex-row flex-wrap justify-center gap-x-5 gap-y-2">
          <LegalLink label={t('premium.terms')} url={TERMS_URL} />
          {PRIVACY_POLICY_URL ? (
            <LegalLink label={t('premium.privacy')} url={PRIVACY_POLICY_URL} />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function LegalLink({ label, url }: { label: string; url: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => void Linking.openURL(url)}
      hitSlop={8}
      className="min-h-11 justify-center active:opacity-60"
    >
      <AppText weight="semibold" className="text-[13px] text-muted underline">
        {label}
      </AppText>
    </Pressable>
  );
}
