import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { QUICK_MOVEMENT_TYPES } from '@/components/navigation/AddMovementSheet';
import type { MovementType } from '@/core/ledger';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { useColors } from '@/lib/theme';

import { MOVEMENT_STYLE } from './movementStyle';

type MovementTypeGridProps = {
  value: MovementType;
  onChange: (type: MovementType) => void;
};

/**
 * Hareket tipi seçimi (6.4): 2 × 2 büyük düğme. Devir yalnızca devir hareketinde görünür ve değiştirilemez
 * (devir carinin açılış bakiyesidir; tahsilat/ödemeye dönüştürülmez).
 */
export function MovementTypeGrid({ value, onChange }: MovementTypeGridProps) {
  const { t } = useTranslation();
  const colors = useColors();

  if (value === 'opening') {
    const { icon: Icon } = MOVEMENT_STYLE.opening;
    return (
      <View className="min-h-12 flex-row items-center gap-3 rounded-[14px] border border-border bg-surface px-4">
        <Icon size={20} color={colors.primary} />
        <AppText weight="bold">{t('movementTypes.opening')}</AppText>
      </View>
    );
  }

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('transactionForm.movementType')}
      className="flex-row flex-wrap gap-2"
    >
      {QUICK_MOVEMENT_TYPES.map((type) => {
        const selected = type === value;
        const { icon: Icon, color } = MOVEMENT_STYLE[type];
        return (
          <Pressable
            key={type}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              haptics.selection();
              onChange(type);
            }}
            style={{ flexBasis: '48%' }}
            className={cn(
              'min-h-12 grow flex-row items-center gap-2 rounded-[14px] border px-3 py-2 active:opacity-70',
              selected ? 'border-primary bg-primary' : 'border-border bg-surface',
            )}
          >
            <Icon
              size={18}
              color={selected ? colors['primary-foreground'] : colors[color]}
              strokeWidth={2.2}
            />
            <AppText
              weight={selected ? 'bold' : 'semibold'}
              maxFontSizeMultiplier={1.5}
              className={cn('shrink text-[14px]', selected && 'text-primary-foreground')}
            >
              {t(`movementTypes.${type}`)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
