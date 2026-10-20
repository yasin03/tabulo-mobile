import { BellOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useColors } from '@/lib/theme';
import { openSystemSettings } from '@/platform/notifications';

import { useNotificationPermissionStatus } from './useNotificationPermission';

/** Bildirim izni reddedildiyse: hatırlatmaların gelmeyeceğini söyler, telefonun Ayarlar'ına yönlendirir (8.6). */
export function PermissionBanner() {
  const { t } = useTranslation();
  const colors = useColors();
  const status = useNotificationPermissionStatus();
  if (status !== 'denied') return null;

  return (
    <View className="flex-row items-center gap-3 rounded-[16px] bg-warning-bg p-[14px]">
      <BellOff size={20} color={colors['warning-fg']} />
      <View className="flex-1 gap-1">
        <AppText weight="bold" className="text-[14px] leading-[19px] text-warning-fg">
          {t('notifications.denied.title')}
        </AppText>
        <AppText className="text-[13px] leading-[18px] text-warning-fg">
          {t('notifications.denied.message')}
        </AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={openSystemSettings}
        hitSlop={8}
        className="min-h-11 justify-center active:opacity-70"
      >
        <AppText weight="extrabold" className="text-[14px] text-warning-fg">
          {t('notifications.denied.openSettings')}
        </AppText>
      </Pressable>
    </View>
  );
}
