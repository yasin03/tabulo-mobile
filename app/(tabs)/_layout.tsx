import { Redirect, router } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AddMovementSheet } from '@/components/navigation/AddMovementSheet';
import { TabBar } from '@/components/navigation/TabBar';
import { usePreferences } from '@/stores/preferences';

export default function TabsLayout() {
  const { t } = useTranslation();
  const [isAddOpen, setAddOpen] = useState(false);
  const onboardingDone = usePreferences((s) => s.onboardingDone);

  if (!onboardingDone) return <Redirect href="/onboarding" />;

  return (
    <>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <TabBar {...props} onAddPress={() => setAddOpen(true)} />}
      >
        <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
        <Tabs.Screen name="contacts" options={{ title: t('tabs.contacts') }} />
        <Tabs.Screen name="reports" options={{ title: t('tabs.reports') }} />
        <Tabs.Screen name="settings" options={{ title: t('tabs.settings') }} />
      </Tabs>
      <AddMovementSheet
        isOpen={isAddOpen}
        onOpenChange={setAddOpen}
        onSelect={(type) => {
          setAddOpen(false);
          router.push({ pathname: '/transaction/new', params: { type } });
        }}
      />
    </>
  );
}
