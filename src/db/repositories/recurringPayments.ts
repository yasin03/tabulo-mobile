// Düzenli ödemeler (6.5). "Ödendi" hareketi oluşturur ve sonraki tarihi sıklık × aralık kadar ileri alır.

import { and, asc, eq, isNull, sql, type SQL } from 'drizzle-orm';

import { DomainError } from '@/core/errors';
import { MOVEMENT_RULES } from '@/core/ledger';
import type { Currency } from '@/core/money';
import {
  isScheduleFinished,
  MAX_INTERVAL,
  MAX_REMIND_DAYS_BEFORE,
  nextOccurrence,
  type Frequency,
} from '@/core/recurrence';

import { accounts, contacts, recurringPayments, transactions, transactionTypes } from '../schema';
import type { Db, DbOrTx, RecurringPayment, Status } from '../types';
import { requireName, requireRow } from './shared';
import { insertTransaction } from './transactions';

export type RecurringMovementType = RecurringPayment['movementType'];

export interface RecurringPaymentInput {
  title: string;
  movementType: RecurringMovementType;
  amountMinor: number;
  accountId: string;
  contactId?: string | null;
  transactionTypeId?: string | null;
  subjectId?: string | null;
  frequency: Frequency;
  interval: number;
  /** Tekrarların dayanağı (aylıkta ayın günü buradan). */
  startDate: string;
  endDate?: string | null;
  /** Verilmezse `startDate`. */
  nextDueDate?: string;
  remindDaysBefore: number;
  remindTime: string;
  currency?: Currency;
}

export type RecurringPaymentListItem = RecurringPayment & {
  accountName: string | null;
  contactName: string | null;
  transactionTypeName: string | null;
  /** Bitiş tarihi geçti (pasif ve tamamlandı). */
  isFinished: boolean;
};

export interface MarkPaidInput {
  amountMinor: number;
  date: string;
  accountId: string;
}

export interface MarkPaidResult {
  transactionId: string;
  nextDueDate: string;
  isFinished: boolean;
  /** "Geri al" için önceki durum. */
  previous: { nextDueDate: string; status: Status };
}

const r = recurringPayments;
const live = (...conditions: (SQL | undefined)[]) => and(isNull(r.deletedAt), ...conditions);

function getSync(db: DbOrTx, id: string): RecurringPayment {
  return requireRow(
    db
      .select()
      .from(r)
      .where(live(eq(r.id, id)))
      .all()[0],
  );
}

function normalized(input: RecurringPaymentInput) {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new DomainError('amountNotPositive');
  }
  if (!Number.isInteger(input.interval) || input.interval < 1 || input.interval > MAX_INTERVAL) {
    throw new RangeError('Aralık 1–12 olmalı');
  }
  if (
    !Number.isInteger(input.remindDaysBefore) ||
    input.remindDaysBefore < 0 ||
    input.remindDaysBefore > MAX_REMIND_DAYS_BEFORE
  ) {
    throw new RangeError('Hatırlatma günü 0–30 olmalı');
  }
  if (!input.accountId) throw new DomainError('accountRequired');
  const nextDueDate = input.nextDueDate ?? input.startDate;
  const endDate = input.endDate ?? null;
  return {
    title: requireName(input.title),
    movementType: input.movementType,
    amountMinor: input.amountMinor,
    accountId: input.accountId,
    contactId: input.contactId ?? null,
    transactionTypeId: input.transactionTypeId ?? null,
    subjectId: input.subjectId ?? null,
    frequency: input.frequency,
    interval: input.interval,
    startDate: input.startDate,
    endDate,
    nextDueDate,
    remindDaysBefore: input.remindDaysBefore,
    remindTime: input.remindTime,
    status: (isScheduleFinished(nextDueDate, endDate) ? 'passive' : 'active') as Status,
  };
}

/** İşlem türünün yönü tahsilatta gelir, ödemede gider olmalı (5.1). */
function assertTransactionType(db: DbOrTx, fields: ReturnType<typeof normalized>) {
  if (!fields.transactionTypeId) return;
  const type = requireRow(
    db
      .select({ direction: transactionTypes.direction })
      .from(transactionTypes)
      .where(eq(transactionTypes.id, fields.transactionTypeId))
      .all()[0],
  );
  if (type.direction !== MOVEMENT_RULES[fields.movementType].transactionTypeDirection) {
    throw new DomainError('transactionTypeMismatch');
  }
}

function selectDetailed(db: DbOrTx, where: SQL | undefined) {
  return db
    .select({
      recurring: r,
      accountName: accounts.name,
      contactName: contacts.name,
      transactionTypeName: transactionTypes.name,
    })
    .from(r)
    .leftJoin(accounts, eq(accounts.id, r.accountId))
    .leftJoin(contacts, eq(contacts.id, r.contactId))
    .leftJoin(transactionTypes, eq(transactionTypes.id, r.transactionTypeId))
    .where(where);
}

function toListItem(row: {
  recurring: RecurringPayment;
  accountName: string | null;
  contactName: string | null;
  transactionTypeName: string | null;
}): RecurringPaymentListItem {
  const { recurring, ...names } = row;
  return {
    ...recurring,
    ...names,
    isFinished: isScheduleFinished(recurring.nextDueDate, recurring.endDate),
  };
}

export function createRecurringPaymentsRepo(db: Db) {
  return {
    /** Aktifler önce, sonra sonraki tarihe göre. Varsayılan: pasifler dahil. */
    async list(options?: {
      activeOnly?: boolean;
      limit?: number;
    }): Promise<RecurringPaymentListItem[]> {
      const query = selectDetailed(
        db,
        live(options?.activeOnly ? eq(r.status, 'active') : undefined),
      ).orderBy(asc(r.status), asc(r.nextDueDate), asc(r.title));
      const rows = options?.limit !== undefined ? query.limit(options.limit).all() : query.all();
      return rows.map(toListItem);
    },

    async getById(id: string): Promise<RecurringPayment> {
      return getSync(db, id);
    },

    async getDetail(id: string): Promise<RecurringPaymentListItem> {
      return toListItem(requireRow(selectDetailed(db, live(eq(r.id, id))).all()[0]));
    },

    async create(input: RecurringPaymentInput): Promise<string> {
      const fields = normalized(input);
      assertTransactionType(db, fields);
      return db
        .insert(r)
        .values({ ...fields, ...(input.currency ? { currency: input.currency } : {}) })
        .returning({ id: r.id })
        .all()[0]!.id;
    },

    /**
     * Tüm alanları günceller. Durum: yeni tarihlerle bitmişse pasif; bittiği için pasif olan kayıt
     * uzatıldıysa yeniden aktif; kullanıcının pasife aldığı kayıt pasif kalır.
     */
    async update(id: string, input: RecurringPaymentInput): Promise<void> {
      const previous = getSync(db, id);
      const fields = normalized(input);
      assertTransactionType(db, fields);
      const wasFinished = isScheduleFinished(previous.nextDueDate, previous.endDate);
      const status: Status =
        fields.status === 'passive' ? 'passive' : wasFinished ? 'active' : previous.status;
      db.update(r)
        .set({ ...fields, status })
        .where(eq(r.id, id))
        .run();
    },

    async setStatus(id: string, status: Status): Promise<void> {
      const row = getSync(db, id);
      if (status === 'active' && isScheduleFinished(row.nextDueDate, row.endDate)) {
        throw new DomainError('recurringEnded');
      }
      db.update(r).set({ status }).where(eq(r.id, id)).run();
    },

    /**
     * "Ödendi" (6.5): ilgili tahsilat/ödeme hareketini oluşturur, sonraki tarihi bir dönem ileri alır.
     * Bitiş tarihi geçilirse düzenli ödeme pasife alınır (tamamlandı). Hepsi tek transaction'da.
     */
    async markPaid(id: string, payment: MarkPaidInput): Promise<MarkPaidResult> {
      return db.transaction((tx) => {
        const row = getSync(tx, id);
        if (row.status !== 'active') throw new DomainError('recurringEnded');
        const transactionId = insertTransaction(tx, {
          movementType: row.movementType,
          amountMinor: payment.amountMinor,
          date: payment.date,
          accountId: payment.accountId,
          contactId: row.contactId,
          transactionTypeId: row.transactionTypeId,
          subjectId: row.subjectId,
          description: row.title,
          recurringPaymentId: row.id,
        });
        const nextDueDate = nextOccurrence(row, row.nextDueDate);
        const isFinished = isScheduleFinished(nextDueDate, row.endDate);
        tx.update(r)
          .set({ nextDueDate, status: isFinished ? 'passive' : row.status })
          .where(eq(r.id, id))
          .run();
        return {
          transactionId,
          nextDueDate,
          isFinished,
          previous: { nextDueDate: row.nextDueDate, status: row.status },
        };
      });
    },

    /** "Ödendi"yi geri alır: oluşan hareket silinir, tarih ve durum eski haline döner. */
    async undoPaid(id: string, result: MarkPaidResult): Promise<void> {
      db.transaction((tx) => {
        tx.update(transactions)
          .set({ deletedAt: new Date() })
          .where(eq(transactions.id, result.transactionId))
          .run();
        tx.update(r)
          .set({ nextDueDate: result.previous.nextDueDate, status: result.previous.status })
          .where(eq(r.id, id))
          .run();
      });
    },

    /** Kurulu bildirimin kimliği; yalnızca değiştiyse yazar (gereksiz değişiklik olayı olmasın). */
    async setNotificationId(id: string, notificationId: string | null): Promise<void> {
      db.update(r)
        .set({ notificationId })
        .where(and(eq(r.id, id), sql`${r.notificationId} IS NOT ${notificationId}`))
        .run();
    },

    async softDelete(id: string): Promise<void> {
      getSync(db, id);
      db.update(r).set({ deletedAt: new Date() }).where(eq(r.id, id)).run();
    },

    async restore(id: string): Promise<void> {
      db.update(r).set({ deletedAt: null }).where(eq(r.id, id)).run();
    },
  };
}

export type RecurringPaymentsRepo = ReturnType<typeof createRecurringPaymentsRepo>;
