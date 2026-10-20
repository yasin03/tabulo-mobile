import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { toIsoDate } from '@/core/dates';

/**
 * Bugünün tarihi (`YYYY-AA-GG`). Uygulama ön plana gelince ve gece yarısı güncellenir; böylece
 * "bugün", "yaklaşan" ve "gecikti" hesapları gün değişince yenilenir (8.4).
 */
export function useToday(): string {
  const [today, setToday] = useState(toIsoDate);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => setToday(toIsoDate());
    const scheduleMidnight = () => {
      clearTimeout(timer);
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
      timer = setTimeout(() => {
        update();
        scheduleMidnight();
      }, next.getTime() - now.getTime());
    };
    scheduleMidnight();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      update();
      scheduleMidnight();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return today;
}
