import { Skeleton } from 'heroui-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { cn } from '@/lib/cn';

type ListSkeletonProps = {
  rows?: number;
  /** Solda yuvarlak avatar / simge yeri. */
  avatar?: boolean;
  className?: string;
};

/**
 * Liste yüklenirken satır iskeleti (Faz 10). Ekran okuyucu tek bir "Yükleniyor" öğesi duyar.
 * Veri yerel olduğundan genelde bir an görünür; büyük veride (binlerce hareket) boş ekran yerine.
 */
export function ListSkeleton({ rows = 6, avatar = true, className }: ListSkeletonProps) {
  const { t } = useTranslation();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
      className={cn('overflow-hidden rounded-[18px] border border-border bg-surface', className)}
    >
      {Array.from({ length: rows }, (_, i) => (
        <View
          key={i}
          className={cn(
            'min-h-16 flex-row items-center gap-3 px-4 py-3',
            i > 0 && 'border-t border-separator',
          )}
        >
          {avatar ? <Skeleton className="h-11 w-11 rounded-full" /> : null}
          <View className="flex-1 gap-2">
            <Skeleton className="h-3.5 w-3/5 rounded-md" />
            <Skeleton className="h-3 w-2/5 rounded-md" />
          </View>
          <Skeleton className="h-4 w-20 rounded-md" />
        </View>
      ))}
    </View>
  );
}

/** Özet kartları yüklenirken (Raporlar). */
export function CardsSkeleton({ count = 4 }: { count?: number }) {
  const { t } = useTranslation();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
      className="flex-row flex-wrap gap-3"
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          className="min-h-20 grow basis-[45%] gap-2.5 rounded-[18px] border border-border bg-surface p-4"
        >
          <Skeleton className="h-3 w-1/2 rounded-md" />
          <Skeleton className="h-5 w-3/4 rounded-md" />
        </View>
      ))}
    </View>
  );
}
