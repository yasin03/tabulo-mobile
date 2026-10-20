// Cari formu doğrulama şeması (PROMPT.md 6.2). Hata mesajları çeviri anahtarıdır (ör. `validation.required`).

import { z } from 'zod';

import { PERSON_TYPES, CONTACT_ROLES, OPENING_DIRECTIONS, STATUS } from '@/db/schema';

import type { Language } from '../i18n';
import { parseAmount } from '../money';
import {
  nationalIdIssue,
  isValidTaxNumber,
  normalizePhone,
  type PhoneCountry,
} from '../validation';

export const NAME_MAX_LENGTH = 120;

/** Formdaki ham değerler (metin alanları her zaman string). */
export interface ContactFormValues {
  personType: (typeof PERSON_TYPES)[number];
  role: (typeof CONTACT_ROLES)[number];
  name: string;
  nationalId: string;
  taxNumber: string;
  taxOffice: string;
  city: string;
  district: string;
  address: string;
  phone: string;
  email: string;
  note: string;
  status: (typeof STATUS)[number];
  /** Yalnızca yeni caride: açılış bakiyesi (boş = yok). */
  openingAmount: string;
  openingDirection: (typeof OPENING_DIRECTIONS)[number];
}

/** Doğrulanmış ve normalize edilmiş çıktı: repository'ye doğrudan verilir. */
export interface ContactFormOutput {
  contact: {
    personType: ContactFormValues['personType'];
    role: ContactFormValues['role'];
    name: string;
    nationalId: string | null;
    taxNumber: string | null;
    taxOffice: string | null;
    city: string | null;
    district: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    note: string | null;
    status: ContactFormValues['status'];
  };
  opening: {
    amountMinor: number;
    direction: ContactFormValues['openingDirection'];
    date: string;
  } | null;
}

export interface ContactSchemaOptions {
  language: Language;
  /** Telefon ulusal biçimde yazılırsa varsayılan ülke kodu. */
  phoneCountry: PhoneCountry;
  /** TC Kimlik No / Vergi No doğrulaması yalnızca Türkiye ayarında (6.2). */
  turkishRules: boolean;
  /** Açılış bakiyesi bölümü yalnızca yeni caride gösterilir. */
  isNew: boolean;
  /** Açılış bakiyesinden oluşacak Devir hareketinin tarihi (`YYYY-AA-GG`). */
  today: string;
}

export const EMPTY_CONTACT_FORM: ContactFormValues = {
  personType: 'individual',
  role: 'customer',
  name: '',
  nationalId: '',
  taxNumber: '',
  taxOffice: '',
  city: '',
  district: '',
  address: '',
  phone: '',
  email: '',
  note: '',
  status: 'active',
  openingAmount: '',
  openingDirection: 'receivable',
};

const emailSchema = z.email();

const orNull = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

export function createContactFormSchema(options: ContactSchemaOptions) {
  const values = z.object({
    personType: z.enum(PERSON_TYPES),
    role: z.enum(CONTACT_ROLES),
    name: z.string(),
    nationalId: z.string(),
    taxNumber: z.string(),
    taxOffice: z.string(),
    city: z.string(),
    district: z.string(),
    address: z.string(),
    phone: z.string(),
    email: z.string(),
    note: z.string(),
    status: z.enum(STATUS),
    openingAmount: z.string(),
    openingDirection: z.enum(OPENING_DIRECTIONS),
  });

  return values
    .superRefine((v, ctx) => {
      const issue = (path: keyof ContactFormValues, message: string) =>
        ctx.addIssue({ code: 'custom', path: [path], message });

      const name = v.name.trim();
      if (!name) issue('name', 'validation.required');
      else if (name.length > NAME_MAX_LENGTH) issue('name', 'validation.tooLong');

      const nationalId = v.nationalId.trim();
      if (v.personType === 'individual' && nationalId && options.turkishRules) {
        const problem = nationalIdIssue(nationalId);
        if (problem) issue('nationalId', `validation.nationalId.${problem}`);
      }

      const taxNumber = v.taxNumber.trim();
      if (v.personType === 'company' && taxNumber && options.turkishRules) {
        if (!isValidTaxNumber(taxNumber)) issue('taxNumber', 'validation.taxNumberInvalid');
      }

      const phone = v.phone.trim();
      if (phone && !normalizePhone(phone, options.phoneCountry)) {
        issue('phone', 'validation.phoneInvalid');
      }

      const email = v.email.trim();
      if (email && !emailSchema.safeParse(email).success) {
        issue('email', 'validation.emailInvalid');
      }

      if (options.isNew && v.openingAmount.trim()) {
        const parsed = parseAmount(v.openingAmount, options.language);
        if (!parsed.ok) issue('openingAmount', `validation.amount.${parsed.error}`);
        else if (parsed.minor <= 0) issue('openingAmount', 'validation.amount.notPositive');
      }
    })
    .transform((v): ContactFormOutput => {
      const isIndividual = v.personType === 'individual';
      const opening =
        options.isNew && v.openingAmount.trim()
          ? parseAmount(v.openingAmount, options.language)
          : null;
      const phone = orNull(v.phone);

      return {
        contact: {
          personType: v.personType,
          role: v.role,
          name: v.name.trim().replace(/\s+/g, ' '),
          nationalId: isIndividual ? orNull(v.nationalId) : null,
          taxNumber: isIndividual ? null : orNull(v.taxNumber),
          taxOffice: isIndividual ? null : orNull(v.taxOffice),
          city: orNull(v.city),
          district: orNull(v.district),
          address: orNull(v.address),
          phone: phone ? normalizePhone(phone, options.phoneCountry) : null,
          email: orNull(v.email)?.toLowerCase() ?? null,
          note: orNull(v.note),
          status: v.status,
        },
        opening:
          opening?.ok && opening.minor > 0
            ? { amountMinor: opening.minor, direction: v.openingDirection, date: options.today }
            : null,
      };
    });
}

/** Düzenleme formu için kayıttan form değerleri. */
export function contactToFormValues(contact: {
  personType: ContactFormValues['personType'];
  role: ContactFormValues['role'];
  name: string;
  nationalId: string | null;
  taxNumber: string | null;
  taxOffice: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
  status: ContactFormValues['status'];
}): ContactFormValues {
  return {
    ...EMPTY_CONTACT_FORM,
    personType: contact.personType,
    role: contact.role,
    name: contact.name,
    nationalId: contact.nationalId ?? '',
    taxNumber: contact.taxNumber ?? '',
    taxOffice: contact.taxOffice ?? '',
    city: contact.city ?? '',
    district: contact.district ?? '',
    address: contact.address ?? '',
    phone: contact.phone ?? '',
    email: contact.email ?? '',
    note: contact.note ?? '',
    status: contact.status,
  };
}
