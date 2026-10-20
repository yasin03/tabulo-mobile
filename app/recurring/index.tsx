import { router, Stack } from 'expo-router';
import { Button } from 'heroui-native';
import {
  CalendarClock,
  CircleCheck,
  CircleMinus,
  CirclePlay,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet, type ActionSheetItem } from '@/components/ui/ActionSheet';
import { AppText } from '@/components/ui/AppText';
import { EmptyState } from '@/components/ui/EmptyState';
import { SwipeableRow } from '@/components/ui/SwipeableRow';
import { recurringPaymentsRepo } from '@/db';
import type { RecurringPaymentListItem } from '@/db/repositories';
import { useLiveQuery } from '@/db/useLiveQuery';
import { PermissionBanner } from '@/features/notifications/PermissionBanner';
import { RecurringRow } from '@/features/recurring/RecurringRow';
import { useRecurringActions } from '@/features/recurring/useRecurringActions';
import { haptics } from '@/lib/haptics';
import { useColors } from '@/lib/theme';
import { useToday } from '@/lib/useToday';

const listAll = () => recurringPaymentsRepo.list();

/** Düzenli ödemeler (7.10, 6.5): aktifler sonraki tarihe göre, altta pasif / tamamlananlar. */
export default function RecurringListScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const today = useToday();
  const actions = useRecurringActions();
  const { data, isRefreshing, refresh } = useLiveQuery(listAll);
  const [selected, setSelected] = useState<RecurringPaymentListItem | null>(null);

  const add = useCallback(() => router.push('/recurring/new'), []);
  const items = data ?? [];
  const active = items.filter((r) => r.status === 'active');
  const inactive = items.filter((r) => r.status !== 'active');

  const menuItems = (item: RecurringPaymentListItem): ActionSheetItem[] => [
    ...(item.status === 'active'
      ? [
          {
            key: 'pay',
            label: t(`recurring.pay.${item.movementType}`),
            icon: CircleCheck,
            onPress: () => actions.pay(item),
          },
        ]
      : []),
    { key: 'edit', label: t('common.edit'), icon: Pencil, onPress: () => actions.edit(item) },
    ...(item.isFinished
      ? []
      : [
          {
            key: 'status',
            label: t(
              item.status === 'active'
                ? 'contacts.actions.deactivate'
                : 'contacts.actions.activate',
            ),
            icon: item.status === 'active' ? CircleMinus : CirclePlay,
            onPress: () => void actions.toggleStatus(item),
          },
        ]),
    {
      key: 'delete',
      label: t('common.delete'),
      icon: Trash2,
      isDestructive: true,
      onPress: () => void actions.remove(item),
    },
  ];

  const openMenu = (item: RecurringPaymentListItem) => {
    haptics.selection();
    setSelected(item);
  };

  const renderGroup = (rows: RecurringPaymentListItem[]) => (
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
          <RecurringRow
            item={item}
            today={today}
            isFirst={index === 0}
            showDetails
            menuItems={menuItems(item)}
            onPress={actions.edit}
            onLongPress={openMenu}
            onPay={actions.pay}
          />
        </SwipeableRow>
      ))}
    </View>
  );

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: t('recurring.title'),
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('recurring.add')}
              onPress={add}
              hitSlop={8}
              className="h-11 w-11 items-center justify-center active:opacity-70"
            >
              <Plus size={24} color={colors.primary} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        contentContainerClassName="gap-4 px-5 pt-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refresh} />}
      >
        <PermissionBanner />
        {data && items.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title={t('recurring.empty.title')}
            description={t('recurring.empty.description')}
            action={
              <Button variant="primary" className="mt-2 min-h-12" onPress={add}>
                <Plus size={18} color={colors['accent-foreground']} strokeWidth={2.4} />
                <Button.Label>{t('recurring.add')}</Button.Label>
              </Button>
            }
          />
        ) : null}
        {active.length > 0 ? renderGroup(active) : null}
        {inactive.length > 0 ? (
          <View className="gap-2.5">
            <AppText weight="extrabold" accessibilityRole="header" className="text-[17px]">
              {t('recurring.inactiveSection')}
            </AppText>
            {renderGroup(inactive)}
          </View>
        ) : null}
        {items.length > 0 ? (
          <AppText className="text-[13px] leading-[19px] text-muted">{t('recurring.hint')}</AppText>
        ) : null}
      </ScrollView>
      <ActionSheet
        isOpen={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected?.title ?? ''}
        items={selected ? menuItems(selected) : []}
      />
    </View>
  );
}
