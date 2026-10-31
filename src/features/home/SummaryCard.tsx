import { ChevronDown } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useDates } from '@/lib/dates';
import { useColors } from '@/lib/theme';

export type SummaryTile = {
  label: string;
  value: string;
  tone: 'positive' | 'negative';
  /** Verilirse kutucuk dokunulabilir (ör. ilgili hareketleri açar). */
  onPress?: () => void;
  accessibilityHint?: string;
};

type SummaryCardProps = {
  title: string;
  /** Biçimlenmiş büyük rakam. */
  amount: string;
  /** `2026-10` */
  month: string;
  tiles: readonly [SummaryTile, SummaryTile];
  /** Kutucukların altında küçük açıklama. */
  note?: string;
  onMonthPress: () => void;
};

/**
 * Ana sayfa özet kartının kabuğu (7.2, home.html): başlık + ay seçici, büyük rakam, iki kutucuk.
 * İçeriği `SummaryCarousel` belirler. Kart iki temada da lacivert; yeşil/kırmızı tonlar açık tutulur.
 */
export function SummaryCard({ title, amount, month, tiles, note, onMonthPress }: SummaryCardProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const dates = useDates();
  const monthLabel = dates.format(`${month}-01`, 'monthYear');

  return (
    <View className="flex-1 gap-4 rounded-[22px] bg-summary p-5">
      <View className="flex-row items-center justify-between gap-3">
        <AppText className="flex-1 text-[14px] leading-[20px] text-summary-muted">{title}</AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.selectMonth', { month: monthLabel })}
          onPress={onMonthPress}
          hitSlop={8}
          className="min-h-8 flex-row items-center gap-1 rounded-full bg-accent px-[10px] py-1 active:opacity-80"
        >
          <AppText
            weight="bold"
            maxFontSizeMultiplier={1.4}
            className="text-[13px] leading-[18px] text-accent-foreground"
          >
            {monthLabel}
          </AppText>
          <ChevronDown size={14} color={colors['accent-foreground']} strokeWidth={2.6} />
        </Pressable>
      </View>

      <AppText
        weight="extrabold"
        accessibilityRole="header"
        adjustsFontSizeToFit
        numberOfLines={1}
        className="text-[36px] leading-[44px] tracking-[-0.7px] text-summary-foreground"
      >
        {amount}
      </AppText>

      <View className="gap-2.5">
        <View className="flex-row gap-[10px]">
          {tiles.map((tile) => (
            <Tile key={tile.label} tile={tile} />
          ))}
        </View>
        {note ? (
          <AppText className="text-[12px] leading-[16px] text-summary-muted">{note}</AppText>
        ) : null}
      </View>
    </View>
  );
}

function Tile({ tile }: { tile: SummaryTile }) {
  const content = (
    <>
      <AppText className="text-[13px] leading-[18px] text-summary-muted">{tile.label}</AppText>
      <AppText
        weight="extrabold"
        adjustsFontSizeToFit
        numberOfLines={1}
        className={`text-[18px] leading-[24px] ${
          tile.tone === 'positive' ? 'text-summary-positive' : 'text-summary-negative'
        }`}
      >
        {tile.value}
      </AppText>
    </>
  );

  if (!tile.onPress) {
    return <View className="flex-1 gap-1 rounded-[14px] bg-summary-tile p-3">{content}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={tile.accessibilityHint}
      onPress={tile.onPress}
      className="flex-1 gap-1 rounded-[14px] bg-summary-tile p-3 active:opacity-70"
    >
      {content}
    </Pressable>
  );
}
