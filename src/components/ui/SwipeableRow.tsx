import { Pencil, Trash2 } from 'lucide-react-native';
import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { AppText } from '@/components/ui/AppText';
import { cn } from '@/lib/cn';
import { useColors } from '@/lib/theme';

const ACTION_WIDTH = 88;

type SwipeableRowProps = {
  /** Kart görünümü için: ilk satır üst köşeleri, son satır alt köşeleri yuvarlar. */
  isFirst: boolean;
  isLast: boolean;
  /** Ekran kenarından 20 px içeride (listeler). Zaten boşluklu bir kapta `false`. */
  inset?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  children: ReactNode;
};

/**
 * Kart içindeki liste satırı (8.3): sağa kaydır → Düzenle, sola kaydır → Sil.
 * Aynı eylemler satırın uzun basma menüsünde ve erişilebilirlik eylemlerinde de bulunmalıdır.
 */
export function SwipeableRow({
  isFirst,
  isLast,
  inset = true,
  onEdit,
  onDelete,
  children,
}: SwipeableRowProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const swipeable = useRef<SwipeableMethods>(null);

  const runAndClose = (action: () => void) => () => {
    swipeable.current?.close();
    action();
  };

  return (
    <View
      className={cn(
        'overflow-hidden border-x border-border bg-surface',
        inset && 'mx-5',
        isFirst && 'rounded-t-[18px] border-t',
        isLast && 'rounded-b-[18px] border-b',
      )}
    >
      <ReanimatedSwipeable
        ref={swipeable}
        friction={2}
        overshootLeft={false}
        overshootRight={false}
        renderLeftActions={() => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.edit')}
            onPress={runAndClose(onEdit)}
            style={{ width: ACTION_WIDTH }}
            className="items-center justify-center gap-1 bg-primary active:opacity-80"
          >
            <Pencil size={20} color={colors['primary-foreground']} />
            <AppText weight="bold" className="text-[12px] text-primary-foreground">
              {t('common.edit')}
            </AppText>
          </Pressable>
        )}
        renderRightActions={() => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.delete')}
            onPress={runAndClose(onDelete)}
            style={{ width: ACTION_WIDTH }}
            className="items-center justify-center gap-1 bg-danger active:opacity-80"
          >
            {/* danger-foreground, primary-foreground ile aynı değerde (global.css). */}
            <Trash2 size={20} color={colors['primary-foreground']} />
            <AppText weight="bold" className="text-[12px] text-danger-foreground">
              {t('common.delete')}
            </AppText>
          </Pressable>
        )}
      >
        {children}
      </ReanimatedSwipeable>
    </View>
  );
}
