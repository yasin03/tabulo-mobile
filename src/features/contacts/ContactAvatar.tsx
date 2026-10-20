import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { initials } from '@/core/text';
import { cn } from '@/lib/cn';
import { useLanguage } from '@/lib/i18n';
import type { PersonType } from '@/db/repositories';

type ContactAvatarProps = {
  name: string;
  personType: PersonType;
  size?: 'md' | 'lg';
  isPassive?: boolean;
  /** Lacivert zemin, beyaz harf (cari detay başlığı, client-detail.html). */
  solid?: boolean;
};

/** Baş harf avatarı: şahıs yuvarlak, şirket yuvarlatılmış kare (7.3). */
export function ContactAvatar({
  name,
  personType,
  size = 'md',
  isPassive,
  solid,
}: ContactAvatarProps) {
  const language = useLanguage();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={cn(
        'items-center justify-center',
        solid ? 'bg-primary' : 'bg-surface-secondary',
        size === 'md' ? 'h-10 w-10' : 'h-14 w-14',
        personType === 'individual' ? 'rounded-full' : size === 'md' ? 'rounded-xl' : 'rounded-2xl',
        isPassive && 'opacity-50',
      )}
    >
      <AppText
        weight="extrabold"
        maxFontSizeMultiplier={1.2}
        className={cn(
          solid ? 'text-primary-foreground' : 'text-primary',
          size === 'md' ? 'text-[14px] leading-[18px]' : 'text-[20px] leading-[26px]',
        )}
      >
        {initials(name, language === 'tr' ? 'tr' : 'en')}
      </AppText>
    </View>
  );
}
