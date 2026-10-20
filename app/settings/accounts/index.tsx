import { FlashList } from '@shopify/flash-list';
import { router, Stack } from 'expo-router';
import { Chip } from 'heroui-native';
import {
  ArrowDown,
  ArrowUp,
  CircleCheck,
  CircleMinus,
  Landmark,
  Pencil,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet, type ActionSheetItem } from '@/components/ui/ActionSheet';
import { AppText } from '@/components/ui/AppText';
import { MoneyText } from '@/components/ui/MoneyText';
import { SwipeableRow } from '@/components/ui/SwipeableRow';
import { formatIban } from '@/core/validation';
import { accountsRepo } from '@/db';
import type { AccountWithBalance } from '@/db/repositories';
import { useLiveQuery } from '@/db/useLiveQuery';
import { useAccountActions } from '@/features/settings/useAccountActions';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { useColors } from '@/lib/theme';

const listAccounts = () => accountsRepo.listWithBalances({ includePassive: true });

/** Hesaplar (7.11): Kasa / Banka yönetimi, bakiyeler, sıralama, pasife alma. */
export default function AccountsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: accounts = [] } = useLiveQuery(listAccounts);
  const ids = useMemo(() => accounts.map((a) => a.id), [accounts]);
  const actions = useAccountActions(ids);
  const [selected, setSelected] = useState<AccountWithBalance | null>(null);

  const add = useCallback(() => router.push('/settings/accounts/new'), []);

  const menuItems = (account: AccountWithBalance): ActionSheetItem[] => {
    const index = ids.indexOf(account.id);
    return [
      { key: 'edit', label: t('common.edit'), icon: Pencil, onPress: () => actions.edit(account) },
      ...(index > 0
        ? [
            {
              key: 'up',
              label: t('definitions.moveUp'),
              icon: ArrowUp,
              onPress: () => void actions.move(account, -1),
            },
          ]
        : []),
      ...(index < ids.length - 1
        ? [
            {
              key: 'down',
              label: t('definitions.moveDown'),
              icon: ArrowDown,
              onPress: () => void actions.move(account, 1),
            },
          ]
        : []),
      {
        key: 'status',
        label: t(
          account.status === 'active' ? 'contacts.actions.deactivate' : 'contacts.actions.activate',
        ),
        icon: account.status === 'active' ? CircleMinus : CircleCheck,
        onPress: () => void actions.toggleStatus(account),
      },
      {
        key: 'delete',
        label: t('common.delete'),
        icon: Trash2,
        isDestructive: true,
        onPress: () => void actions.remove(account),
      },
    ];
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: t('settings.accounts'),
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('accounts.add')}
              // Tür formda seçilir; sınır kaydederken de kontrol edilir.
              onPress={add}
              hitSlop={8}
              className="h-11 w-11 items-center justify-center active:opacity-70"
            >
              <Plus size={24} color={colors.primary} />
            </Pressable>
          ),
        }}
      />
      <FlashList
        data={accounts}
        keyExtractor={(item) => item.id}
        extraData={accounts.length}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 24 }}
        ListHeaderComponent={
          <AppText className="px-5 pb-3 text-[13px] leading-[19px] text-muted">
            {t('accounts.hint')}
          </AppText>
        }
        renderItem={({ item, index }) => {
          const Icon = item.type === 'bank' ? Landmark : Wallet;
          const subtitle =
            item.type === 'bank'
              ? [item.bankName, item.iban ? formatIban(item.iban) : null]
                  .filter(Boolean)
                  .join(' · ') || t('accountTypes.bank')
              : t('accountTypes.cash');
          return (
            <SwipeableRow
              isFirst={index === 0}
              isLast={index === accounts.length - 1}
              onEdit={() => actions.edit(item)}
              onDelete={() => void actions.remove(item)}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityHint={t('contacts.actions.hint')}
                accessibilityActions={menuItems(item).map((x) => ({ name: x.key, label: x.label }))}
                onAccessibilityAction={(event) =>
                  menuItems(item)
                    .find((x) => x.key === event.nativeEvent.actionName)
                    ?.onPress()
                }
                onPress={() => actions.edit(item)}
                onLongPress={() => {
                  haptics.selection();
                  setSelected(item);
                }}
                delayLongPress={350}
                className={cn(
                  'min-h-16 flex-row items-center gap-3 bg-surface px-[14px] py-3 active:bg-surface-secondary',
                  index > 0 && 'border-t border-separator',
                )}
              >
                <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface-secondary">
                  <Icon size={20} color={colors.primary} />
                </View>
                <View className="flex-1 gap-0.5">
                  <View className="flex-row flex-wrap items-center gap-x-2">
                    <AppText
                      weight="bold"
                      numberOfLines={1}
                      className={cn('shrink', item.status === 'passive' && 'text-muted')}
                    >
                      {item.name}
                    </AppText>
                    {item.status === 'passive' ? (
                      <Chip size="sm" variant="secondary" color="default">
                        <Chip.Label maxFontSizeMultiplier={1.3}>
                          {t('contacts.passiveTag')}
                        </Chip.Label>
                      </Chip>
                    ) : null}
                  </View>
                  <AppText numberOfLines={1} className="text-[12px] leading-[17px] text-muted">
                    {subtitle}
                  </AppText>
                </View>
                {/* Eksi bakiyede işaret ve kırmızı; artıda işaretsiz (hesap bakiyesi). */}
                <MoneyText
                  minor={item.balanceMinor}
                  signed={item.balanceMinor < 0}
                  className="text-[15px]"
                />
              </Pressable>
            </SwipeableRow>
          );
        }}
      />
      <ActionSheet
        isOpen={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected?.name ?? ''}
        items={selected ? menuItems(selected) : []}
      />
    </View>
  );
}
