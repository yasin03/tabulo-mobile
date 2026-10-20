import { router } from 'expo-router';
import { Bell, Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import type { ActionSheetItem } from '@/components/ui/ActionSheet';
import { AppText } from '@/components/ui/AppText';
import { formatTimeOfDay } from '@/core/dates';
import type { ReminderListItem } from '@/db/repositories';
import { ContactAvatar } from '@/features/contacts/ContactAvatar';
import { cn } from '@/lib/cn';
import { useDates } from '@/lib/dates';
import { useColors } from '@/lib/theme';

type ReminderRowProps = {
  item: ReminderListItem;
  today: string;
  isFirst: boolean;
  /** Hatırlatıcılar ekranında cari adı ve avatar; cari detayında gizli. */
  showContact: boolean;
  onComplete: (item: ReminderListItem) => void;
  onLongPress?: (item: ReminderListItem) => void;
  menuItems?: readonly ActionSheetItem[];
};

/** Tahsilat hatırlatıcısı satırı: zaman (geçtiyse kırmızı), not, "Tamam" düğmesi. */
export function ReminderRow({
  item,
  today,
  isFirst,
  showContact,
  onComplete,
  onLongPress,
  menuItems,
}: ReminderRowProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const dates = useDates();
  const isDue = item.remindDate <= today;
  const when = `${dates.day(item.remindDate)}, ${formatTimeOfDay(item.remindTime, dates.locale)}`;

  const open = () =>
    showContact
      ? router.push({ pathname: '/contact/[id]', params: { id: item.contactId } })
      : router.push({ pathname: '/reminders/[id]', params: { id: item.id } });

  return (
    <View
      className={cn(
        'min-h-16 flex-row items-center gap-3 bg-surface py-3 pl-[14px] pr-2',
        !isFirst && 'border-t border-separator',
      )}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityHint={menuItems ? t('contacts.actions.hint') : undefined}
        accessibilityActions={menuItems?.map((x) => ({ name: x.key, label: x.label }))}
        onAccessibilityAction={(event) =>
          menuItems?.find((x) => x.key === event.nativeEvent.actionName)?.onPress()
        }
        onPress={open}
        onLongPress={onLongPress ? () => onLongPress(item) : undefined}
        delayLongPress={350}
        className="flex-1 flex-row items-center gap-3 active:opacity-70"
      >
        {showContact ? (
          <ContactAvatar name={item.contactName} personType={item.personType} />
        ) : (
          <View className="h-10 w-10 items-center justify-center rounded-xl bg-warning-bg">
            <Bell size={20} color={colors['warning-fg']} />
          </View>
        )}
        <View className="flex-1 gap-0.5">
          {showContact ? (
            <AppText weight="bold" numberOfLines={1}>
              {item.contactName}
            </AppText>
          ) : null}
          <AppText
            weight={showContact ? 'semibold' : 'bold'}
            className={cn(
              showContact && 'text-[12px] leading-[17px]',
              isDue ? 'text-negative' : showContact && 'text-warning-fg',
            )}
          >
            {when}
          </AppText>
          {item.note ? (
            <AppText numberOfLines={2} className="text-[12px] leading-[17px] text-muted">
              {item.note}
            </AppText>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('reminders.complete')}: ${when}`}
        onPress={() => onComplete(item)}
        className="h-11 min-w-11 flex-row items-center justify-center gap-1 rounded-full px-2 active:bg-surface-secondary"
      >
        <Check size={18} color={colors.positive} strokeWidth={2.6} />
        <AppText weight="bold" maxFontSizeMultiplier={1.3} className="text-[13px] text-positive">
          {t('reminders.complete')}
        </AppText>
      </Pressable>
    </View>
  );
}
