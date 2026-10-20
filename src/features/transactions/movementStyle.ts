import {
  ArrowDown,
  ArrowUp,
  HandCoins,
  History,
  ShoppingCart,
  type LucideIcon,
} from 'lucide-react-native';

import type { MovementType } from '@/core/ledger';
import type { ColorToken } from '@/core/theme/tokens';

/** Hareket tipinin simgesi ve rengi (+ menüsü, listeler, detay). */
export const MOVEMENT_STYLE: Record<MovementType, { icon: LucideIcon; color: ColorToken }> = {
  collection: { icon: ArrowUp, color: 'positive' },
  payment: { icon: ArrowDown, color: 'negative' },
  credit_sale: { icon: HandCoins, color: 'primary' },
  credit_purchase: { icon: ShoppingCart, color: 'primary' },
  opening: { icon: History, color: 'primary' },
};
