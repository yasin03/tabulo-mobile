import { Switch } from 'heroui-native';
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

type SettingsSwitchRowProps = {
  icon?: LucideIcon;
  label: string;
  /** Etiketin altında kısa açıklama. */
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  isDisabled?: boolean;
};

/** Aç/kapa ayar satırı; satırın tamamına dokunmak da değeri değiştirir. */
export function SettingsSwitchRow({
  icon: Icon,
  label,
  hint,
  value,
  onChange,
  isDisabled,
}: SettingsSwitchRowProps) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ checked: value, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={() => onChange(!value)}
      className="min-h-14 flex-row items-center gap-3 px-4 py-3 active:bg-surface-secondary"
    >
      {Icon ? <Icon size={20} color={colors.primary} /> : null}
      <View className="flex-1 gap-0.5">
        <AppText weight="semibold">{label}</AppText>
        {hint ? <AppText className="text-[13px] leading-[18px] text-muted">{hint}</AppText> : null}
      </View>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Switch isSelected={value} isDisabled={isDisabled} onSelectedChange={onChange} />
      </View>
    </Pressable>
  );
}
