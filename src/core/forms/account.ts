// Hesap (Kasa / Banka) formu doğrulama şeması. Hata mesajları çeviri anahtarıdır.

import { z } from 'zod';

import { ACCOUNT_TYPES } from '@/db/schema';

import type { Language } from '../i18n';
import { formatAmountForInput, parseAmount } from '../money';
import { isValidIban, normalizeIban } from '../validation';

export const ACCOUNT_NAME_MAX_LENGTH = 60;

export interface AccountFormValues {
  type: (typeof ACCOUNT_TYPES)[number];
  name: string;
  bankName: string;
  iban: string;
  /** Açılış bakiyesi; boş = 0. */
  openingBalance: string;
}

export interface AccountFormOutput {
  type: AccountFormValues['type'];
  name: string;
  bankName: string | null;
  iban: string | null;
  openingBalanceMinor: number;
}

export const EMPTY_ACCOUNT_FORM: AccountFormValues = {
  type: 'cash',
  name: '',
  bankName: '',
  iban: '',
  openingBalance: '',
};

const orNull = (value: string) => value.trim() || null;

export function createAccountFormSchema(options: { language: Language }) {
  return z
    .object({
      type: z.enum(ACCOUNT_TYPES),
      name: z.string(),
      bankName: z.string(),
      iban: z.string(),
      openingBalance: z.string(),
    })
    .superRefine((v, ctx) => {
      const issue = (path: keyof AccountFormValues, message: string) =>
        ctx.addIssue({ code: 'custom', path: [path], message });

      const name = v.name.trim();
      if (!name) issue('name', 'validation.required');
      else if (name.length > ACCOUNT_NAME_MAX_LENGTH) issue('name', 'validation.tooLong');

      if (v.type === 'bank' && v.iban.trim() && !isValidIban(v.iban)) {
        issue('iban', 'validation.ibanInvalid');
      }

      if (v.openingBalance.trim()) {
        const parsed = parseAmount(v.openingBalance, options.language);
        if (!parsed.ok) issue('openingBalance', `validation.amount.${parsed.error}`);
      }
    })
    .transform((v): AccountFormOutput => {
      const isBank = v.type === 'bank';
      const opening = v.openingBalance.trim()
        ? parseAmount(v.openingBalance, options.language)
        : null;
      const iban = isBank ? orNull(v.iban) : null;
      return {
        type: v.type,
        name: v.name.trim().replace(/\s+/g, ' '),
        bankName: isBank ? orNull(v.bankName) : null,
        iban: iban ? normalizeIban(iban) : null,
        openingBalanceMinor: opening?.ok ? opening.minor : 0,
      };
    });
}

export function accountToFormValues(
  account: {
    type: AccountFormValues['type'];
    name: string;
    bankName: string | null;
    iban: string | null;
    openingBalanceMinor: number;
  },
  language: Language,
): AccountFormValues {
  return {
    type: account.type,
    name: account.name,
    bankName: account.bankName ?? '',
    iban: account.iban ?? '',
    openingBalance:
      account.openingBalanceMinor > 0
        ? formatAmountForInput(account.openingBalanceMinor, language)
        : '',
  };
}
