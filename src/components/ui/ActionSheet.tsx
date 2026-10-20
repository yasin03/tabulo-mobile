import { BottomSheet } from 'heroui-native';
import { Check, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { cn } from '@/lib/cn';
import { useColors } from '@/lib/theme';

export type ActionSheetItem = {
  key: string;
  label: string;
  icon?: LucideIcon;
  isDestructive?: boolean;
  /** Seçim listelerinde (ör. sıralama) işaretli seçenek. */
  isSelected?: boolean;
  onPress: () => void;
};

type ActionSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: readonly ActionSheetItem[];
};

/** Alttan açılan eylem / seçim listesi (uzun basma menüsü, sıralama). */
export function ActionSheet({ isOpen, onOpenChange, title, items }: ActionSheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content>
          <View className="gap-3 px-1" style={{ paddingBottom: insets.bottom + 8 }}>
            <BottomSheet.Title className="font-extrabold text-[18px]" numberOfLines={2}>
              {title}
            </BottomSheet.Title>
            <View className="overflow-hidden rounded-[18px] border border-border bg-surface">
              {items.map((item, index) => {
                const Icon = item.icon;
                const tint = item.isDestructive ? colors.negative : colors.primary;
                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="button"
                    accessibilityState={
                      item.isSelected === undefined ? undefined : { selected: item.isSelected }
                    }
                    onPress={() => {
                      onOpenChange(false);
                      item.onPress();
                    }}
                    className={cn(
                      'min-h-14 flex-row items-center gap-3 px-4 py-3 active:bg-surface-secondary',
                      index > 0 && 'border-t border-separator',
                    )}
                  >
                    {Icon ? <Icon size={20} color={tint} strokeWidth={2} /> : null}
                    <AppText
                      weight={item.isSelected ? 'bold' : 'semibold'}
                      className={cn('flex-1', item.isDestructive && 'text-negative')}
                    >
                      {item.label}
                    </AppText>
                    {item.isSelected ? <Check size={20} color={colors.primary} /> : null}
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
