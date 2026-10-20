import {
  createTransactionFormSchema,
  emptyTransactionForm,
  transactionToFormValues,
  type TransactionFormValues,
} from './transaction';

const TODAY = '2026-10-20';

function parse(values: Partial<TransactionFormValues>, language: 'tr' | 'en' = 'tr') {
  return createTransactionFormSchema({ language }).safeParse({
    ...emptyTransactionForm(values.movementType ?? 'collection', TODAY),
    ...values,
  });
}

function errors(values: Partial<TransactionFormValues>) {
  const result = parse(values);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]));
}

describe('hareket form şeması', () => {
  it('Tahsilat: tutar ve hesap zorunlu, cari isteğe bağlı', () => {
    expect(errors({ movementType: 'collection' })).toEqual({
      amount: 'validation.amount.empty',
      accountId: 'validation.required',
    });
    const result = parse({ movementType: 'collection', amount: '1.500,55', accountId: 'acc' });
    expect(result.success && result.data).toEqual(
      expect.objectContaining({ amountMinor: 150055, accountId: 'acc', contactId: null }),
    );
  });

  it('Veresiye: cari zorunlu, hesap çıktıda boş, vade korunur', () => {
    expect(errors({ movementType: 'credit_sale', amount: '10' })).toEqual({
      contactId: 'validation.required',
    });
    const result = parse({
      movementType: 'credit_sale',
      amount: '10',
      contactId: 'c1',
      accountId: 'acc', // tip değiştirilince formda kalmış olabilir
      dueDate: '2026-11-01',
    });
    expect(result.success && result.data).toEqual(
      expect.objectContaining({ accountId: null, contactId: 'c1', dueDate: '2026-11-01' }),
    );
  });

  it('Tahsilatta vade ve devir yönü çıktıya girmez', () => {
    const result = parse({
      movementType: 'collection',
      amount: '10',
      accountId: 'acc',
      dueDate: '2026-11-01',
      openingDirection: 'payable',
    });
    expect(result.success && result.data).toEqual(
      expect.objectContaining({ dueDate: null, openingDirection: null }),
    );
  });

  it('Devir: işlem türü gizli, devir yönü çıktıda', () => {
    const result = parse({
      movementType: 'opening',
      amount: '10',
      contactId: 'c1',
      transactionTypeId: 'tt',
      openingDirection: 'payable',
    });
    expect(result.success && result.data).toEqual(
      expect.objectContaining({ transactionTypeId: null, openingDirection: 'payable' }),
    );
  });

  it('sıfır, 3 ondalık ve geçersiz tarih reddedilir', () => {
    expect(errors({ amount: '0', accountId: 'a' })).toEqual({
      amount: 'validation.amount.notPositive',
    });
    expect(errors({ amount: '1,555', accountId: 'a' })).toEqual({
      amount: 'validation.amount.tooManyDecimals',
    });
    expect(errors({ amount: '1', accountId: 'a', date: '2026-02-30' })).toEqual({
      date: 'validation.dateInvalid',
    });
  });

  it('İngilizcede nokta ondalık ayracıdır', () => {
    const result = parse({ amount: '25,450.65', accountId: 'a' }, 'en');
    expect(result.success && result.data.amountMinor).toBe(2545065);
  });

  it('boş metinler null, açıklama kırpılır', () => {
    const result = parse({ amount: '1', accountId: 'a', description: '  Kira  ', documentNo: ' ' });
    expect(result.success && result.data).toEqual(
      expect.objectContaining({ description: 'Kira', documentNo: null, subjectId: null }),
    );
  });

  it('kayıttan form değerleri ve geri dönüş', () => {
    const values = transactionToFormValues(
      {
        movementType: 'credit_sale',
        amountMinor: 2545065,
        date: '2026-10-01',
        accountId: null,
        contactId: 'c1',
        transactionTypeId: 'tt',
        subjectId: 's1',
        description: 'Boya',
        documentNo: 'F-1',
        dueDate: '2026-11-01',
        openingDirection: null,
      },
      'tr',
    );
    expect(values.amount).toBe('25450,65');
    const result = parse(values);
    expect(result.success && result.data).toEqual({
      movementType: 'credit_sale',
      amountMinor: 2545065,
      date: '2026-10-01',
      accountId: null,
      contactId: 'c1',
      transactionTypeId: 'tt',
      subjectId: 's1',
      description: 'Boya',
      documentNo: 'F-1',
      dueDate: '2026-11-01',
      openingDirection: null,
    });
  });
});
