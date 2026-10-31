// Hareketler. Alan kuralları src/core/ledger.ts'deki MOVEMENT_RULES / validateMovement'tan gelir.

import { and, asc, desc, eq, gte, inArray, isNull, lte, sql, type SQL } from 'drizzle-orm';

import { DomainError } from '@/core/errors';
import { addDays } from '@/core/dates';
import {
  effectiveIsCash,
  MOVEMENT_RULES,
  openItems,
  validateMovement,
  withRunningBalance,
  type MovementFields,
  type MovementType,
} from '@/core/ledger';
import type { Currency } from '@/core/money';
import { matchesSearch } from '@/core/text';

import {
  accounts,
  attachments,
  businessProfile,
  contacts,
  subjects,
  transactions,
  transactionTypes,
} from '../schema';
import { DEFAULT_PROFILE_ID } from '../seed';
import type { Attachment, Contact, Db, DbOrTx, Transaction } from '../types';
import {
  insertAttachments,
  listAttachmentsSync,
  softDeleteAttachments,
  type AttachmentInput,
} from './attachments';
import { emptyToNull, requireRow } from './shared';

export interface TransactionInput extends MovementFields {
  subjectId?: string | null;
  description?: string | null;
  documentNo?: string | null;
  recurringPaymentId?: string | null;
  /** Verilmezse işletme profilinin para birimi. */
  currency?: Currency;
}

export interface TransactionListFilter {
  contactId?: string;
  accountId?: string;
  movementTypes?: readonly MovementType[];
  /** Dahil, `YYYY-AA-GG`. */
  from?: string;
  /** Dahil, `YYYY-AA-GG`. */
  to?: string;
  limit?: number;
  offset?: number;
}

/** Tüm hareketler ekranının filtreleri (7.8). */
export interface TransactionSearchFilter extends TransactionListFilter {
  transactionTypeId?: string;
  subjectId?: string;
  /** Açıklama ve belge no'da arar; Türkçe karakter ve büyük/küçük harf farkı yok sayılır. */
  search?: string;
}

/** Listelerde gösterilen hareket: bağlı kayıtların adları ve belge sayısıyla. */
export type TransactionListItem = Transaction & {
  contactName: string | null;
  accountName: string | null;
  transactionTypeName: string | null;
  subjectName: string | null;
  attachmentCount: number;
};

export type TransactionDetail = TransactionListItem & { attachments: Attachment[] };

export type TransactionWithRunningBalance = TransactionListItem & { runningBalanceMinor: number };

/** Vadesi gelen / geçmiş açık alacak kalemi (ana sayfa, 7.2). */
export interface DueReceivable {
  contactId: string;
  contactName: string;
  personType: Contact['personType'];
  /** Kalemi açan veresiye satış (veya cariye ödeme). */
  transactionId: string | null;
  dueDate: string;
  remainingMinor: number;
}

/** Formdan gelen belge değişiklikleri. */
export interface AttachmentChanges {
  add?: readonly AttachmentInput[];
  removeIds?: readonly string[];
}

const t = transactions;
const live = (...conditions: (SQL | undefined)[]) => and(isNull(t.deletedAt), ...conditions);

/** Hareketin hareket tipine göre kurallara ve bağlı kayıtlara uygunluğunu kontrol eder. */
function assertValid(
  db: DbOrTx,
  next: MovementFields & { subjectId?: string | null },
  previous?: Transaction,
) {
  const [issue] = validateMovement(next);
  if (issue) throw new DomainError(issue);

  // Pasif kayıtlar yeni harekette seçilemez; ama eski hareket düzenlenirken aynı kayıt kalabilir.
  const changed = (key: 'contactId' | 'accountId' | 'transactionTypeId' | 'subjectId') =>
    !previous || previous[key] !== next[key];

  if (next.contactId) {
    const contact = requireRow(
      db
        .select({ status: contacts.status })
        .from(contacts)
        .where(and(eq(contacts.id, next.contactId), isNull(contacts.deletedAt)))
        .all()[0],
    );
    if (changed('contactId') && contact.status !== 'active')
      throw new DomainError('contactPassive');
  }

  if (next.accountId) {
    const account = requireRow(
      db
        .select({ status: accounts.status })
        .from(accounts)
        .where(and(eq(accounts.id, next.accountId), isNull(accounts.deletedAt)))
        .all()[0],
    );
    if (changed('accountId') && account.status !== 'active')
      throw new DomainError('accountPassive');
  }

  if (next.transactionTypeId) {
    const type = requireRow(
      db
        .select({ direction: transactionTypes.direction, status: transactionTypes.status })
        .from(transactionTypes)
        .where(
          and(eq(transactionTypes.id, next.transactionTypeId), isNull(transactionTypes.deletedAt)),
        )
        .all()[0],
    );
    if (type.direction !== MOVEMENT_RULES[next.movementType].transactionTypeDirection) {
      throw new DomainError('transactionTypeMismatch');
    }
    if (changed('transactionTypeId') && type.status !== 'active') {
      throw new DomainError('transactionTypePassive');
    }
  }

  if (next.subjectId) {
    const subject = requireRow(
      db
        .select({ status: subjects.status })
        .from(subjects)
        .where(and(eq(subjects.id, next.subjectId), isNull(subjects.deletedAt)))
        .all()[0],
    );
    if (changed('subjectId') && subject.status !== 'active')
      throw new DomainError('subjectPassive');
  }
}

/** Hareket tipine ait olmayan alanları NULL'a çeker (ör. tip Tahsilat'tan Veresiye'ye değişince). */
function normalizedFields(input: TransactionInput) {
  return {
    movementType: input.movementType,
    amountMinor: input.amountMinor,
    date: input.date,
    accountId: input.accountId ?? null,
    contactId: input.contactId ?? null,
    transactionTypeId: input.transactionTypeId ?? null,
    subjectId: input.subjectId ?? null,
    openingDirection: input.openingDirection ?? null,
    dueDate: input.dueDate ?? null,
    description: emptyToNull(input.description) ?? null,
    documentNo: emptyToNull(input.documentNo) ?? null,
    recurringPaymentId: input.recurringPaymentId ?? null,
    isCash: effectiveIsCash(input),
  };
}

function profileCurrency(db: DbOrTx): Currency {
  const row = db
    .select({ currency: businessProfile.currency })
    .from(businessProfile)
    .where(eq(businessProfile.id, DEFAULT_PROFILE_ID))
    .all()[0];
  return (row?.currency ?? 'TRY') as Currency;
}

function getSync(db: DbOrTx, id: string): Transaction {
  return requireRow(
    db
      .select()
      .from(t)
      .where(live(eq(t.id, id)))
      .all()[0],
  );
}

/** Hareketi verilen bağlantı/transaction üzerinde ekler (ör. cari + devir aynı transaction'da). */
export function insertTransaction(db: DbOrTx, input: TransactionInput): string {
  const fields = normalizedFields(input);
  assertValid(db, fields);
  return db
    .insert(t)
    .values({ ...fields, currency: input.currency ?? profileCurrency(db) })
    .returning({ id: t.id })
    .all()[0]!.id;
}

/**
 * Hareketler + bağlı kayıtların adları + belge sayısı. Birden fazla tablo olduğu için sütunlar tablo adıyla yazılır.
 * (Silinmiş/pasif bağlı kayıtların adı da gelir: geçmiş hareket olduğu gibi görünür.)
 */
function selectDetailed(db: DbOrTx, where: SQL | undefined) {
  const attachmentStats = db
    .select({
      transactionId: attachments.transactionId,
      count: sql<number>`COUNT(*)`.mapWith(Number).as('attachment_count'),
    })
    .from(attachments)
    .where(isNull(attachments.deletedAt))
    .groupBy(attachments.transactionId)
    .as('attachment_stats');

  return db
    .select({
      transaction: t,
      contactName: contacts.name,
      accountName: accounts.name,
      transactionTypeName: transactionTypes.name,
      subjectName: subjects.name,
      attachmentCount: sql<number>`COALESCE(${attachmentStats.count}, 0)`.mapWith(Number),
    })
    .from(t)
    .leftJoin(contacts, eq(contacts.id, t.contactId))
    .leftJoin(accounts, eq(accounts.id, t.accountId))
    .leftJoin(transactionTypes, eq(transactionTypes.id, t.transactionTypeId))
    .leftJoin(subjects, eq(subjects.id, t.subjectId))
    .leftJoin(attachmentStats, eq(attachmentStats.transactionId, t.id))
    .where(where);
}

type DetailedRow = {
  transaction: Transaction;
  contactName: string | null;
  accountName: string | null;
  transactionTypeName: string | null;
  subjectName: string | null;
  attachmentCount: number;
};

function toListItem({ transaction, ...names }: DetailedRow): TransactionListItem {
  return { ...transaction, ...names };
}

function filterConditions(filter: TransactionSearchFilter) {
  return live(
    filter.contactId ? eq(t.contactId, filter.contactId) : undefined,
    filter.accountId ? eq(t.accountId, filter.accountId) : undefined,
    filter.movementTypes ? inArray(t.movementType, [...filter.movementTypes]) : undefined,
    filter.transactionTypeId ? eq(t.transactionTypeId, filter.transactionTypeId) : undefined,
    filter.subjectId ? eq(t.subjectId, filter.subjectId) : undefined,
    filter.from ? gte(t.date, filter.from) : undefined,
    filter.to ? lte(t.date, filter.to) : undefined,
  );
}

export function createTransactionsRepo(db: Db) {
  return {
    /** Hareketi ve belgelerini tek transaction'da ekler. */
    async create(
      input: TransactionInput,
      newAttachments: readonly AttachmentInput[] = [],
    ): Promise<string> {
      return db.transaction((tx) => {
        const id = insertTransaction(tx, input);
        insertAttachments(tx, id, newAttachments);
        return id;
      });
    },

    /** Hareketi tümüyle yeni değerlerle günceller (form her zaman tüm alanları gönderir). */
    async update(
      id: string,
      input: TransactionInput,
      changes: AttachmentChanges = {},
    ): Promise<void> {
      db.transaction((tx) => {
        const previous = getSync(tx, id);
        const fields = normalizedFields(input);
        assertValid(tx, fields, previous);
        tx.update(t)
          .set({ ...fields, ...(input.currency ? { currency: input.currency } : {}) })
          .where(eq(t.id, id))
          .run();
        softDeleteAttachments(tx, id, changes.removeIds ?? []);
        insertAttachments(tx, id, changes.add ?? []);
      });
    },

    async getById(id: string): Promise<Transaction> {
      return getSync(db, id);
    },

    /** Hareket detayı (7.7): bağlı kayıtların adları ve belgeler. */
    async getDetail(id: string): Promise<TransactionDetail> {
      const row = requireRow(selectDetailed(db, live(eq(t.id, id))).all()[0]);
      return { ...toListItem(row), attachments: listAttachmentsSync(db, id) };
    },

    /** Tüm hareketler ekranı (7.8): filtreler + açıklama/belge no araması. En yeniden eskiye. */
    async search(filter: TransactionSearchFilter = {}): Promise<TransactionListItem[]> {
      const query = selectDetailed(db, filterConditions(filter)).orderBy(
        desc(t.date),
        desc(t.createdAt),
        desc(t.id),
      );
      // Arama JS'te: SQLite LIKE Türkçe harfleri (İ/ı, Ş/ş…) doğru karşılaştırmaz.
      const search = filter.search?.trim();
      // Arama yoksa sayfa SQL'de kesilir (ana sayfadaki son 5 hareket binlerce satırı okumasın).
      if (!search && filter.limit !== undefined) {
        return query
          .limit(filter.limit)
          .offset(filter.offset ?? 0)
          .all()
          .map(toListItem);
      }
      const rows = query.all().map(toListItem);
      const matched = search
        ? rows.filter((r) => matchesSearch(search, r.description, r.documentNo))
        : rows;
      if (filter.limit === undefined) return matched;
      const offset = filter.offset ?? 0;
      return matched.slice(offset, offset + filter.limit);
    },

    /** En yeniden eskiye. */
    async list(filter: TransactionListFilter = {}): Promise<Transaction[]> {
      const query = db
        .select()
        .from(t)
        .where(
          live(
            filter.contactId ? eq(t.contactId, filter.contactId) : undefined,
            filter.accountId ? eq(t.accountId, filter.accountId) : undefined,
            filter.movementTypes ? inArray(t.movementType, [...filter.movementTypes]) : undefined,
            filter.from ? gte(t.date, filter.from) : undefined,
            filter.to ? lte(t.date, filter.to) : undefined,
          ),
        )
        .orderBy(desc(t.date), desc(t.createdAt), desc(t.id));
      if (filter.limit !== undefined) {
        return query
          .limit(filter.limit)
          .offset(filter.offset ?? 0)
          .all();
      }
      return query.all();
    },

    /**
     * Cari detayındaki liste: her satırda o anki yürüyen bakiye (7.4).
     * Bakiye eskiden yeniye biriktirilir, liste en yeniden eskiye döner.
     */
    async listForContact(contactId: string): Promise<TransactionWithRunningBalance[]> {
      const chronological = selectDetailed(db, live(eq(t.contactId, contactId)))
        .orderBy(asc(t.date), asc(t.createdAt), asc(t.id))
        .all()
        .map(toListItem);
      return withRunningBalance(chronological).reverse();
    },

    /** En eski hareketin tarihi (ay seçicinin başlangıcı); hareket yoksa `null`. */
    async firstDate(): Promise<string | null> {
      const row = db
        .select({ date: sql<string | null>`MIN(${t.date})` })
        .from(t)
        .where(live())
        .all()[0];
      return row?.date ?? null;
    },

    /**
     * Vadesi geçmiş veya `horizonDays` gün içinde dolacak açık alacaklar (7.2).
     * Açık kalemler cari başına FIFO ile bulunur (Faz 3 kararı, `openItems`); en erken vade önce.
     */
    async dueReceivables(today: string, horizonDays = 7): Promise<DueReceivable[]> {
      const limit = addDays(today, horizonDays);
      const rows = db
        .select({
          id: t.id,
          contactId: t.contactId,
          movementType: t.movementType,
          amountMinor: t.amountMinor,
          openingDirection: t.openingDirection,
          isCash: t.isCash,
          dueDate: t.dueDate,
          contactName: contacts.name,
          personType: contacts.personType,
        })
        .from(t)
        .innerJoin(contacts, eq(contacts.id, t.contactId))
        .where(live(isNull(contacts.deletedAt)))
        .orderBy(asc(t.contactId), asc(t.date), asc(t.createdAt), asc(t.id))
        .all();

      const byContact = new Map<string, typeof rows>();
      for (const row of rows) {
        const list = byContact.get(row.contactId!) ?? [];
        list.push(row);
        byContact.set(row.contactId!, list);
      }

      const result: DueReceivable[] = [];
      for (const [contactId, movements] of byContact) {
        const first = movements[0]!;
        for (const item of openItems(movements)) {
          if (item.side !== 'receivable' || !item.dueDate || item.dueDate > limit) continue;
          result.push({
            contactId,
            contactName: first.contactName,
            personType: first.personType,
            transactionId: item.sourceId ?? null,
            dueDate: item.dueDate,
            remainingMinor: item.remainingMinor,
          });
        }
      }
      return result.sort(
        (a, b) => a.dueDate.localeCompare(b.dueDate) || b.remainingMinor - a.remainingMinor,
      );
    },

    /** Silinmemiş hareket sayısı (boş durum ekranı için). */
    async count(): Promise<number> {
      const row = db
        .select({ count: sql<number>`COUNT(*)`.mapWith(Number) })
        .from(t)
        .where(live())
        .all()[0];
      return row?.count ?? 0;
    },

    /** Yumuşak silme; 5 sn "Geri al" için `restore` kullanılır (5.1). */
    async softDelete(id: string): Promise<void> {
      getSync(db, id);
      db.update(t).set({ deletedAt: new Date() }).where(eq(t.id, id)).run();
    },

    async restore(id: string): Promise<void> {
      db.update(t).set({ deletedAt: null }).where(eq(t.id, id)).run();
    },
  };
}

export type TransactionsRepo = ReturnType<typeof createTransactionsRepo>;
