import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, type ReactNode } from 'react';

import { ErrorBoundary } from '@/components/ErrorScreen';
import { useDatabaseSetup } from '@/db/useDatabaseSetup';

/**
 * Veritabanı hazır olana kadar hiçbir şey çizmez (splash açık kalır), sonra splash'i kapatır.
 * Migration/hazır veri hatasında hata ekranı gösterir; "Tekrar dene" kurulumu baştan çalıştırır.
 */
export function DatabaseGate({ children }: { children: ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  return (
    <DatabaseSetup key={attempt} onRetry={() => setAttempt((n) => n + 1)}>
      {children}
    </DatabaseSetup>
  );
}

function DatabaseSetup({ children, onRetry }: { children: ReactNode; onRetry: () => void }) {
  const state = useDatabaseSetup();

  useEffect(() => {
    if (state.status !== 'pending') SplashScreen.hide();
  }, [state.status]);

  if (state.status === 'pending') return null;
  if (state.status === 'error') {
    return <ErrorBoundary error={state.error} retry={async () => onRetry()} />;
  }
  return children;
}
