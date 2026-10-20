import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/AppText';
import { useColors } from '@/lib/theme';

/** Belge fotoğrafını tam ekran gösterir; iOS'ta iki parmakla yakınlaştırılır (7.7). */
export default function AttachmentViewerScreen() {
  const { t } = useTranslation();
  const { uri, title } = useLocalSearchParams<{ uri: string; title?: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  return (
    <View className="flex-1 bg-background">
      <View
        className="flex-row items-center gap-3 px-5 pb-2"
        style={{ paddingTop: insets.top + 8 }}
      >
        <AppText weight="bold" numberOfLines={1} className="flex-1">
          {title ?? ''}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={() => router.back()}
          className="h-11 w-11 items-center justify-center rounded-[14px] border border-border bg-surface active:opacity-70"
        >
          <X size={22} color={colors.foreground} />
        </Pressable>
      </View>
      <ScrollView
        maximumZoomScale={4}
        minimumZoomScale={1}
        centerContent
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <Image
          source={{ uri }}
          style={{ width, height: height - insets.top - insets.bottom - 72 }}
          contentFit="contain"
          accessibilityLabel={title}
          accessibilityIgnoresInvertColors
        />
      </ScrollView>
    </View>
  );
}
