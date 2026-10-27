import * as LocalAuthentication from 'expo-local-authentication';
import * as ScreenCapture from 'expo-screen-capture';
import { Platform } from 'react-native';

export type AuthResult = 'success' | 'cancelled' | 'unavailable' | 'failed';

/** Cihazda kilit kurulabilir mi: biyometri ya da en azından cihaz şifresi tanımlı olmalı. */
export async function canUseAppLock(): Promise<boolean> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
}

/** Face ID / Touch ID / parmak izi; olmazsa cihaz şifresi (sistem geri dönüşü açık). */
export async function authenticate(texts: {
  promptMessage: string;
  cancelLabel: string;
}): Promise<AuthResult> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: texts.promptMessage,
      cancelLabel: texts.cancelLabel,
      disableDeviceFallback: false,
    });
    if (result.success) return 'success';
    switch (result.error) {
      case 'user_cancel':
      case 'system_cancel':
      case 'app_cancel':
        return 'cancelled';
      case 'not_enrolled':
      case 'not_available':
      case 'passcode_not_set':
        return 'unavailable';
      default:
        return 'failed';
    }
  } catch {
    return 'failed';
  }
}

/**
 * Son uygulamalar ekranında içerik görünmesin (8.5). iOS: uygulama odağı kaybedince bulanıklık.
 * Android: FLAG_SECURE (önizleme boş görünür; bu sürede ekran görüntüsü de alınamaz).
 */
export async function setAppSwitcherProtection(enabled: boolean): Promise<void> {
  try {
    if (Platform.OS === 'ios') {
      if (enabled) await ScreenCapture.enableAppSwitcherProtectionAsync(0.9);
      else await ScreenCapture.disableAppSwitcherProtectionAsync();
    } else if (Platform.OS === 'android') {
      if (enabled) await ScreenCapture.preventScreenCaptureAsync('app-switcher');
      else await ScreenCapture.allowScreenCaptureAsync('app-switcher');
    }
  } catch {
    // Desteklenmeyen ortam (ör. web, test): sessizce geç.
  }
}
