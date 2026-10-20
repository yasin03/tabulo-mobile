// Tahsilat hatırlatıcıları (6.6): cari + tarih + saat + not; yerel bildirim kurulur.

import { and, asc, eq, isNull, lte, sql, type SQL } from 'drizzle-orm';

import { contacts, reminders } from '../schema';
import type { Contact, Db, DbOrTx, Reminder, ReminderStatus } from '../types';
import { emptyToNull, requireRow } from './shared';

export interface ReminderInput {
  contactId: string;
  /** İlgili veresiye satış (isteğe bağlı). */
  transactionId?: string | null;
  remindDate: string;
  remindTime: string;
  note?: string | null;
}

export type ReminderListItem = Reminder & {
  contactName: string;
  personType: Contact['personType'];
};

const rm = reminders;
/** Silinmiş hatırlatıcılar ve silinmiş carilerin hatırlatıcıları görünmez (bildirimleri de kurulmaz). */
const live = (...conditions: (SQL | undefined)[]) =>
  and(isNull(rm.deletedAt), isNull(contacts.deletedAt), ...conditions);

function getSync(db: DbOrTx, id: string): Reminder {
  return requireRow(
    db
      .select()
      .from(rm)
      .where(and(eq(rm.id, id), isNull(rm.deletedAt)))
      .all()[0],
  );
}

function selectDetailed(db: DbOrTx, where: SQL | undefined) {
  return db
    .select({ reminder: rm, contactName: contacts.name, personType: contacts.personType })
    .from(rm)
    .innerJoin(contacts, eq(contacts.id, rm.contactId))
    .where(where)
    .orderBy(asc(rm.remindDate), asc(rm.remindTime), asc(rm.createdAt));
}

function toListItem(row: {
  reminder: Reminder;
  contactName: string;
  personType: Contact['personType'];
}): ReminderListItem {
  return { ...row.reminder, contactName: row.contactName, personType: row.personType };
}

export function createRemindersRepo(db: Db) {
  return {
    /** Bekleyen hatırlatıcılar, en yakından uzağa. `contactId` verilirse yalnızca o carinin. */
    async listPending(filter: { contactId?: string } = {}): Promise<ReminderListItem[]> {
      return selectDetailed(
        db,
        live(
          eq(rm.status, 'pending'),
          filter.contactId ? eq(rm.contactId, filter.contactId) : undefined,
        ),
      )
        .all()
        .map(toListItem);
    },

    /** Zamanı gelmiş (bugün veya öncesi) bekleyen hatırlatıcı sayısı: ana sayfadaki zil rozeti. */
    async countDue(today: string): Promise<number> {
      const row = db
        .select({ count: sql<number>`COUNT(*)`.mapWith(Number) })
        .from(rm)
        .innerJoin(contacts, eq(contacts.id, rm.contactId))
        .where(live(eq(rm.status, 'pending'), lte(rm.remindDate, today)))
        .all()[0];
      return row?.count ?? 0;
    },

    async getById(id: string): Promise<Reminder> {
      return getSync(db, id);
    },

    async create(input: ReminderInput): Promise<string> {
      requireRow(
        db
          .select({ id: contacts.id })
          .from(contacts)
          .where(and(eq(contacts.id, input.contactId), isNull(contacts.deletedAt)))
          .all()[0],
      );
      return db
        .insert(rm)
        .values({
          contactId: input.contactId,
          transactionId: input.transactionId ?? null,
          remindDate: input.remindDate,
          remindTime: input.remindTime,
          note: emptyToNull(input.note) ?? null,
        })
        .returning({ id: rm.id })
        .all()[0]!.id;
    },

    /** Tarih/saat/not değişir; tamamlanmış hatırlatıcı yeniden kurulursa tekrar beklemeye alınır. */
    async update(
      id: string,
      input: Pick<ReminderInput, 'remindDate' | 'remindTime' | 'note'>,
    ): Promise<void> {
      getSync(db, id);
      db.update(rm)
        .set({
          remindDate: input.remindDate,
          remindTime: input.remindTime,
          note: emptyToNull(input.note) ?? null,
          status: 'pending',
        })
        .where(eq(rm.id, id))
        .run();
    },

    async setStatus(id: string, status: ReminderStatus): Promise<void> {
      getSync(db, id);
      db.update(rm).set({ status }).where(eq(rm.id, id)).run();
    },

    /** Kurulu bildirimin kimliği; yalnızca değiştiyse yazar. */
    async setNotificationId(id: string, notificationId: string | null): Promise<void> {
      db.update(rm)
        .set({ notificationId })
        .where(and(eq(rm.id, id), sql`${rm.notificationId} IS NOT ${notificationId}`))
        .run();
    },

    async softDelete(id: string): Promise<void> {
      getSync(db, id);
      db.update(rm).set({ deletedAt: new Date() }).where(eq(rm.id, id)).run();
    },

    async restore(id: string): Promise<void> {
      db.update(rm).set({ deletedAt: null }).where(eq(rm.id, id)).run();
    },
  };
}

export type RemindersRepo = ReturnType<typeof createRemindersRepo>;
