import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { cn } from '@/lib/cn';

type Option<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      className="flex-row gap-1 rounded-[14px] border border-border bg-surface p-1"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              void Haptics.selectionAsync();
              onChange(option.value);
            }}
            className={cn(
              'min-h-11 flex-1 items-center justify-center rounded-[10px] px-2 active:opacity-70',
              selected && 'bg-primary',
            )}
          >
            <AppText
              weight={selected ? 'bold' : 'semibold'}
              maxFontSizeMultiplier={1.6}
              className={cn('text-center text-[14px]', selected && 'text-primary-foreground')}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
