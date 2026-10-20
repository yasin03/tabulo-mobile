import {
  contactToFormValues,
  createContactFormSchema,
  EMPTY_CONTACT_FORM,
  type ContactFormValues,
  type ContactSchemaOptions,
} from './contact';

const TR: ContactSchemaOptions = {
  language: 'tr',
  phoneCountry: 'TR',
  turkishRules: true,
  isNew: true,
  today: '2026-10-19',
};

function parse(values: Partial<ContactFormValues>, options: Partial<ContactSchemaOptions> = {}) {
  return createContactFormSchema({ ...TR, ...options }).safeParse({
    ...EMPTY_CONTACT_FORM,
    ...values,
  });
}

function errors(values: Partial<ContactFormValues>, options?: Partial<ContactSchemaOptions>) {
  const result = parse(values, options);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]));
}

describe('cari form şeması', () => {
  it('yalnızca ad zorunlu', () => {
    expect(errors({})).toEqual({ name: 'validation.required' });
    expect(errors({ name: '   ' })).toEqual({ name: 'validation.required' });
    const result = parse({ name: '  Ahmet   Yılmaz ' });
    expect(result.success && result.data).toEqual({
      contact: {
        personType: 'individual',
        role: 'customer',
        name: 'Ahmet Yılmaz',
        nationalId: null,
        taxNumber: null,
        taxOffice: null,
        city: null,
        district: null,
        address: null,
        phone: null,
        email: null,
        note: null,
        status: 'active',
      },
      opening: null,
    });
  });

  it('TC Kimlik No: doluysa 11 hane ve 0 ile başlamamalı (Türkiye ayarında)', () => {
    // Kontrol hanesi algoritması uygulanmaz.
    expect(errors({ name: 'A', nationalId: '23451274714' })).toEqual({});
    expect(errors({ name: 'A', nationalId: '1234567890' })).toEqual({
      nationalId: 'validation.nationalId.length',
    });
    expect(errors({ name: 'A', nationalId: '01234567890' })).toEqual({
      nationalId: 'validation.nationalId.firstDigit',
    });
    expect(errors({ name: 'A', nationalId: '10000000146' })).toEqual({});
    // Türkiye dışı ayarda serbest metin ("Tax ID").
    expect(errors({ name: 'A', nationalId: 'AB123' }, { turkishRules: false })).toEqual({});
  });

  it('Vergi No: şirkette doluysa 10 hane', () => {
    expect(errors({ personType: 'company', name: 'X', taxNumber: '123' })).toEqual({
      taxNumber: 'validation.taxNumberInvalid',
    });
    expect(errors({ personType: 'company', name: 'X', taxNumber: '1234567890' })).toEqual({});
    expect(
      errors(
        { personType: 'company', name: 'X', taxNumber: 'GB123456789' },
        { turkishRules: false },
      ),
    ).toEqual({});
  });

  it('kişi türüne ait olmayan alanlar çıktıya girmez', () => {
    const individual = parse({
      name: 'A',
      nationalId: '10000000146',
      taxNumber: '1234567890',
      taxOffice: 'Kadıköy',
    });
    expect(individual.success && individual.data.contact).toEqual(
      expect.objectContaining({ nationalId: '10000000146', taxNumber: null, taxOffice: null }),
    );
    // Şahısta geçersiz Vergi No yazılmış olsa bile alan gizli olduğu için hata vermez.
    expect(errors({ name: 'A', taxNumber: '1' })).toEqual({});

    const company = parse({
      personType: 'company',
      name: 'B',
      nationalId: '10000000146',
      taxNumber: '1234567890',
      taxOffice: ' Kadıköy ',
    });
    expect(company.success && company.data.contact).toEqual(
      expect.objectContaining({ nationalId: null, taxNumber: '1234567890', taxOffice: 'Kadıköy' }),
    );
  });

  it('telefon E.164 biçimine çevrilir', () => {
    const result = parse({ name: 'A', phone: '0532 000 00 00' });
    expect(result.success && result.data.contact.phone).toBe('+905320000000');
    expect(errors({ name: 'A', phone: '123' })).toEqual({ phone: 'validation.phoneInvalid' });

    const uk = parse({ name: 'A', phone: '07700 900123' }, { phoneCountry: 'GB' });
    expect(uk.success && uk.data.contact.phone).toBe('+447700900123');
  });

  it('e-posta doluysa geçerli olmalı, küçük harfe çevrilir', () => {
    expect(errors({ name: 'A', email: 'ahmet@' })).toEqual({ email: 'validation.emailInvalid' });
    const result = parse({ name: 'A', email: ' Ahmet@Ornek.com ' });
    expect(result.success && result.data.contact.email).toBe('ahmet@ornek.com');
  });

  describe('açılış bakiyesi', () => {
    it('doluysa Devir bilgisi üretir', () => {
      const result = parse({ name: 'A', openingAmount: '1.500,50', openingDirection: 'payable' });
      expect(result.success && result.data.opening).toEqual({
        amountMinor: 150050,
        direction: 'payable',
        date: '2026-10-19',
      });
    });

    it('tutar kuralları', () => {
      expect(errors({ name: 'A', openingAmount: '0' })).toEqual({
        openingAmount: 'validation.amount.notPositive',
      });
      expect(errors({ name: 'A', openingAmount: '1,234' })).toEqual({
        openingAmount: 'validation.amount.tooManyDecimals',
      });
      expect(errors({ name: 'A', openingAmount: 'abc' })).toEqual({
        openingAmount: 'validation.amount.invalid',
      });
    });

    it('düzenlemede yok sayılır', () => {
      const result = parse({ name: 'A', openingAmount: 'abc' }, { isNew: false });
      expect(result.success && result.data.opening).toBeNull();
    });
  });

  it('kayıttan form değerleri', () => {
    expect(
      contactToFormValues({
        personType: 'company',
        role: 'supplier',
        name: 'Demir Hırdavat',
        nationalId: null,
        taxNumber: '1234567890',
        taxOffice: null,
        city: 'İstanbul',
        district: 'Kadıköy',
        address: null,
        phone: '+905320000000',
        email: null,
        note: null,
        status: 'passive',
      }),
    ).toEqual({
      ...EMPTY_CONTACT_FORM,
      personType: 'company',
      role: 'supplier',
      name: 'Demir Hırdavat',
      taxNumber: '1234567890',
      city: 'İstanbul',
      district: 'Kadıköy',
      phone: '+905320000000',
      status: 'passive',
    });
  });
});
