import { addDatabaseChangeListener } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

export interface LiveQueryState<T> {
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
  isRefreshing: boolean;
  /** Aşağı çekerek yenileme için. */
  refresh: () => void;
}

/** Değişiklik olaylarını birleştirme süresi: toplu işlemlerde (ör. seed) tek yeniden sorgu. */
const DEBOUNCE_MS = 40;

/**
 * Repository sorgusunu çalıştırır ve veritabanı değiştikçe yeniden çalıştırır.
 * Ekranlar veriye bu kanca + repository üzerinden erişir; Drizzle sorgusu yazmaz (Bölüm 9).
 *
 * `query` `useCallback` ile sabitlenmelidir; değiştiğinde sorgu yeniden çalışır.
 * Yeniden yüklenirken eski veri gösterilmeye devam eder (liste titremez).
 */
export function useLiveQuery<T>(query: () => Promise<T>): LiveQueryState<T> {
  const [state, setState] = useState<{ data?: T; error?: Error; isLoading: boolean }>({
    isLoading: true,
  });
  const [refreshToken, setRefreshToken] = useState(0);
  const [isRefreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let version = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      const current = ++version;
      query().then(
        (data) => {
          if (cancelled || current !== version) return;
          setState({ data, isLoading: false });
          setRefreshing(false);
        },
        (error: unknown) => {
          if (cancelled || current !== version) return;
          setState((prev) => ({ ...prev, error: error as Error, isLoading: false }));
          setRefreshing(false);
        },
      );
    };

    run();
    const subscription = addDatabaseChangeListener(() => {
      clearTimeout(timer);
      timer = setTimeout(run, DEBOUNCE_MS);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      subscription.remove();
    };
  }, [query, refreshToken]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setRefreshToken((n) => n + 1);
  }, []);

  return { ...state, data: state.data, error: state.error, isRefreshing, refresh };
}
