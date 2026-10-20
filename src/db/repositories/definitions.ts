// İşlem türleri ve işlem konuları: ekle, yeniden adlandır, sırala, pasife al (7.11).
// Hazır kayıtlar yeniden adlandırılabilir ve pasife alınabilir ama silinemez (5.2).

import { and, asc, eq, inArray, isNull, max, type SQL } from 'drizzle-orm';
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core';

import { DomainError } from '@/core/errors';
import type { Direction } from '@/core/ledger';

import { subjects, transactionTypes } from '../schema';
import { namesInAllLanguages } from '../seed';
import type { Db, Status, Subject, TransactionType } from '../types';
import { requireName, requireRow } from './shared';

export interface DefinitionListOptions {
  /** Varsayılan: yalnızca aktifler. */
  includePassive?: boolean;
}

function statusFilter(column: SQLiteColumn, options?: DefinitionListOptions) {
  return options?.includePassive ? undefined : eq(column, 'active');
}

export function createTransactionTypesRepo(db: Db) {
  const t = transactionTypes;
  const live = (...conditions: (SQL | undefined)[]) => and(isNull(t.deletedAt), ...conditions);

  function getSync(id: string): TransactionType {
    return requireRow(
      db
        .select()
        .from(t)
        .where(live(eq(t.id, id)))
        .all()[0],
    );
  }

  return {
    async list(
      options?: DefinitionListOptions & { direction?: Direction },
    ): Promise<TransactionType[]> {
      return db
        .select()
        .from(t)
        .where(
          live(
            statusFilter(t.status, options),
            options?.direction ? eq(t.direction, options.direction) : undefined,
          ),
        )
        .orderBy(asc(t.direction), asc(t.sortOrder), asc(t.name))
        .all();
    },

    async getById(id: string): Promise<TransactionType> {
      return getSync(id);
    },

    async create(input: { name: string; direction: Direction }): Promise<string> {
      const name = requireName(input.name);
      return db.transaction((tx) => {
        const last = tx
          .select({ value: max(t.sortOrder) })
          .from(t)
          .where(live(eq(t.direction, input.direction)))
          .all()[0];
        return tx
          .insert(t)
          .values({ name, direction: input.direction, sortOrder: (last?.value ?? -1) + 1 })
          .returning({ id: t.id })
          .all()[0]!.id;
      });
    },

    async rename(id: string, name: string): Promise<void> {
      getSync(id);
      db.update(t)
        .set({ name: requireName(name) })
        .where(eq(t.id, id))
        .run();
    },

    async setStatus(id: string, status: Status): Promise<void> {
      getSync(id);
      db.update(t).set({ status }).where(eq(t.id, id)).run();
    },

    /** Verilen sıraya göre sortOrder'ı 0'dan yeniden yazar. */
    async reorder(orderedIds: readonly string[]): Promise<void> {
      db.transaction((tx) => {
        orderedIds.forEach((id, index) => {
          tx.update(t).set({ sortOrder: index }).where(eq(t.id, id)).run();
        });
      });
    },

    async softDelete(id: string): Promise<void> {
      if (getSync(id).isSystem) throw new DomainError('systemRecordNotDeletable');
      db.update(t).set({ deletedAt: new Date() }).where(eq(t.id, id)).run();
    },

    /** Yumuşak silmeyi geri alır ("Geri al", 5.1). */
    async restore(id: string): Promise<void> {
      db.update(t).set({ deletedAt: null }).where(eq(t.id, id)).run();
    },
  };
}

export function createSubjectsRepo(db: Db) {
  const s = subjects;
  const live = (...conditions: (SQL | undefined)[]) => and(isNull(s.deletedAt), ...conditions);

  function getSync(id: string): Subject {
    return requireRow(
      db
        .select()
        .from(s)
        .where(live(eq(s.id, id)))
        .all()[0],
    );
  }

  return {
    async list(options?: DefinitionListOptions): Promise<Subject[]> {
      return db
        .select()
        .from(s)
        .where(live(statusFilter(s.status, options)))
        .orderBy(asc(s.sortOrder), asc(s.name))
        .all();
    },

    async getById(id: string): Promise<Subject> {
      return getSync(id);
    },

    /**
     * Hareket formunun varsayılan konusu: hazır "Genel" kaydı (6.4), aktifse.
     * Kullanıcı yeniden adlandırdıysa bulunamaz ve `null` döner (konu boş kalır).
     */
    async findDefault(): Promise<Subject | null> {
      return (
        db
          .select()
          .from(s)
          .where(
            live(
              eq(s.isSystem, true),
              eq(s.status, 'active'),
              inArray(s.name, namesInAllLanguages('subjects', 'general')),
            ),
          )
          .limit(1)
          .all()[0] ?? null
      );
    },

    async create(input: { name: string }): Promise<string> {
      const name = requireName(input.name);
      return db.transaction((tx) => {
        const last = tx
          .select({ value: max(s.sortOrder) })
          .from(s)
          .where(live())
          .all()[0];
        return tx
          .insert(s)
          .values({ name, sortOrder: (last?.value ?? -1) + 1 })
          .returning({ id: s.id })
          .all()[0]!.id;
      });
    },

    async rename(id: string, name: string): Promise<void> {
      getSync(id);
      db.update(s)
        .set({ name: requireName(name) })
        .where(eq(s.id, id))
        .run();
    },

    async setStatus(id: string, status: Status): Promise<void> {
      getSync(id);
      db.update(s).set({ status }).where(eq(s.id, id)).run();
    },

    async reorder(orderedIds: readonly string[]): Promise<void> {
      db.transaction((tx) => {
        orderedIds.forEach((id, index) => {
          tx.update(s).set({ sortOrder: index }).where(eq(s.id, id)).run();
        });
      });
    },

    async softDelete(id: string): Promise<void> {
      if (getSync(id).isSystem) throw new DomainError('systemRecordNotDeletable');
      db.update(s).set({ deletedAt: new Date() }).where(eq(s.id, id)).run();
    },

    /** Yumuşak silmeyi geri alır ("Geri al", 5.1). */
    async restore(id: string): Promise<void> {
      db.update(s).set({ deletedAt: null }).where(eq(s.id, id)).run();
    },
  };
}

export type TransactionTypesRepo = ReturnType<typeof createTransactionTypesRepo>;
export type SubjectsRepo = ReturnType<typeof createSubjectsRepo>;
