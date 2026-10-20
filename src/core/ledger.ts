// Hareket etkileri ve bakiye hesapları (PROMPT.md 5.1).
// Tek doğruluk kaynağı şemadaki MOVEMENT_EFFECT'tir; SQL tarafı (src/db/ledgerSql.ts) da ondan üretilir.

import {
  MOVEMENT_EFFECT,
  type DIRECTIONS,
  type MOVEMENT_TYPES,
  type OPENING_DIRECTIONS,
} from '@/db/schema';

import { isIsoDate } from './validation';

export type MovementType = (typeof MOVEMENT_TYPES)[number];
export type OpeningDirection = (typeof OPENING_DIRECTIONS)[number];
export type Direction = (typeof DIRECTIONS)[number];
export type Effect = -1 | 0 | 1;

export interface LedgerMovement {
  movementType: MovementType;
  amountMinor: number;
  openingDirection?: OpeningDirection | null;
}

/** Cari bakiyesine etki: + cari bize borçlanır, − biz cariye borçlanırız. Devirde yönü openingDirection belirler. */
export function contactEffect(
  m: Pick<LedgerMovement, 'movementType' | 'openingDirection'>,
): Effect {
  const effect = MOVEMENT_EFFECT[m.movementType].contact;
  if (m.movementType === 'opening' && m.openingDirection === 'payable') return negate(effect);
  return effect;
}

/** Kasa/banka bakiyesine etki: + para girer, − para çıkar. */
export function accountEffect(m: Pick<LedgerMovement, 'movementType'>): Effect {
  return MOVEMENT_EFFECT[m.movementType].account;
}

function negate(effect: Effect): Effect {
  return effect === 0 ? 0 : (-effect as Effect);
}

export function contactDelta(m: LedgerMovement): number {
  return contactEffect(m) * m.amountMinor;
}

export function accountDelta(m: LedgerMovement): number {
  return accountEffect(m) * m.amountMinor;
}

/** Cari bakiyesi (kuruş). Pozitif: cari bize borçlu ("Size borçlu"); negatif: biz borçluyuz ("Borcunuz"). */
export function contactBalance(movements: readonly LedgerMovement[]): number {
  return movements.reduce((sum, m) => sum + contactDelta(m), 0);
}

/** Kasa/banka bakiyesi (kuruş) = açılış bakiyesi + giriş − çıkış. */
export function accountBalance(openingBalanceMinor: number, movements: readonly LedgerMovement[]) {
  return movements.reduce((sum, m) => sum + accountDelta(m), openingBalanceMinor);
}

/**
 * Cari detayındaki yürüyen bakiye. Hareketler kronolojik sırada (eskiden yeniye) verilmelidir.
 * Her satıra, o hareket dahil o ana kadarki cari bakiyesi eklenir.
 */
export function withRunningBalance<T extends LedgerMovement>(
  movements: readonly T[],
  startingBalanceMinor = 0,
): (T & { runningBalanceMinor: number })[] {
  let running = startingBalanceMinor;
  return movements.map((m) => {
    running += contactDelta(m);
    return { ...m, runningBalanceMinor: running };
  });
}

export type BalanceState = 'receivable' | 'payable' | 'settled';

/** "Size borçlu" / "Borcunuz" / "Hesap kapalı". */
export function balanceState(balanceMinor: number): BalanceState {
  if (balanceMinor > 0) return 'receivable';
  if (balanceMinor < 0) return 'payable';
  return 'settled';
}

// ---------- Hareket tipine göre alan kuralları ----------

export interface MovementRule {
  account: 'required' | 'forbidden';
  contact: 'required' | 'optional';
  openingDirection: 'required' | 'forbidden';
  dueDate: 'allowed' | 'forbidden';
  /** Seçilebilecek işlem türlerinin yönü; `null` ise işlem türü alanı gizli. */
  transactionTypeDirection: Direction | null;
}

export const MOVEMENT_RULES: Record<MovementType, MovementRule> = {
  collection: {
    account: 'required',
    contact: 'optional',
    openingDirection: 'forbidden',
    dueDate: 'forbidden',
    transactionTypeDirection: 'income',
  },
  payment: {
    account: 'required',
    contact: 'optional',
    openingDirection: 'forbidden',
    dueDate: 'forbidden',
    transactionTypeDirection: 'expense',
  },
  credit_sale: {
    account: 'forbidden',
    contact: 'required',
    openingDirection: 'forbidden',
    dueDate: 'allowed',
    transactionTypeDirection: 'income',
  },
  credit_purchase: {
    account: 'forbidden',
    contact: 'required',
    openingDirection: 'forbidden',
    dueDate: 'allowed',
    transactionTypeDirection: 'expense',
  },
  opening: {
    account: 'forbidden',
    contact: 'required',
    openingDirection: 'required',
    dueDate: 'forbidden',
    transactionTypeDirection: null,
  },
};

export interface MovementFields {
  movementType: MovementType;
  amountMinor: number;
  date: string;
  accountId?: string | null;
  contactId?: string | null;
  transactionTypeId?: string | null;
  openingDirection?: OpeningDirection | null;
  dueDate?: string | null;
}

export type MovementIssue =
  | 'amountNotPositive'
  | 'invalidDate'
  | 'accountRequired'
  | 'accountNotAllowed'
  | 'contactRequired'
  | 'openingDirectionRequired'
  | 'openingDirectionNotAllowed'
  | 'dueDateNotAllowed'
  | 'invalidDueDate'
  | 'transactionTypeNotAllowed';

/** Hareketin hareket tipine göre tutarlı olup olmadığını kontrol eder. Boş dizi = geçerli. */
export function validateMovement(m: MovementFields): MovementIssue[] {
  const rule = MOVEMENT_RULES[m.movementType];
  const issues: MovementIssue[] = [];

  if (!Number.isSafeInteger(m.amountMinor) || m.amountMinor <= 0) issues.push('amountNotPositive');
  if (!isIsoDate(m.date)) issues.push('invalidDate');

  if (rule.account === 'required' && !m.accountId) issues.push('accountRequired');
  if (rule.account === 'forbidden' && m.accountId) issues.push('accountNotAllowed');

  if (rule.contact === 'required' && !m.contactId) issues.push('contactRequired');

  if (rule.openingDirection === 'required' && !m.openingDirection) {
    issues.push('openingDirectionRequired');
  }
  if (rule.openingDirection === 'forbidden' && m.openingDirection) {
    issues.push('openingDirectionNotAllowed');
  }

  if (m.dueDate) {
    if (rule.dueDate === 'forbidden') issues.push('dueDateNotAllowed');
    else if (!isIsoDate(m.dueDate)) issues.push('invalidDueDate');
  }

  if (rule.transactionTypeDirection === null && m.transactionTypeId) {
    issues.push('transactionTypeNotAllowed');
  }

  return issues;
}

// ---------- Gösterim: işaret ve renk (4.3) ----------

export type AmountTone = 'positive' | 'negative' | 'neutral';

export interface MovementDisplay {
  /** Tutarın önündeki işaret: +1 → `+`, −1 → `−`. */
  sign: -1 | 1;
  tone: AmountTone;
}

const toneOf = (effect: Effect): AmountTone =>
  effect > 0 ? 'positive' : effect < 0 ? 'negative' : 'neutral';

/**
 * Genel listelerde (tüm hareketler, hareket detayı): tahsilat/ödemede para akışı (+ giriş, − çıkış),
 * veresiye ve devirde cari etkisi (+ alacak, − borç). Renk işarete uyar.
 */
export function generalDisplay(m: Pick<LedgerMovement, 'movementType' | 'openingDirection'>) {
  const account = accountEffect(m);
  const effect = account !== 0 ? account : contactEffect(m);
  return { sign: effect < 0 ? -1 : 1, tone: toneOf(effect) } satisfies MovementDisplay;
}

/**
 * Cari detayında (client-detail.html): işaret cari bakiyesine etkidir (tahsilat `−`),
 * renk para akışıdır (tahsilat yeşil, ödeme kırmızı, veresiye ve devir nötr).
 */
export function contactViewDisplay(m: Pick<LedgerMovement, 'movementType' | 'openingDirection'>) {
  const effect = contactEffect(m);
  return {
    sign: effect < 0 ? -1 : 1,
    tone: toneOf(accountEffect(m)),
  } satisfies MovementDisplay;
}

// ---------- Vade: FIFO ile açık kalan borçlar ----------

export interface DueMovement extends LedgerMovement {
  /** Kalemi açan hareketin kimliği (varsa `OpenItem.sourceId` olur). */
  id?: string;
  dueDate?: string | null;
}

export interface OpenItem {
  /** `receivable`: cari bize borçlu; `payable`: biz cariye borçluyuz. */
  side: Exclude<BalanceState, 'settled'>;
  /** Bu kalemden henüz kapanmamış tutar (kuruş, > 0). */
  remainingMinor: number;
  dueDate: string | null;
  sourceId?: string;
}

/**
 * Hareketler belirli bir veresiyeye bağlanmaz; açık kalan kalemler FIFO ile bulunur (kullanıcı kararı, Faz 3):
 * cari bakiyesini artıran her hareket bir borç kalemi açar, ters yöndeki hareketler en eski kalemden başlayarak kapatır.
 * Hareketler kronolojik sırada (eskiden yeniye) verilmelidir. Dönen kalemlerin toplamı bakiyeye eşittir.
 */
export function openItems(movements: readonly DueMovement[]): OpenItem[] {
  const queues: Record<OpenItem['side'], OpenItem[]> = { receivable: [], payable: [] };

  for (const m of movements) {
    const delta = contactDelta(m);
    if (delta === 0) continue;
    const side: OpenItem['side'] = delta > 0 ? 'receivable' : 'payable';
    const opposite = queues[side === 'receivable' ? 'payable' : 'receivable'];
    let amount = Math.abs(delta);

    // Önce karşı taraftaki en eski açık kalemleri kapat.
    while (amount > 0 && opposite.length > 0) {
      const head = opposite[0]!;
      const used = Math.min(head.remainingMinor, amount);
      head.remainingMinor -= used;
      amount -= used;
      if (head.remainingMinor === 0) opposite.shift();
    }
    if (amount > 0) {
      queues[side].push({
        side,
        remainingMinor: amount,
        dueDate: m.dueDate ?? null,
        sourceId: m.id,
      });
    }
  }

  return [...queues.receivable, ...queues.payable];
}

export interface DueInfo {
  dueDate: string;
  side: OpenItem['side'];
  /** Bu vadede açık kalan tutar (kuruş). */
  remainingMinor: number;
}

/**
 * Cari detayındaki "en yakın vade" etiketi: açık kalan kalemlerden vadesi en erken olan.
 * Vadesi geçmiş kalem varsa o gelir (en acil olan). Vadeli açık kalem yoksa `null`.
 */
export function nearestDue(movements: readonly DueMovement[]): DueInfo | null {
  let best: DueInfo | null = null;
  for (const item of openItems(movements)) {
    if (!item.dueDate) continue;
    if (!best || item.dueDate < best.dueDate) {
      best = { dueDate: item.dueDate, side: item.side, remainingMinor: item.remainingMinor };
    }
  }
  return best;
}
