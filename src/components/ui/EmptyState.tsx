import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useColors } from '@/lib/theme';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
};

/** Boş durum: açıklayıcı metin + tek eylem (4.3). */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  const colors = useColors();
  return (
    <View className="items-center gap-3 rounded-[18px] border border-border bg-surface px-6 py-10">
      <View className="h-14 w-14 items-center justify-center rounded-2xl bg-surface-secondary">
        <Icon size={26} color={colors.primary} strokeWidth={2} />
      </View>
      <AppText weight="bold" className="text-center text-[17px] leading-[24px]">
        {title}
      </AppText>
      {description ? (
        <AppText className="text-center text-[13px] leading-[19px] text-muted">
          {description}
        </AppText>
      ) : null}
      {action}
    </View>
  );
}
