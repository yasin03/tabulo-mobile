// Hareket formu doğrulama şeması (PROMPT.md 6.4). Hata mesajları çeviri anahtarıdır (ör. `validation.required`).
// Alanların görünürlüğü ve zorunluluğu MOVEMENT_RULES'tan gelir; repository aynı kuralları ayrıca uygular.

import { z } from 'zod';

import { MOVEMENT_TYPES, OPENING_DIRECTIONS } from '@/db/schema';

import type { Language } from '../i18n';
import {
  effectiveIsCash,
  MOVEMENT_RULES,
  type MovementType,
  type OpeningDirection,
} from '../ledger';
import { formatAmountForInput, parseAmount } from '../money';
import { isIsoDate } from '../validation';

export const DESCRIPTION_MAX_LENGTH = 500;
export const DOCUMENT_NO_MAX_LENGTH = 60;

/** Formdaki ham değerler. Kimlik alanlarında boş metin = seçilmedi. */
export interface TransactionFormValues {
  movementType: MovementType;
  amount: string;
  date: string;
  accountId: string;
  contactId: string;
  transactionTypeId: string;
  subjectId: string;
  description: string;
  documentNo: string;
  dueDate: string;
  openingDirection: OpeningDirection;
  /** Peşin: cari bakiyesini etkilemez (yalnız tahsilat/ödeme + cari). */
  isCash: boolean;
}

/** Doğrulanmış çıktı: hareket tipine ait olmayan alanlar `null`. Repository'ye doğrudan verilir. */
export interface TransactionFormOutput {
  movementType: MovementType;
  amountMinor: number;
  date: string;
  accountId: string | null;
  contactId: string | null;
  transactionTypeId: string | null;
  subjectId: string | null;
  description: string | null;
  documentNo: string | null;
  dueDate: string | null;
  openingDirection: OpeningDirection | null;
  isCash: boolean;
}

export function emptyTransactionForm(
  movementType: MovementType,
  today: string,
): TransactionFormValues {
  return {
    movementType,
    amount: '',
    date: today,
    accountId: '',
    contactId: '',
    transactionTypeId: '',
    subjectId: '',
    description: '',
    documentNo: '',
    dueDate: '',
    openingDirection: 'receivable',
    isCash: false,
  };
}

const orNull = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export function createTransactionFormSchema(options: { language: Language }) {
  const values = z.object({
    movementType: z.enum(MOVEMENT_TYPES),
    amount: z.string(),
    date: z.string(),
    accountId: z.string(),
    contactId: z.string(),
    transactionTypeId: z.string(),
    subjectId: z.string(),
    description: z.string(),
    documentNo: z.string(),
    dueDate: z.string(),
    openingDirection: z.enum(OPENING_DIRECTIONS),
    isCash: z.boolean(),
  });

  return values
    .superRefine((v, ctx) => {
      const issue = (path: keyof TransactionFormValues, message: string) =>
        ctx.addIssue({ code: 'custom', path: [path], message });
      const rule = MOVEMENT_RULES[v.movementType];

      const amount = parseAmount(v.amount, options.language);
      if (!amount.ok) issue('amount', `validation.amount.${amount.error}`);
      else if (amount.minor <= 0) issue('amount', 'validation.amount.notPositive');

      if (!isIsoDate(v.date)) issue('date', 'validation.dateInvalid');
      if (rule.account === 'required' && !v.accountId) issue('accountId', 'validation.required');
      if (rule.contact === 'required' && !v.contactId) issue('contactId', 'validation.required');
      if (rule.dueDate === 'allowed' && v.dueDate && !isIsoDate(v.dueDate)) {
        issue('dueDate', 'validation.dateInvalid');
      }
      if (v.description.trim().length > DESCRIPTION_MAX_LENGTH) {
        issue('description', 'validation.tooLong');
      }
      if (v.documentNo.trim().length > DOCUMENT_NO_MAX_LENGTH) {
        issue('documentNo', 'validation.tooLong');
      }
    })
    .transform((v): TransactionFormOutput => {
      const rule = MOVEMENT_RULES[v.movementType];
      const amount = parseAmount(v.amount, options.language);
      return {
        movementType: v.movementType,
        amountMinor: amount.ok ? amount.minor : 0,
        date: v.date,
        accountId: rule.account === 'required' ? orNull(v.accountId) : null,
        contactId: orNull(v.contactId),
        transactionTypeId: rule.transactionTypeDirection ? orNull(v.transactionTypeId) : null,
        subjectId: orNull(v.subjectId),
        description: orNull(v.description)?.replace(/[ \t]+/g, ' ') ?? null,
        documentNo: orNull(v.documentNo),
        dueDate: rule.dueDate === 'allowed' ? orNull(v.dueDate) : null,
        openingDirection: rule.openingDirection === 'required' ? v.openingDirection : null,
        isCash: effectiveIsCash({ ...v, contactId: orNull(v.contactId) }),
      };
    });
}

/** Düzenleme formu için kayıttan form değerleri. */
export function transactionToFormValues(
  transaction: {
    movementType: MovementType;
    amountMinor: number;
    date: string;
    accountId: string | null;
    contactId: string | null;
    transactionTypeId: string | null;
    subjectId: string | null;
    description: string | null;
    documentNo: string | null;
    dueDate: string | null;
    openingDirection: OpeningDirection | null;
    isCash: boolean;
  },
  language: Language,
): TransactionFormValues {
  return {
    movementType: transaction.movementType,
    amount: formatAmountForInput(transaction.amountMinor, language),
    date: transaction.date,
    accountId: transaction.accountId ?? '',
    contactId: transaction.contactId ?? '',
    transactionTypeId: transaction.transactionTypeId ?? '',
    subjectId: transaction.subjectId ?? '',
    description: transaction.description ?? '',
    documentNo: transaction.documentNo ?? '',
    dueDate: transaction.dueDate ?? '',
    openingDirection: transaction.openingDirection ?? 'receivable',
    isCash: transaction.isCash,
  };
}
