import { router, Stack } from 'expo-router';
import { BellRing, CalendarClock, Check, Pencil, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet, type ActionSheetItem } from '@/components/ui/ActionSheet';
import { AppText } from '@/components/ui/AppText';
import { EmptyState } from '@/components/ui/EmptyState';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { SwipeableRow } from '@/components/ui/SwipeableRow';
import { remindersRepo } from '@/db';
import type { ReminderListItem } from '@/db/repositories';
import { useLiveQuery } from '@/db/useLiveQuery';
import { PermissionBanner } from '@/features/notifications/PermissionBanner';
import { ReminderRow } from '@/features/reminders/ReminderRow';
import { useReminderActions } from '@/features/reminders/useReminderActions';
import { haptics } from '@/lib/haptics';
import { useToday } from '@/lib/useToday';

const listPending = () => remindersRepo.listPending();

/** Bekleyen tahsilat hatırlatıcıları (ana sayfadaki zil): zamanı gelenler ve yaklaşanlar. */
export default function RemindersScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const today = useToday();
  const actions = useReminderActions();
  const { data, isRefreshing, refresh } = useLiveQuery(listPending);
  const [selected, setSelected] = useState<ReminderListItem | null>(null);

  const items = data ?? [];
  const due = items.filter((r) => r.remindDate <= today);
  const upcoming = items.filter((r) => r.remindDate > today);

  const menuItems = (item: ReminderListItem): ActionSheetItem[] => [
    {
      key: 'complete',
      label: t('reminders.complete'),
      icon: Check,
      onPress: () => void actions.complete(item),
    },
    { key: 'edit', label: t('common.edit'), icon: Pencil, onPress: () => actions.edit(item) },
    {
      key: 'delete',
      label: t('common.delete'),
      icon: Trash2,
      isDestructive: true,
      onPress: () => void actions.remove(item),
    },
  ];

  const renderGroup = (title: string, rows: ReminderListItem[]) =>
    rows.length === 0 ? null : (
      <View className="gap-2.5">
        <AppText weight="extrabold" accessibilityRole="header" className="text-[17px]">
          {title}
        </AppText>
        <View>
          {rows.map((item, index) => (
            <SwipeableRow
              key={item.id}
              inset={false}
              isFirst={index === 0}
              isLast={index === rows.length - 1}
              onEdit={() => actions.edit(item)}
              onDelete={() => void actions.remove(item)}
            >
              <ReminderRow
                item={item}
                today={today}
                isFirst={index === 0}
                showContact
                menuItems={menuItems(item)}
                onComplete={(r) => void actions.complete(r)}
                onLongPress={(r) => {
                  haptics.selection();
                  setSelected(r);
                }}
              />
            </SwipeableRow>
          ))}
        </View>
      </View>
    );

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: t('reminders.title') }} />
      <ScrollView
        contentContainerClassName="gap-5 px-5 pt-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
      >
        <PermissionBanner />
        {data && items.length === 0 ? (
          <EmptyState
            icon={BellRing}
            title={t('reminders.empty.title')}
            description={t('reminders.empty.description')}
          />
        ) : null}
        {renderGroup(t('reminders.dueSection'), due)}
        {renderGroup(t('reminders.upcomingSection'), upcoming)}
        <SettingsGroup>
          <SettingsRow
            icon={CalendarClock}
            label={t('recurring.title')}
            onPress={() => router.push('/recurring')}
          />
        </SettingsGroup>
      </ScrollView>
      <ActionSheet
        isOpen={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected?.contactName ?? ''}
        items={selected ? menuItems(selected) : []}
      />
    </View>
  );
}
