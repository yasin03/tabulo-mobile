// Düzenli ödeme formu doğrulama şeması (PROMPT.md 6.5). Hata mesajları çeviri anahtarıdır.

import { z } from 'zod';

import { FREQUENCIES } from '@/db/schema';

import { isTimeOfDay } from '../dates';
import type { Language } from '../i18n';
import { formatAmountForInput, parseAmount } from '../money';
import { MAX_INTERVAL, MAX_REMIND_DAYS_BEFORE, type Frequency } from '../recurrence';
import { isIsoDate } from '../validation';

export const RECURRING_TITLE_MAX_LENGTH = 60;
export const RECURRING_MOVEMENT_TYPES = ['payment', 'collection'] as const;
export type RecurringMovementType = (typeof RECURRING_MOVEMENT_TYPES)[number];

/** Formda sunulan "kaç gün önce" seçenekleri. */
export const REMIND_DAYS_OPTIONS = [0, 1, 3, 7] as const;

export interface RecurringFormValues {
  title: string;
  movementType: RecurringMovementType;
  amount: string;
  accountId: string;
  contactId: string;
  transactionTypeId: string;
  subjectId: string;
  frequency: Frequency;
  interval: number;
  /** Yeni kayıtta ilk ödeme, düzenlemede sonraki ödeme tarihi. */
  dueDate: string;
  endDate: string;
  remindDaysBefore: number;
  remindTime: string;
}

export interface RecurringFormOutput {
  title: string;
  movementType: RecurringMovementType;
  amountMinor: number;
  accountId: string;
  contactId: string | null;
  transactionTypeId: string | null;
  subjectId: string | null;
  frequency: Frequency;
  interval: number;
  dueDate: string;
  endDate: string | null;
  remindDaysBefore: number;
  remindTime: string;
}

export function emptyRecurringForm(today: string, remindTime: string): RecurringFormValues {
  return {
    title: '',
    movementType: 'payment',
    amount: '',
    accountId: '',
    contactId: '',
    transactionTypeId: '',
    subjectId: '',
    frequency: 'monthly',
    interval: 1,
    dueDate: today,
    endDate: '',
    remindDaysBefore: 1,
    remindTime,
  };
}

const orNull = (value: string) => value.trim() || null;

export function createRecurringFormSchema(options: { language: Language }) {
  return z
    .object({
      title: z.string(),
      movementType: z.enum(RECURRING_MOVEMENT_TYPES),
      amount: z.string(),
      accountId: z.string(),
      contactId: z.string(),
      transactionTypeId: z.string(),
      subjectId: z.string(),
      frequency: z.enum(FREQUENCIES),
      interval: z.number(),
      dueDate: z.string(),
      endDate: z.string(),
      remindDaysBefore: z.number(),
      remindTime: z.string(),
    })
    .superRefine((v, ctx) => {
      const issue = (path: keyof RecurringFormValues, message: string) =>
        ctx.addIssue({ code: 'custom', path: [path], message });

      const title = v.title.trim();
      if (!title) issue('title', 'validation.required');
      else if (title.length > RECURRING_TITLE_MAX_LENGTH) issue('title', 'validation.tooLong');

      const amount = parseAmount(v.amount, options.language);
      if (!amount.ok) issue('amount', `validation.amount.${amount.error}`);
      else if (amount.minor <= 0) issue('amount', 'validation.amount.notPositive');

      if (!v.accountId) issue('accountId', 'validation.required');
      if (!Number.isInteger(v.interval) || v.interval < 1 || v.interval > MAX_INTERVAL) {
        issue('interval', 'validation.intervalInvalid');
      }
      if (!isIsoDate(v.dueDate)) issue('dueDate', 'validation.dateInvalid');
      if (v.endDate) {
        if (!isIsoDate(v.endDate)) issue('endDate', 'validation.dateInvalid');
        else if (isIsoDate(v.dueDate) && v.endDate < v.dueDate) {
          issue('endDate', 'validation.endBeforeStart');
        }
      }
      if (
        !Number.isInteger(v.remindDaysBefore) ||
        v.remindDaysBefore < 0 ||
        v.remindDaysBefore > MAX_REMIND_DAYS_BEFORE
      ) {
        issue('remindDaysBefore', 'validation.required');
      }
      if (!isTimeOfDay(v.remindTime)) issue('remindTime', 'validation.timeInvalid');
    })
    .transform((v): RecurringFormOutput => {
      const amount = parseAmount(v.amount, options.language);
      return {
        title: v.title.trim().replace(/\s+/g, ' '),
        movementType: v.movementType,
        amountMinor: amount.ok ? amount.minor : 0,
        accountId: v.accountId,
        contactId: orNull(v.contactId),
        transactionTypeId: orNull(v.transactionTypeId),
        subjectId: orNull(v.subjectId),
        frequency: v.frequency,
        interval: v.interval,
        dueDate: v.dueDate,
        endDate: orNull(v.endDate),
        remindDaysBefore: v.remindDaysBefore,
        remindTime: v.remindTime,
      };
    });
}

export function recurringToFormValues(
  row: {
    title: string;
    movementType: RecurringMovementType;
    amountMinor: number;
    accountId: string | null;
    contactId: string | null;
    transactionTypeId: string | null;
    subjectId: string | null;
    frequency: Frequency;
    interval: number;
    nextDueDate: string;
    endDate: string | null;
    remindDaysBefore: number;
    remindTime: string;
  },
  language: Language,
): RecurringFormValues {
  return {
    title: row.title,
    movementType: row.movementType,
    amount: formatAmountForInput(row.amountMinor, language),
    accountId: row.accountId ?? '',
    contactId: row.contactId ?? '',
    transactionTypeId: row.transactionTypeId ?? '',
    subjectId: row.subjectId ?? '',
    frequency: row.frequency,
    interval: row.interval,
    dueDate: row.nextDueDate,
    endDate: row.endDate ?? '',
    remindDaysBefore: row.remindDaysBefore,
    remindTime: row.remindTime,
  };
}

// ---------- "Ödendi" (6.5): tutar ve tarih ödeme anında düzenlenebilir ----------

export interface PaymentFormValues {
  amount: string;
  date: string;
  accountId: string;
}

export interface PaymentFormOutput {
  amountMinor: number;
  date: string;
  accountId: string;
}

export function createPaymentFormSchema(options: { language: Language }) {
  return z
    .object({ amount: z.string(), date: z.string(), accountId: z.string() })
    .superRefine((v, ctx) => {
      const issue = (path: keyof PaymentFormValues, message: string) =>
        ctx.addIssue({ code: 'custom', path: [path], message });
      const amount = parseAmount(v.amount, options.language);
      if (!amount.ok) issue('amount', `validation.amount.${amount.error}`);
      else if (amount.minor <= 0) issue('amount', 'validation.amount.notPositive');
      if (!isIsoDate(v.date)) issue('date', 'validation.dateInvalid');
      if (!v.accountId) issue('accountId', 'validation.required');
    })
    .transform((v): PaymentFormOutput => {
      const amount = parseAmount(v.amount, options.language);
      return { amountMinor: amount.ok ? amount.minor : 0, date: v.date, accountId: v.accountId };
    });
}
