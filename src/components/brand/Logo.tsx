import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { AppText } from '@/components/ui/AppText';
import { brandColors } from '@/core/theme/tokens';
import { cn } from '@/lib/cn';

type LogoMarkProps = { size?: number };

/** docs/designs/logo.svg – tek ve son logo. Marka renkleri temadan bağımsızdır. */
export function LogoMark({ size = 32 }: LogoMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityElementsHidden>
      <Rect width={120} height={120} rx={28} fill={brandColors.navy} />
      <Rect x={64} y={22} width={22} height={16} rx={4} fill={brandColors.amber} />
      <Rect x={28} y={30} width={64} height={66} rx={10} fill={brandColors.white} />
      <Path
        d="M56 42 V76 Q56 87 67 87 H72"
        fill="none"
        stroke={brandColors.navy}
        strokeWidth={10}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M45 55 H71"
        fill="none"
        stroke={brandColors.navy}
        strokeWidth={10}
        strokeLinecap="round"
      />
    </Svg>
  );
}

type LogoProps = { size?: number; className?: string };

/** Logo + `tabulo` yazı markası (ana sayfa başlığı). */
export function Logo({ size = 32, className }: LogoProps) {
  const { t } = useTranslation();
  return (
    <View
      className={cn('flex-row items-center gap-2', className)}
      accessible
      accessibilityRole="header"
      accessibilityLabel={t('brand.name')}
    >
      <LogoMark size={size} />
      <AppText
        weight="extrabold"
        maxFontSizeMultiplier={1.4}
        className="text-[22px] leading-[28px] tracking-[-0.66px] text-primary"
      >
        {t('brand.name')}
      </AppText>
    </View>
  );
}
