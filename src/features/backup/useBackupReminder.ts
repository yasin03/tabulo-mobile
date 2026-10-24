import { backupReminder, type BackupReminder } from '@/core/backup';
import { backupRepo } from '@/db';
import { useLiveQuery } from '@/db/useLiveQuery';
import { useToday } from '@/lib/useToday';
import { usePreferences } from '@/stores/preferences';

const hasDataQuery = () => backupRepo.hasData();

/** Son yedek 30 günden eskiyse (veya hiç yoksa ve veri varsa) nazik hatırlatma (10.3). */
export function useBackupReminder(): BackupReminder {
  const lastBackupDate = usePreferences((s) => s.lastBackupDate);
  const today = useToday();
  const { data: hasData = false } = useLiveQuery(hasDataQuery);
  return backupReminder({ lastBackupDate, today, hasData });
}
