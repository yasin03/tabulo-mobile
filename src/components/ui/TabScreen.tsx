import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';

type TabScreenProps = {
  title?: string;
  /** Başlık yerine özel üst alan (ör. ana sayfadaki logo). */
  header?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  /** Aşağı çekerek yenileme (8.3). */
  isRefreshing?: boolean;
  onRefresh?: () => void;
};

/** Sekme ekranlarının ortak iskeleti: güvenli alan, 20 px yan boşluk, 18 px bölüm aralığı. */
export function TabScreen({
  title,
  header,
  right,
  children,
  isRefreshing = false,
  onRefresh,
}: TabScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-[18px] px-5 pb-6"
      contentContainerStyle={{ paddingTop: insets.top + 12 }}
      keyboardDismissMode="on-drag"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} /> : undefined
      }
    >
      <View className="min-h-11 flex-row items-center justify-between gap-3">
        {header ?? (
          <AppText
            weight="extrabold"
            accessibilityRole="header"
            className="flex-1 text-[26px] leading-[34px] tracking-[-0.5px]"
          >
            {title}
          </AppText>
        )}
        {right}
      </View>
      {children}
    </ScrollView>
  );
}
