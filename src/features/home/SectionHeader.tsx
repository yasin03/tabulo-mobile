import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';

type SectionHeaderProps = {
  title: string;
  /** "Tümü" bağlantısı. */
  onSeeAll?: () => void;
  seeAllLabel?: string;
};

export function SectionHeader({ title, onSeeAll, seeAllLabel }: SectionHeaderProps) {
  const { t } = useTranslation();
  return (
    <View className="min-h-11 flex-row items-center justify-between gap-3">
      <AppText
        weight="extrabold"
        accessibilityRole="header"
        className="flex-1 text-[17px] leading-[24px]"
      >
        {title}
      </AppText>
      {onSeeAll ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${title}: ${seeAllLabel ?? t('home.seeAll')}`}
          onPress={onSeeAll}
          hitSlop={8}
          className="min-h-11 justify-center active:opacity-70"
        >
          <AppText weight="bold" className="text-[13px] text-primary">
            {seeAllLabel ?? t('home.seeAll')}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
