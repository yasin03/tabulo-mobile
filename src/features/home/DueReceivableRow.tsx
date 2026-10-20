import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { MoneyText } from '@/components/ui/MoneyText';
import { daysBetween, toIsoDate } from '@/core/dates';
import type { DueReceivable } from '@/db/repositories';
import { ContactAvatar } from '@/features/contacts/ContactAvatar';
import { cn } from '@/lib/cn';

type DueReceivableRowProps = { item: DueReceivable; isFirst: boolean };

/** Vadesi gelen alacak satırı: cari, "3 gün sonra" / "Bugün" / "5 gün gecikti", açık kalan tutar. */
export function DueReceivableRow({ item, isFirst }: DueReceivableRowProps) {
  const { t } = useTranslation();
  const days = daysBetween(toIsoDate(), item.dueDate);
  const when =
    days === 0
      ? t('home.due.today')
      : days > 0
        ? t('home.due.inDays', { count: days })
        : t('home.due.overdue', { count: -days });

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/contact/[id]', params: { id: item.contactId } })}
      className={cn(
        'min-h-16 flex-row items-center gap-3 px-[14px] py-3 active:bg-surface-secondary',
        !isFirst && 'border-t border-separator',
      )}
    >
      <ContactAvatar name={item.contactName} personType={item.personType} />
      <View className="flex-1 gap-0.5">
        <AppText weight="bold" numberOfLines={1}>
          {item.contactName}
        </AppText>
        <AppText
          weight="semibold"
          className={cn(
            'text-[12px] leading-[17px]',
            days < 0 ? 'text-negative' : days <= 3 ? 'text-warning-fg' : 'text-muted',
          )}
        >
          {when}
        </AppText>
      </View>
      <MoneyText minor={item.remainingMinor} className="text-[15px]" />
    </Pressable>
  );
}
