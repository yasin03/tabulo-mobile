import type { BottomTabBarProps } from 'expo-router/tabs';
import { ChartColumn, House, Plus, Settings, Users, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { cn } from '@/lib/cn';
import { useColors, useThemeMode } from '@/lib/theme';

const TAB_ICONS: Record<string, LucideIcon> = {
  index: House,
  contacts: Users,
  reports: ChartColumn,
  settings: Settings,
};

type TabBarProps = BottomTabBarProps & {
  onAddPress: () => void;
};

/**
 * Alt sekmeler: Ana sayfa · Cariler · [ + ] · Raporlar · Ayarlar (home.html).
 * Ortadaki + bir rota değildir; hareket tipi seçimi için BottomSheet açar.
 */
export function TabBar({ state, descriptors, navigation, insets, onAddPress }: TabBarProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const mode = useThemeMode();

  const items = state.routes.map((route, index) => {
    const descriptor = descriptors[route.key];
    const focused = state.index === index;
    const label = descriptor?.options.title ?? route.name;
    const Icon = TAB_ICONS[route.name] ?? House;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
    };

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        className="min-h-11 flex-1 items-center justify-center gap-1 active:opacity-60"
      >
        <Icon
          size={24}
          color={focused ? colors.primary : colors.muted}
          strokeWidth={focused ? 2.2 : 2}
        />
        <AppText
          weight={focused ? 'bold' : 'semibold'}
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
          className={cn('text-[11px] leading-[14px]', focused ? 'text-primary' : 'text-muted')}
        >
          {label}
        </AppText>
      </Pressable>
    );
  });

  // [Ana sayfa, Cariler] [+] [Raporlar, Ayarlar]
  const middle = Math.ceil(items.length / 2);

  return (
    <View
      className="flex-row items-center border-t border-border bg-surface px-3 pt-2"
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}
    >
      {items.slice(0, middle)}
      <View className="flex-1 items-center">
        <Pressable
          onPress={onAddPress}
          accessibilityRole="button"
          accessibilityLabel={t('tabs.add')}
          className="-mt-[26px] h-14 w-14 items-center justify-center rounded-[18px] bg-accent active:scale-95 active:opacity-90"
          style={
            mode === 'light'
              ? {
                  shadowColor: colors['warning-fg'],
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.35,
                  shadowRadius: 8,
                  elevation: 6,
                }
              : undefined
          }
        >
          <Plus size={28} color={colors['accent-foreground']} strokeWidth={2.6} />
        </Pressable>
      </View>
      {items.slice(middle)}
    </View>
  );
}
