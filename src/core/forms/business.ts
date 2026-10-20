// İşletme profili formu (PDF ekstre başlığı, 7.11). Hata mesajları çeviri anahtarıdır.
// Para birimi bu formda değil; dönüştürmeli ayrı akıştadır (src/core/exchange.ts).

import { z } from 'zod';

import { isValidTaxNumber, normalizePhone, type PhoneCountry } from '../validation';

export const BUSINESS_NAME_MAX_LENGTH = 120;

export interface BusinessFormValues {
  name: string;
  phone: string;
  email: string;
  city: string;
  district: string;
  address: string;
  taxNumber: string;
  taxOffice: string;
}

export type BusinessFormOutput = { [K in keyof BusinessFormValues]: string | null } & {
  name: string;
};

const emailSchema = z.email();
const orNull = (value: string) => value.trim() || null;

export function createBusinessFormSchema(options: {
  phoneCountry: PhoneCountry;
  /** Vergi No doğrulaması yalnızca Türkiye ayarında (6.2 ile aynı). */
  turkishRules: boolean;
}) {
  return z
    .object({
      name: z.string(),
      phone: z.string(),
      email: z.string(),
      city: z.string(),
      district: z.string(),
      address: z.string(),
      taxNumber: z.string(),
      taxOffice: z.string(),
    })
    .superRefine((v, ctx) => {
      const issue = (path: keyof BusinessFormValues, message: string) =>
        ctx.addIssue({ code: 'custom', path: [path], message });
      if (v.name.trim().length > BUSINESS_NAME_MAX_LENGTH) issue('name', 'validation.tooLong');
      if (v.phone.trim() && !normalizePhone(v.phone, options.phoneCountry)) {
        issue('phone', 'validation.phoneInvalid');
      }
      if (v.email.trim() && !emailSchema.safeParse(v.email.trim()).success) {
        issue('email', 'validation.emailInvalid');
      }
      if (options.turkishRules && v.taxNumber.trim() && !isValidTaxNumber(v.taxNumber.trim())) {
        issue('taxNumber', 'validation.taxNumberInvalid');
      }
    })
    .transform((v): BusinessFormOutput => {
      const phone = orNull(v.phone);
      return {
        name: v.name.trim().replace(/\s+/g, ' '),
        phone: phone ? normalizePhone(phone, options.phoneCountry) : null,
        email: orNull(v.email)?.toLowerCase() ?? null,
        city: orNull(v.city),
        district: orNull(v.district),
        address: orNull(v.address),
        taxNumber: orNull(v.taxNumber),
        taxOffice: orNull(v.taxOffice),
      };
    });
}

export function businessToFormValues(profile: {
  [K in keyof BusinessFormValues]: string | null;
}): BusinessFormValues {
  return {
    name: profile.name ?? '',
    phone: profile.phone ?? '',
    email: profile.email ?? '',
    city: profile.city ?? '',
    district: profile.district ?? '',
    address: profile.address ?? '',
    taxNumber: profile.taxNumber ?? '',
    taxOffice: profile.taxOffice ?? '',
  };
}
