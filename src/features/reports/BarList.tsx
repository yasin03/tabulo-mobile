import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import type { ColorToken } from '@/core/theme/tokens';
import { cn } from '@/lib/cn';
import { useColors } from '@/lib/theme';

export type BarListItem = {
  key: string;
  label: string;
  /** Biçimlenmiş tutar (işaretli veya işaretsiz). */
  amount: string;
  /** Çubuk uzunluğu, 0–1. */
  ratio: number;
  /** Tutarın altında küçük not (ör. `%45`). */
  detail?: string;
  tone?: Extract<ColorToken, 'primary' | 'positive' | 'negative'>;
  accessibilityLabel?: string;
  /** Verilmezse satır dokunulamaz (ör. "Tür seçilmemiş"). */
  onPress?: () => void;
};

type BarListProps = {
  title: string;
  subtitle?: string;
  items: readonly BarListItem[];
  emptyText: string;
  /** Bu kadarından fazlası "Tümünü göster" ile açılır. */
  initialCount?: number;
};

const TONE_TEXT = {
  primary: 'text-foreground',
  positive: 'text-positive',
  negative: 'text-negative',
};

/**
 * Yatay çubuklu dağılım listesi: işlem türüne / konuya göre gider, hesap bakiyeleri (7.9).
 * Uzun adlar alt satıra kayar, büyük yazıda bozulmaz; satıra dokununca ilgili hareketler açılır.
 */
export function BarList({ title, subtitle, items, emptyText, initialCount = 6 }: BarListProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, initialCount);
  const hidden = items.length - visible.length;

  return (
    <View className="gap-2.5">
      <View className="min-h-11 justify-center">
        <AppText
          weight="extrabold"
          accessibilityRole="header"
          className="text-[17px] leading-[24px]"
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText className="text-[13px] leading-[18px] text-muted">{subtitle}</AppText>
        ) : null}
      </View>

      <View className="overflow-hidden rounded-[18px] border border-border bg-surface">
        {items.length === 0 ? (
          <AppText className="px-4 py-5 text-center text-[14px] text-muted">{emptyText}</AppText>
        ) : null}
        {visible.map((item, index) => {
          const tone = item.tone ?? 'primary';
          return (
            <Pressable
              key={item.key}
              accessibilityRole={item.onPress ? 'button' : undefined}
              accessibilityLabel={item.accessibilityLabel}
              disabled={!item.onPress}
              onPress={item.onPress}
              className={cn(
                'min-h-14 gap-2 px-4 py-3 active:bg-surface-secondary',
                index > 0 && 'border-t border-separator',
              )}
            >
              <View className="flex-row items-center gap-3">
                <AppText weight="semibold" className="flex-1 text-[15px] leading-[21px]">
                  {item.label}
                </AppText>
                <View className="items-end">
                  <AppText
                    weight="extrabold"
                    className={cn('text-[15px] leading-[21px]', TONE_TEXT[tone])}
                  >
                    {item.amount}
                  </AppText>
                  {item.detail ? (
                    <AppText className="text-[12px] leading-[16px] text-muted">
                      {item.detail}
                    </AppText>
                  ) : null}
                </View>
                {item.onPress ? (
                  <ChevronRight size={18} color={colors.muted} strokeWidth={2} />
                ) : (
                  <View className="w-[18px]" />
                )}
              </View>
              <View className="h-2 overflow-hidden rounded-full bg-separator">
                <View
                  className="h-2 rounded-full"
                  style={{
                    width: `${Math.max(item.ratio * 100, item.ratio > 0 ? 2 : 0)}%`,
                    backgroundColor: colors[tone],
                  }}
                />
              </View>
            </Pressable>
          );
        })}
        {items.length > initialCount ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setExpanded((value) => !value)}
            className="min-h-12 items-center justify-center border-t border-separator active:opacity-70"
          >
            <AppText weight="bold" className="text-[14px] text-primary">
              {expanded
                ? t('reports.showLess')
                : t('reports.showAll', { count: hidden + visible.length })}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
