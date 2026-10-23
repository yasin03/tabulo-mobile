import { router } from 'expo-router';
import { ArrowDown, ArrowUp, FileText, UserPlus, type LucideIcon } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import type { ColorToken } from '@/core/theme/tokens';
import { useContactLimit } from '@/features/contacts/useContactActions';
import { useColors } from '@/lib/theme';

type Action = {
  key: string;
  label: string;
  icon: LucideIcon;
  color: ColorToken;
  onPress: () => void;
};

/** Hızlı işlemler (7.2): Tahsilat, Ödeme, Cari ekle, Ekstre. */
export function QuickActions() {
  const { t } = useTranslation();
  const colors = useColors();
  const ensureCanAddContact = useContactLimit();

  const actions: Action[] = [
    {
      key: 'collection',
      label: t('movementTypes.collection'),
      icon: ArrowUp,
      color: 'positive',
      onPress: () => router.push({ pathname: '/transaction/new', params: { type: 'collection' } }),
    },
    {
      key: 'payment',
      label: t('movementTypes.payment'),
      icon: ArrowDown,
      color: 'negative',
      onPress: () => router.push({ pathname: '/transaction/new', params: { type: 'payment' } }),
    },
    {
      key: 'contact',
      label: t('contacts.add'),
      icon: UserPlus,
      color: 'primary',
      onPress: () => {
        void ensureCanAddContact().then((ok) => ok && router.push('/contact/new'));
      },
    },
    {
      key: 'statement',
      label: t('home.statement'),
      icon: FileText,
      color: 'primary',
      onPress: () => router.push('/export/statement'),
    },
  ];

  return (
    <View className="flex-row gap-2">
      {actions.map(({ key, label, icon: Icon, color, onPress }) => (
        <Pressable
          key={key}
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onPress}
          className="flex-1 items-center gap-1.5 active:opacity-70"
        >
          <View className="h-[52px] w-[52px] items-center justify-center rounded-2xl border border-border bg-surface">
            <Icon size={22} color={colors[color]} strokeWidth={2} />
          </View>
          <AppText
            weight="semibold"
            numberOfLines={2}
            maxFontSizeMultiplier={1.3}
            className="text-center text-[12px] leading-[16px]"
          >
            {label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}
