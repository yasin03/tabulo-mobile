import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Children, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { cn } from '@/lib/cn';
import { useColors } from '@/lib/theme';

/** Başlıklı ayar grubu: kart içinde ayraçlı satırlar. */
export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <View className="gap-2.5">
      {title ? (
        <AppText
          weight="extrabold"
          accessibilityRole="header"
          className="text-[17px] leading-[24px]"
        >
          {title}
        </AppText>
      ) : null}
      <View className="overflow-hidden rounded-[18px] border border-border bg-surface">
        {rows.map((row, index) => (
          <View key={index} className={cn(index > 0 && 'border-t border-separator')}>
            {row}
          </View>
        ))}
      </View>
    </View>
  );
}

type SettingsRowProps = {
  icon?: LucideIcon;
  label: string;
  /** Sağda ikincil metin (ör. seçili para birimi). */
  value?: string;
  onPress: () => void;
};

/** Ayarlar satırı: simge, etiket, değer, ok. */
export function SettingsRow({ icon: Icon, label, value, onPress }: SettingsRowProps) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      className="min-h-14 flex-row items-center gap-3 px-4 py-3 active:bg-surface-secondary"
    >
      {Icon ? <Icon size={20} color={colors.primary} /> : null}
      <AppText weight="semibold" className="flex-1">
        {label}
      </AppText>
      {value ? (
        <AppText numberOfLines={1} className="max-w-[45%] text-[14px] text-muted">
          {value}
        </AppText>
      ) : null}
      <ChevronRight size={20} color={colors.muted} />
    </Pressable>
  );
}
