import { Button } from 'heroui-native';
import { LockKeyhole } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, BackHandler, Modal, Platform, View } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';

import { LogoMark } from '@/components/brand/Logo';
import { AppText } from '@/components/ui/AppText';
import { shouldLockOnResume } from '@/core/appLock';
import { useColors } from '@/lib/theme';
import { authenticate, setAppSwitcherProtection } from '@/platform/localAuth';
import { usePreferences } from '@/stores/preferences';

/**
 * Uygulama kilidi ve arka plan gizliliği (8.5).
 *
 * - Kilit açıksa açılışta ve arka planda seçilen süreden uzun kalınca Face ID / parmak izi / cihaz şifresi istenir.
 * - Arka plana geçerken ekran hemen örtülür; dönüşte süre dolmadıysa örtü kalkar, dolduysa kilit ekranı kalır.
 *   Böylece kilitli ekrana dönerken bir an bile içerik görünmez.
 * - Örtü iOS'ta ayrı pencerede (modal ekranların da üstünde), Android'de RN Modal olarak çizilir.
 */
export function AppLock() {
  const lockEnabled = usePreferences((s) => s.appLockEnabled);
  const timeout = usePreferences((s) => s.appLockTimeout);
  const privacyScreen = usePreferences((s) => s.privacyScreen);

  const [locked, setLocked] = useState(() => usePreferences.getState().appLockEnabled);
  const [covered, setCovered] = useState(false);
  const backgroundAt = useRef<number | null>(null);

  useEffect(() => {
    void setAppSwitcherProtection(privacyScreen);
  }, [privacyScreen]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (!usePreferences.getState().appLockEnabled) return;
      if (state === 'background') {
        backgroundAt.current = Date.now();
        setCovered(true);
      } else if (state === 'active' && backgroundAt.current !== null) {
        if (shouldLockOnResume(backgroundAt.current, Date.now(), timeout)) setLocked(true);
        backgroundAt.current = null;
        setCovered(false);
      }
    });
    return () => subscription.remove();
  }, [timeout]);

  if (!lockEnabled || (!locked && !covered)) return null;

  return <Overlay>{locked ? <LockScreen onUnlock={() => setLocked(false)} /> : <Cover />}</Overlay>;
}

function Overlay({ children }: { children: ReactNode }) {
  if (Platform.OS === 'ios') {
    return (
      <FullWindowOverlay unstable_accessibilityContainerViewIsModal>
        <View className="absolute inset-0">{children}</View>
      </FullWindowOverlay>
    );
  }
  return (
    <Modal
      visible
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      // Kilitliyken geri tuşu uygulamadan çıkar (ana sayfadaki gibi).
      onRequestClose={() => BackHandler.exitApp()}
    >
      {children}
    </Modal>
  );
}

function Cover() {
  return (
    <View className="flex-1 items-center justify-center bg-background">
      <LogoMark size={72} />
    </View>
  );
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { t } = useTranslation();
  const colors = useColors();
  const [isAuthenticating, setAuthenticating] = useState(false);
  const [failed, setFailed] = useState(false);
  const inProgress = useRef(false);

  const unlock = useCallback(async () => {
    if (inProgress.current) return;
    inProgress.current = true;
    setAuthenticating(true);
    const result = await authenticate({
      promptMessage: t('appLock.prompt'),
      cancelLabel: t('common.cancel'),
    });
    inProgress.current = false;
    setAuthenticating(false);
    if (result === 'success') onUnlock();
    else setFailed(result !== 'cancelled');
  }, [onUnlock, t]);

  // Kilit ekranı açılınca bir kez otomatik sorulur; uygulama ön planda değilse ön plana gelince.
  useEffect(() => {
    if (AppState.currentState === 'active') {
      // Bir kare sonra: önce kilit ekranı çizilsin, sistem penceresi onun üstünde açılsın.
      const timer = setTimeout(() => void unlock(), 0);
      return () => clearTimeout(timer);
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      subscription.remove();
      void unlock();
    });
    return () => subscription.remove();
  }, [unlock]);

  return (
    <View
      accessibilityViewIsModal
      className="flex-1 items-center justify-center gap-4 bg-background px-8"
    >
      <LogoMark size={72} />
      <View className="mt-2 flex-row items-center gap-2">
        <LockKeyhole size={18} color={colors.muted} />
        <AppText
          weight="extrabold"
          accessibilityRole="header"
          className="text-[20px] leading-[28px]"
        >
          {t('appLock.title')}
        </AppText>
      </View>
      <AppText className="text-center text-muted">
        {t(failed ? 'appLock.failed' : 'appLock.description')}
      </AppText>
      <Button
        variant="primary"
        size="lg"
        className="mt-2 h-[52px] min-w-48"
        isDisabled={isAuthenticating}
        onPress={() => void unlock()}
      >
        <Button.Label className="text-[16px]">{t('appLock.unlock')}</Button.Label>
      </Button>
    </View>
  );
}
