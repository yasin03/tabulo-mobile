import { Text, type TextProps } from 'react-native';

import { cn } from '@/lib/cn';

type Weight = 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold';

const WEIGHT_CLASS: Record<Weight, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
  extrabold: 'font-extrabold',
};

export type AppTextProps = TextProps & {
  className?: string;
  weight?: Weight;
};

/** Plus Jakarta Sans ile varsayılan gövde metni (15 px, foreground). */
export function AppText({ className, weight = 'normal', ...props }: AppTextProps) {
  return (
    <Text
      className={cn('text-[15px] leading-[22px] text-foreground', WEIGHT_CLASS[weight], className)}
      {...props}
    />
  );
}
