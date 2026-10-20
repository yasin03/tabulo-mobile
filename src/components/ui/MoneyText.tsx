import { AppText, type AppTextProps } from '@/components/ui/AppText';
import { cn } from '@/lib/cn';
import { useMoney } from '@/lib/business';

type MoneyTextProps = Omit<AppTextProps, 'children'> & {
  minor: number;
  /** `+ / −` işareti ve renk (4.3): pozitif `positive`, negatif `negative`, sıfır `muted`. */
  signed?: boolean;
};

/** Tutar gösterimi: her zaman money.ts üzerinden biçimlenir, tutarlar 800 kalınlıkta (4.3). */
export function MoneyText({ minor, signed = false, className, ...props }: MoneyTextProps) {
  const money = useMoney();
  const tone = !signed
    ? undefined
    : minor > 0
      ? 'text-positive'
      : minor < 0
        ? 'text-negative'
        : 'text-muted';
  return (
    <AppText weight="extrabold" className={cn(tone, className)} {...props}>
      {signed ? money.formatSigned(minor) : money.format(minor)}
    </AppText>
  );
}
