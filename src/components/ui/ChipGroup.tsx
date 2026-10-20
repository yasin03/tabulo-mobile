import { Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';

export type ChipOption<T extends string> = { value: T; label: string };

type ChipGroupProps<T extends string> = {
  options: readonly ChipOption<T>[];
  isSelected: (value: T) => boolean;
  onPress: (value: T) => void;
  accessibilityLabel: string;
  /** `scroll`: tek satır yatay kaydırma (liste filtreleri); `wrap`: alt satıra geçer (formlar). */
  layout?: 'scroll' | 'wrap';
  /** Birden fazla seçilebiliyorsa onay kutusu, değilse radyo düğmesi olarak okunur. */
  multiple?: boolean;
};

/** Hap şeklinde seçim düğmeleri: liste filtreleri, hesap ve konu seçimi. */
export function ChipGroup<T extends string>({
  options,
  isSelected,
  onPress,
  accessibilityLabel,
  layout = 'scroll',
  multiple = false,
}: ChipGroupProps<T>) {
  const chips = options.map((option) => {
    const selected = isSelected(option.value);
    return (
      <Pressable
        key={option.value}
        accessibilityRole={multiple ? 'checkbox' : 'radio'}
        accessibilityState={multiple ? { checked: selected } : { selected }}
        onPress={() => {
          if (selected && !multiple) return;
          haptics.selection();
          onPress(option.value);
        }}
        className={cn(
          'min-h-11 justify-center rounded-full border px-4 active:opacity-70',
          selected ? 'border-primary bg-primary' : 'border-border bg-surface',
        )}
      >
        <AppText
          weight={selected ? 'bold' : 'semibold'}
          maxFontSizeMultiplier={1.4}
          numberOfLines={1}
          className={cn('text-[14px]', selected && 'text-primary-foreground')}
        >
          {option.label}
        </AppText>
      </Pressable>
    );
  });

  if (layout === 'wrap') {
    return (
      <View
        accessibilityRole={multiple ? undefined : 'radiogroup'}
        accessibilityLabel={accessibilityLabel}
        className="flex-row flex-wrap gap-2"
      >
        {chips}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole={multiple ? undefined : 'radiogroup'}
      accessibilityLabel={accessibilityLabel}
      className="-mx-5 grow-0"
      contentContainerClassName="gap-2 px-5"
    >
      {chips}
    </ScrollView>
  );
}
