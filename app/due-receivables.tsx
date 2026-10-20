import { Stack } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toIsoDate } from '@/core/dates';
import { transactionsRepo } from '@/db';
import { useLiveQuery } from '@/db/useLiveQuery';
import { DueReceivableRow } from '@/features/home/DueReceivableRow';

/** Vadesi geçmiş veya 7 gün içinde dolacak tüm açık alacaklar (ana sayfadaki bölümün tamamı). */
export default function DueReceivablesScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const query = useCallback(() => transactionsRepo.dueReceivables(toIsoDate()), []);
  const { data = [] } = useLiveQuery(query);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-5 pt-4"
      contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
    >
      <Stack.Screen options={{ title: t('home.dueReceivables') }} />
      <View className="overflow-hidden rounded-[18px] border border-border bg-surface">
        {data.map((item, index) => (
          <DueReceivableRow
            key={`${item.contactId}-${item.transactionId ?? index}`}
            item={item}
            isFirst={index === 0}
          />
        ))}
      </View>
    </ScrollView>
  );
}
