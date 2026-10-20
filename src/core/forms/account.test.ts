import { accountToFormValues, createAccountFormSchema, EMPTY_ACCOUNT_FORM } from './account';
import { createBusinessFormSchema } from './business';

const schema = createAccountFormSchema({ language: 'tr' });

describe('hesap form şeması', () => {
  it('ad zorunlu', () => {
    const result = schema.safeParse(EMPTY_ACCOUNT_FORM);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('validation.required');
  });

  it('banka: IBAN doğrulanır ve normalleştirilir; kasada banka alanları boş', () => {
    const bank = schema.safeParse({
      ...EMPTY_ACCOUNT_FORM,
      type: 'bank',
      name: ' Ziraat ',
      bankName: 'Ziraat Bankası',
      iban: 'tr33 0006 1005 1978 6457 8413 26',
      openingBalance: '1.500,50',
    });
    expect(bank.success && bank.data).toEqual({
      type: 'bank',
      name: 'Ziraat',
      bankName: 'Ziraat Bankası',
      iban: 'TR330006100519786457841326',
      openingBalanceMinor: 150050,
    });

    const badIban = schema.safeParse({
      ...EMPTY_ACCOUNT_FORM,
      type: 'bank',
      name: 'B',
      iban: 'TR00',
    });
    expect(badIban.error?.issues[0]?.message).toBe('validation.ibanInvalid');

    const cash = schema.safeParse({
      ...EMPTY_ACCOUNT_FORM,
      name: 'Kasa',
      iban: 'x',
      bankName: 'y',
    });
    expect(cash.success && cash.data).toEqual(
      expect.objectContaining({ iban: null, bankName: null, openingBalanceMinor: 0 }),
    );
  });

  it('kayıttan form değerleri', () => {
    expect(
      accountToFormValues(
        { type: 'cash', name: 'Kasa', bankName: null, iban: null, openingBalanceMinor: 2500 },
        'tr',
      ).openingBalance,
    ).toBe('25');
  });
});

describe('işletme profili form şeması', () => {
  const business = createBusinessFormSchema({ phoneCountry: 'TR', turkishRules: true });
  const empty = {
    name: '',
    phone: '',
    email: '',
    city: '',
    district: '',
    address: '',
    taxNumber: '',
    taxOffice: '',
  };

  it('her alan isteğe bağlı', () => {
    expect(business.safeParse(empty).success).toBe(true);
  });

  it('telefon, e-posta ve vergi no doğrulanır', () => {
    const result = business.safeParse({
      ...empty,
      phone: '0532 000 00 00',
      email: 'Info@Ornek.com',
      taxNumber: '123',
    });
    expect(result.error?.issues.map((i) => i.message)).toEqual(['validation.taxNumberInvalid']);
    const ok = business.safeParse({ ...empty, phone: '0532 000 00 00', email: 'Info@Ornek.com' });
    expect(ok.success && ok.data).toEqual(
      expect.objectContaining({ phone: '+905320000000', email: 'info@ornek.com' }),
    );
  });
});
