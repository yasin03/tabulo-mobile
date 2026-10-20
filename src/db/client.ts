import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

export const DATABASE_NAME = 'tabulo.db';

// enableChangeListener: ileride useLiveQuery ile ekranların veri değişince yenilenmesi için.
export const sqlite = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });

// WAL: genel performans (expo-sqlite önerisi). Yabancı anahtarlar SQLite'ta varsayılan olarak kapalıdır.
sqlite.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite);
