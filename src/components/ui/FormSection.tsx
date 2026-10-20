import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';

type FormSectionProps = {
  title: string;
  hint?: string;
  children: ReactNode;
};

/** Formlarda başlıklı alan grubu. */
export function FormSection({ title, hint, children }: FormSectionProps) {
  return (
    <View className="gap-3 pt-2">
      <View className="gap-1">
        <AppText
          weight="extrabold"
          accessibilityRole="header"
          className="text-[17px] leading-[24px]"
        >
          {title}
        </AppText>
        {hint ? <AppText className="text-[13px] leading-[19px] text-muted">{hint}</AppText> : null}
      </View>
      {children}
    </View>
  );
}
