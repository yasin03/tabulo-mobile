import { ChartColumn } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/EmptyState';
import { TabScreen } from '@/components/ui/TabScreen';

export default function ReportsScreen() {
  const { t } = useTranslation();
  return (
    <TabScreen title={t('tabs.reports')}>
      <EmptyState
        icon={ChartColumn}
        title={t('tabs.reports')}
        description={t('common.comingSoon')}
      />
    </TabScreen>
  );
}
