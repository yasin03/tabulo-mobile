import { FlashList } from '@shopify/flash-list';
import { Stack } from 'expo-router';
import { Chip, useToast } from 'heroui-native';
import {
  ArrowDown,
  ArrowUp,
  CircleCheck,
  CircleMinus,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionSheet, type ActionSheetItem } from '@/components/ui/ActionSheet';
import { AppText } from '@/components/ui/AppText';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { SwipeableRow } from '@/components/ui/SwipeableRow';
import { isDomainError } from '@/core/errors';
import type { Direction } from '@/core/ledger';
import { moveId } from '@/core/order';
import { subjectsRepo, transactionTypesRepo } from '@/db';
import { useLiveQuery } from '@/db/useLiveQuery';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { useColors } from '@/lib/theme';

import { NameDialog } from './NameDialog';

type Definition = { id: string; name: string; isSystem: boolean; status: 'active' | 'passive' };

type DefinitionsScreenProps = { kind: 'transactionTypes' | 'subjects' };

/**
 * İşlem türleri (gelir/gider ayrı) ve işlem konuları (7.11): ekle, yeniden adlandır, sırala, pasife al.
 * Hazır kayıtlar silinemez, yalnızca pasife alınır (5.2).
 */
export function DefinitionsScreen({ kind }: DefinitionsScreenProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [direction, setDirection] = useState<Direction>('income');
  const [selected, setSelected] = useState<Definition | null>(null);
  const [dialog, setDialog] = useState<
    { mode: 'create' } | { mode: 'rename'; item: Definition } | null
  >(null);

  const isTypes = kind === 'transactionTypes';
  const query = useCallback(
    (): Promise<Definition[]> =>
      isTypes
        ? transactionTypesRepo.list({ includePassive: true, direction })
        : subjectsRepo.list({ includePassive: true }),
    [isTypes, direction],
  );
  const { data: items = [] } = useLiveQuery(query);

  const repo = isTypes ? transactionTypesRepo : subjectsRepo;
  const showError = (error: unknown) => {
    haptics.error();
    toast.show({ variant: 'danger', label: errorMessage(t, error) });
  };

  const save = async (name: string) => {
    if (!dialog) return;
    try {
      if (dialog.mode === 'create') {
        if (isTypes) await transactionTypesRepo.create({ name, direction });
        else await subjectsRepo.create({ name });
      } else {
        await repo.rename(dialog.item.id, name);
      }
      haptics.success();
    } catch (error) {
      showError(error);
      throw error;
    }
  };

  const move = async (item: Definition, delta: -1 | 1) => {
    const next = moveId(
      items.map((x) => x.id),
      item.id,
      delta,
    );
    if (!next) return;
    haptics.selection();
    try {
      await repo.reorder(next);
    } catch (error) {
      showError(error);
    }
  };

  const toggleStatus = async (item: Definition) => {
    try {
      await repo.setStatus(item.id, item.status === 'active' ? 'passive' : 'active');
      haptics.success();
    } catch (error) {
      showError(error);
    }
  };

  const remove = async (item: Definition) => {
    try {
      await repo.softDelete(item.id);
      haptics.warning();
      toast.show({
        label: t('definitions.deleted', { name: item.name }),
        actionLabel: t('common.undo'),
        duration: 5000,
        onActionPress: ({ hide }) => {
          void repo.restore(item.id);
          hide();
        },
      });
    } catch (error) {
      if (isDomainError(error, 'systemRecordNotDeletable')) {
        haptics.warning();
        Alert.alert(t('definitions.systemTitle'), t('definitions.systemMessage'), [
          { text: t('common.cancel'), style: 'cancel' },
          ...(item.status === 'active'
            ? [{ text: t('contacts.actions.deactivate'), onPress: () => void toggleStatus(item) }]
            : []),
        ]);
        return;
      }
      showError(error);
    }
  };

  const menuItems = (item: Definition): ActionSheetItem[] => {
    const index = items.findIndex((x) => x.id === item.id);
    return [
      {
        key: 'rename',
        label: t('definitions.rename'),
        icon: Pencil,
        onPress: () => setDialog({ mode: 'rename', item }),
      },
      ...(index > 0
        ? [
            {
              key: 'up',
              label: t('definitions.moveUp'),
              icon: ArrowUp,
              onPress: () => void move(item, -1),
            },
          ]
        : []),
      ...(index < items.length - 1
        ? [
            {
              key: 'down',
              label: t('definitions.moveDown'),
              icon: ArrowDown,
              onPress: () => void move(item, 1),
            },
          ]
        : []),
      {
        key: 'status',
        label: t(
          item.status === 'active' ? 'contacts.actions.deactivate' : 'contacts.actions.activate',
        ),
        icon: item.status === 'active' ? CircleMinus : CircleCheck,
        onPress: () => void toggleStatus(item),
      },
      ...(item.isSystem
        ? []
        : [
            {
              key: 'delete',
              label: t('common.delete'),
              icon: Trash2,
              isDestructive: true,
              onPress: () => void remove(item),
            },
          ]),
    ];
  };

  const title = t(isTypes ? 'settings.transactionTypes' : 'settings.subjects');

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title,
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('definitions.add')}
              onPress={() => setDialog({ mode: 'create' })}
              hitSlop={8}
              className="h-11 w-11 items-center justify-center active:opacity-70"
            >
              <Plus size={24} color={colors.primary} />
            </Pressable>
          ),
        }}
      />

      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        extraData={items.length}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 24 }}
        ListHeaderComponent={
          <View className="gap-3 px-5 pb-3">
            {isTypes ? (
              <SegmentedControl<Direction>
                accessibilityLabel={title}
                value={direction}
                onChange={setDirection}
                options={[
                  { value: 'income', label: t('transactionFilters.income') },
                  { value: 'expense', label: t('transactionFilters.expense') },
                ]}
              />
            ) : null}
            <AppText className="text-[13px] leading-[19px] text-muted">
              {t('definitions.hint')}
            </AppText>
          </View>
        }
        renderItem={({ item, index }) => (
          <SwipeableRow
            isFirst={index === 0}
            isLast={index === items.length - 1}
            onEdit={() => setDialog({ mode: 'rename', item })}
            onDelete={() => void remove(item)}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityHint={t('definitions.rowHint')}
              accessibilityActions={menuItems(item).map((x) => ({ name: x.key, label: x.label }))}
              onAccessibilityAction={(event) =>
                menuItems(item)
                  .find((x) => x.key === event.nativeEvent.actionName)
                  ?.onPress()
              }
              onPress={() => {
                haptics.selection();
                setSelected(item);
              }}
              onLongPress={() => {
                haptics.selection();
                setSelected(item);
              }}
              className={cn(
                'min-h-14 flex-row items-center gap-3 bg-surface px-4 py-3 active:bg-surface-secondary',
                index > 0 && 'border-t border-separator',
              )}
            >
              <AppText
                weight="semibold"
                className={cn('flex-1', item.status === 'passive' && 'text-muted')}
              >
                {item.name}
              </AppText>
              {item.isSystem ? (
                <View>
                  <Chip size="sm" variant="secondary" color="default">
                    <Chip.Label maxFontSizeMultiplier={1.3}>{t('definitions.system')}</Chip.Label>
                  </Chip>
                </View>
              ) : null}
              {item.status === 'passive' ? (
                <View>
                  <Chip size="sm" variant="secondary" color="warning">
                    <Chip.Label maxFontSizeMultiplier={1.3}>{t('contacts.passiveTag')}</Chip.Label>
                  </Chip>
                </View>
              ) : null}
            </Pressable>
          </SwipeableRow>
        )}
      />

      <ActionSheet
        isOpen={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        title={selected?.name ?? ''}
        items={selected ? menuItems(selected) : []}
      />

      <NameDialog
        isOpen={dialog !== null}
        title={
          dialog?.mode === 'rename'
            ? t('definitions.rename')
            : t(
                isTypes
                  ? direction === 'income'
                    ? 'definitions.newIncomeType'
                    : 'definitions.newExpenseType'
                  : 'definitions.newSubject',
              )
        }
        label={t('definitions.name')}
        initialValue={dialog?.mode === 'rename' ? dialog.item.name : ''}
        onClose={() => setDialog(null)}
        onSave={save}
      />
    </View>
  );
}
