// Yalnızca testler için: Node'un yerleşik SQLite'ı (node:sqlite) üzerinde gerçek migration'larla bellek içi veritabanı.
// Uygulama kodu bu dosyayı import etmez.

import { drizzle } from 'drizzle-orm/node-sqlite';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

import { createRepositories } from './repositories';
import { seedDatabase, type SeedOptions } from './seed';
import type { Db } from './types';

export function createTestDb(): Db {
  const client = new DatabaseSync(':memory:');
  client.exec('PRAGMA foreign_keys = ON;');
  const db = drizzle({ client });
  migrate(db, { migrationsFolder: path.join(__dirname, 'migrations') });
  return db;
}

/** Migration + hazır veriler uygulanmış veritabanı ve repository'ler. */
export function createSeededTestDb(options: SeedOptions = { language: 'tr', currency: 'TRY' }) {
  const db = createTestDb();
  seedDatabase(db, options);
  return { db, ...createRepositories(db) };
}
