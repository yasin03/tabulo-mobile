import {
  ChartColumn,
  DatabaseBackup,
  FileSpreadsheet,
  Landmark,
  Paperclip,
  Send,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { PREMIUM_FEATURES, type PremiumFeature } from '@/config/plans';
import { cn } from '@/lib/cn';
import { useColors } from '@/lib/theme';

const ICONS: Record<PremiumFeature, LucideIcon> = {
  unlimitedContacts: Users,
  unlimitedAccounts: Landmark,
  charts: ChartColumn,
  export: FileSpreadsheet,
  whatsappStatement: Send,
  backup: DatabaseBackup,
  attachments: Paperclip,
};

/** Premium özellikleri (6.8); paywall'u açan özellik vurgulanır. */
export function PremiumFeatureList({ highlight }: { highlight?: PremiumFeature }) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View className="overflow-hidden rounded-[18px] border border-border bg-surface">
      {PREMIUM_FEATURES.map((feature, index) => {
        const Icon = ICONS[feature];
        return (
          <View
            key={feature}
            className={cn(
              'min-h-14 flex-row items-center gap-3 px-4 py-3',
              index > 0 && 'border-t border-separator',
              feature === highlight && 'bg-warning-bg',
            )}
          >
            <Icon size={20} color={colors.primary} />
            <View className="flex-1 gap-0.5">
              <AppText weight="semibold">{t(`premium.features.${feature}.title`)}</AppText>
              <AppText className="text-[13px] leading-[18px] text-muted">
                {t(`premium.features.${feature}.description`)}
              </AppText>
            </View>
          </View>
        );
      })}
    </View>
  );
}
