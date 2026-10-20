// Cariler. Bakiye saklanmaz; MOVEMENT_EFFECT'ten üretilen SQL ile hesaplanır (5.1).

import { and, eq, inArray, isNull, lte, sql, type SQL } from 'drizzle-orm';

import { DomainError } from '@/core/errors';
import type { OpeningDirection } from '@/core/ledger';
import { matchesSearch } from '@/core/text';

import { contactDeltaSql, liveTransactions, sumOrZero } from '../ledgerSql';
import { contacts, type CONTACT_ROLES, type PERSON_TYPES, transactions } from '../schema';
import type { Contact, Db, Status } from '../types';
import { definedOnly, emptyToNull, requireName, requireRow } from './shared';
import { insertTransaction } from './transactions';

export type PersonType = (typeof PERSON_TYPES)[number];
export type ContactRole = (typeof CONTACT_ROLES)[number];

export interface ContactInput {
  personType: PersonType;
  role: ContactRole;
  name: string;
  nationalId?: string | null;
  taxNumber?: string | null;
  taxOffice?: string | null;
  city?: string | null;
  district?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  note?: string | null;
  status?: Status;
}

/** Cari eklerken isteğe bağlı açılış bakiyesi → otomatik Devir hareketi (6.2). */
export interface OpeningBalanceInput {
  amountMinor: number;
  direction: OpeningDirection;
  date: string;
}

export type ContactSort = 'name' | 'balance' | 'lastActivity';

export interface ContactListFilter {
  /** Ad, telefon, il, ilçe ve vergi/TC no'da arar; Türkçe karakter ve büyük/küçük harf farkı yok sayılır. */
  search?: string;
  /** `customer` / `supplier` seçilince "İkisi" olanlar da gelir. */
  role?: Exclude<ContactRole, 'both'>;
  /** Varsayılan: `active`. */
  status?: Status | 'all';
  /** `receivable`: cari bize borçlu (bakiye > 0) — "Borçlu olanlar"; `payable`: biz cariye borçluyuz (bakiye < 0) — "Alacaklı olanlar". */
  balance?: 'receivable' | 'payable';
  sort?: ContactSort;
  /** Ada göre sıralamanın dili (Türk alfabesi: Ç, Ğ, İ, Ö, Ş, Ü doğru yerde). Varsayılan `tr`. */
  locale?: string;
}

export type ContactWithBalance = Contact & {
  balanceMinor: number;
  lastActivityDate: string | null;
};

export interface ContactTotals {
  /** Toplam alacak (bize borçlu carilerin bakiyeleri toplamı, ≥ 0). */
  receivableMinor: number;
  /** Toplam borç (bizim borçlu olduğumuz carilerin bakiyeleri toplamı, ≥ 0). */
  payableMinor: number;
  /** Net bakiye = alacak − borç. */
  netMinor: number;
}

/** Kişi türüne ait olmayan kimlik alanlarını temizler: şahısta vergi bilgisi, şirkette TC tutulmaz. */
function identityFields(personType: PersonType, input: Partial<ContactInput>) {
  if (personType === 'individual') {
    return { nationalId: emptyToNull(input.nationalId), taxNumber: null, taxOffice: null };
  }
  return {
    nationalId: null,
    taxNumber: emptyToNull(input.taxNumber),
    taxOffice: emptyToNull(input.taxOffice),
  };
}

export function createContactsRepo(db: Db) {
  const c = contacts;
  const live = (...conditions: (SQL | undefined)[]) => and(isNull(c.deletedAt), ...conditions);

  function getSync(id: string): Contact {
    return requireRow(
      db
        .select()
        .from(c)
        .where(live(eq(c.id, id)))
        .all()[0],
    );
  }

  return {
    async list(filter: ContactListFilter = {}): Promise<ContactWithBalance[]> {
      const status = filter.status ?? 'active';

      // Cari başına bakiye ve son hareket tarihi; carilere LEFT JOIN ile bağlanır.
      // (İlişkili alt sorgu kullanılmaz: Drizzle tek tablolu sorguda sütunları tablo adı olmadan yazar.)
      const stats = db
        .select({
          contactId: transactions.contactId,
          balance: sumOrZero(contactDeltaSql()).as('balance'),
          lastDate: sql<string>`MAX(${transactions.date})`.as('last_date'),
        })
        .from(transactions)
        .where(liveTransactions())
        .groupBy(transactions.contactId)
        .as('contact_stats');
      const balanceSql = sql<number>`COALESCE(${stats.balance}, 0)`.mapWith(Number);

      const rows = db
        .select({ contact: c, balanceMinor: balanceSql, lastActivityDate: stats.lastDate })
        .from(c)
        .leftJoin(stats, eq(stats.contactId, c.id))
        .where(
          live(
            status === 'all' ? undefined : eq(c.status, status),
            filter.role ? inArray(c.role, [filter.role, 'both']) : undefined,
            filter.balance === 'receivable' ? sql`${balanceSql} > 0` : undefined,
            filter.balance === 'payable' ? sql`${balanceSql} < 0` : undefined,
          ),
        )
        .all()
        .map((row): ContactWithBalance => ({
          ...row.contact,
          balanceMinor: row.balanceMinor,
          lastActivityDate: row.lastActivityDate,
        }));

      // Arama ve sıralama JS'te: SQLite LIKE / NOCASE Türkçe harfleri (İ/ı, Ş/ş…) doğru karşılaştırmaz.
      // 1.000+ caride bile bellekte filtrelemek anlıktır.
      const search = filter.search?.trim();
      const matched = search
        ? rows.filter((r) =>
            matchesSearch(search, r.name, r.phone, r.city, r.district, r.taxNumber, r.nationalId),
          )
        : rows;

      const collator = new Intl.Collator(filter.locale ?? 'tr', { sensitivity: 'base' });
      const byName = (x: ContactWithBalance, y: ContactWithBalance) =>
        collator.compare(x.name, y.name);
      const comparators: Record<
        ContactSort,
        (x: ContactWithBalance, y: ContactWithBalance) => number
      > = {
        name: byName,
        balance: (x, y) => y.balanceMinor - x.balanceMinor || byName(x, y),
        lastActivity: (x, y) =>
          (y.lastActivityDate ?? '').localeCompare(x.lastActivityDate ?? '') || byName(x, y),
      };
      return matched.sort(comparators[filter.sort ?? 'name']);
    },

    async getById(id: string): Promise<Contact> {
      return getSync(id);
    },

    /** Cari bakiyesi (kuruş). Pozitif: cari bize borçlu; negatif: biz borçluyuz. */
    async balance(id: string): Promise<number> {
      getSync(id);
      const row = db
        .select({ value: sumOrZero(contactDeltaSql()) })
        .from(transactions)
        .where(liveTransactions(eq(transactions.contactId, id)))
        .all()[0];
      return row?.value ?? 0;
    },

    /**
     * Ana sayfa özet kartı: toplam alacak, toplam borç, net (pasif cariler dahil).
     * `asOf` verilirse o günün sonundaki durum (ay seçici: seçilen ayın son günü).
     */
    async totals(asOf?: string): Promise<ContactTotals> {
      const perContact = db
        .select({ balance: sumOrZero(contactDeltaSql()).as('balance') })
        .from(transactions)
        .innerJoin(c, eq(c.id, transactions.contactId))
        .where(
          liveTransactions(isNull(c.deletedAt), asOf ? lte(transactions.date, asOf) : undefined),
        )
        .groupBy(transactions.contactId)
        .as('per_contact');
      const row = db
        .select({
          receivable:
            sql<number>`COALESCE(SUM(CASE WHEN ${perContact.balance} > 0 THEN ${perContact.balance} END), 0)`.mapWith(
              Number,
            ),
          payable:
            sql<number>`COALESCE(-SUM(CASE WHEN ${perContact.balance} < 0 THEN ${perContact.balance} END), 0)`.mapWith(
              Number,
            ),
        })
        .from(perContact)
        .all()[0];
      const receivableMinor = row?.receivable ?? 0;
      const payableMinor = row?.payable ?? 0;
      return { receivableMinor, payableMinor, netMinor: receivableMinor - payableMinor };
    },

    /** Silinmemiş tüm cariler (aktif + pasif). Boş durum ekranı için. */
    async count(): Promise<number> {
      const row = db
        .select({ count: sql<number>`COUNT(*)`.mapWith(Number) })
        .from(c)
        .where(live())
        .all()[0];
      return row?.count ?? 0;
    },

    /** Ücretsiz plan sınırı için (6.8). */
    async countActive(): Promise<number> {
      const row = db
        .select({ count: sql<number>`COUNT(*)`.mapWith(Number) })
        .from(c)
        .where(live(eq(c.status, 'active')))
        .all()[0];
      return row?.count ?? 0;
    },

    /** Cariyi ekler; açılış bakiyesi verildiyse aynı transaction içinde Devir hareketi oluşturur. */
    async create(input: ContactInput, opening?: OpeningBalanceInput): Promise<string> {
      const name = requireName(input.name);
      return db.transaction((tx) => {
        const id = tx
          .insert(c)
          .values({
            personType: input.personType,
            role: input.role,
            name,
            ...identityFields(input.personType, input),
            city: emptyToNull(input.city),
            district: emptyToNull(input.district),
            address: emptyToNull(input.address),
            phone: emptyToNull(input.phone),
            email: emptyToNull(input.email),
            note: emptyToNull(input.note),
            status: input.status,
          })
          .returning({ id: c.id })
          .all()[0]!.id;

        if (opening) {
          insertTransaction(tx, {
            movementType: 'opening',
            contactId: id,
            amountMinor: opening.amountMinor,
            openingDirection: opening.direction,
            date: opening.date,
          });
        }
        return id;
      });
    },

    async update(id: string, patch: Partial<ContactInput>): Promise<void> {
      const existing = getSync(id);
      const personType = patch.personType ?? existing.personType;
      const touchesIdentity =
        patch.personType !== undefined ||
        patch.nationalId !== undefined ||
        patch.taxNumber !== undefined ||
        patch.taxOffice !== undefined;

      db.update(c)
        .set(
          definedOnly({
            personType: patch.personType,
            role: patch.role,
            name: patch.name === undefined ? undefined : requireName(patch.name),
            ...(touchesIdentity ? identityFields(personType, { ...existing, ...patch }) : {}),
            city: emptyToNull(patch.city),
            district: emptyToNull(patch.district),
            address: emptyToNull(patch.address),
            phone: emptyToNull(patch.phone),
            email: emptyToNull(patch.email),
            note: emptyToNull(patch.note),
            status: patch.status,
          }),
        )
        .where(eq(c.id, id))
        .run();
    },

    async setStatus(id: string, status: Status): Promise<void> {
      getSync(id);
      db.update(c).set({ status }).where(eq(c.id, id)).run();
    },

    /** Hareketi olan cari silinemez, yalnızca pasife alınabilir (7.4). */
    async softDelete(id: string): Promise<void> {
      getSync(id);
      const used = db
        .select({ id: transactions.id })
        .from(transactions)
        .where(liveTransactions(eq(transactions.contactId, id)))
        .limit(1)
        .all()[0];
      if (used) throw new DomainError('contactHasTransactions');
      db.update(c).set({ deletedAt: new Date() }).where(eq(c.id, id)).run();
    },

    /** Yumuşak silmeyi geri alır ("Geri al" toast'ı, 5.1). */
    async restore(id: string): Promise<void> {
      db.update(c).set({ deletedAt: null }).where(eq(c.id, id)).run();
    },
  };
}

export type ContactsRepo = ReturnType<typeof createContactsRepo>;
