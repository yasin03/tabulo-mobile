import { BottomSheet } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import type { MovementType } from '@/core/ledger';
import { MOVEMENT_STYLE } from '@/features/transactions/movementStyle';
import { useColors } from '@/lib/theme';

/** + menüsündeki hareket tipleri (Devir yalnızca cari detayından girilir). */
export const QUICK_MOVEMENT_TYPES = [
  'collection',
  'payment',
  'credit_sale',
  'credit_purchase',
] as const;
export type QuickMovementType = (typeof QUICK_MOVEMENT_TYPES)[number];

/** Cari detayındaki "İşlem ekle": Devir de seçilebilir. */
export const CONTACT_MOVEMENT_TYPES = [...QUICK_MOVEMENT_TYPES, 'opening'] as const;

type AddMovementSheetProps<T extends MovementType> = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: T) => void;
  types?: readonly T[];
};

export function AddMovementSheet<T extends MovementType = QuickMovementType>({
  isOpen,
  onOpenChange,
  onSelect,
  types = QUICK_MOVEMENT_TYPES as readonly MovementType[] as readonly T[],
}: AddMovementSheetProps<T>) {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content>
          <View className="gap-3 px-1" style={{ paddingBottom: insets.bottom + 8 }}>
            <BottomSheet.Title className="font-extrabold text-[18px]">
              {t('movementSheet.title')}
            </BottomSheet.Title>
            <View className="overflow-hidden rounded-[18px] border border-border bg-surface">
              {types.map((type, index) => {
                const { icon: Icon, color } = MOVEMENT_STYLE[type];
                return (
                  <Pressable
                    key={type}
                    onPress={() => onSelect(type)}
                    accessibilityRole="button"
                    accessibilityLabel={t(`movementTypes.${type}`)}
                    accessibilityHint={t(`movementSheet.${type}Hint`)}
                    className={
                      'min-h-16 flex-row items-center gap-3 px-4 py-3 active:bg-surface-secondary' +
                      (index > 0 ? ' border-t border-separator' : '')
                    }
                  >
                    <View className="h-10 w-10 items-center justify-center rounded-xl bg-surface-secondary">
                      <Icon size={20} color={colors[color]} strokeWidth={2} />
                    </View>
                    <View className="flex-1 gap-0.5">
                      <AppText weight="bold">{t(`movementTypes.${type}`)}</AppText>
                      <AppText className="text-[13px] leading-[18px] text-muted">
                        {t(`movementSheet.${type}Hint`)}
                      </AppText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
