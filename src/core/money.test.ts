import {
  formatAmountForInput,
  formatMoney,
  formatSignedMoney,
  MAX_AMOUNT_MINOR,
  parseAmount,
  pickCurrency,
} from './money';

const ok = (minor: number) => ({ ok: true, minor });
const fail = (error: string) => ({ ok: false, error });

describe('parseAmount', () => {
  describe('PROMPT 6.1 örnekleri her iki dilde aynı sonucu verir', () => {
    it.each(['25450,65', '25.450,65', '25450.65', '25,450.65'])('%s → 2545065', (input) => {
      expect(parseAmount(input, 'tr')).toEqual(ok(2545065));
      expect(parseAmount(input, 'en')).toEqual(ok(2545065));
    });
  });

  it('tam sayılar', () => {
    expect(parseAmount('1500', 'tr')).toEqual(ok(150000));
    expect(parseAmount('7', 'en')).toEqual(ok(700));
    expect(parseAmount('0007', 'tr')).toEqual(ok(700));
  });

  it('tek ondalık basamak', () => {
    expect(parseAmount('12,5', 'tr')).toEqual(ok(1250));
    expect(parseAmount('12.5', 'tr')).toEqual(ok(1250));
    expect(parseAmount('12.5', 'en')).toEqual(ok(1250));
  });

  it('ondalık ayracıyla biten veya başlayan girişler (yazarken ara durum)', () => {
    expect(parseAmount('12,', 'tr')).toEqual(ok(1200));
    expect(parseAmount(',5', 'tr')).toEqual(ok(50));
    expect(parseAmount('.05', 'en')).toEqual(ok(5));
  });

  describe('binlik ayracı', () => {
    it('çok gruplu', () => {
      expect(parseAmount('1.234.567', 'tr')).toEqual(ok(123456700));
      expect(parseAmount('1,234,567', 'en')).toEqual(ok(123456700));
      expect(parseAmount('1.234.567,89', 'en')).toEqual(ok(123456789));
      expect(parseAmount('1,234,567.89', 'tr')).toEqual(ok(123456789));
    });

    it('tek ayraç + 3 rakam: dilin binlik ayracıysa binlik sayılır', () => {
      expect(parseAmount('25.450', 'tr')).toEqual(ok(2545000));
      expect(parseAmount('25,450', 'en')).toEqual(ok(2545000));
    });

    it('tek ayraç + 3 rakam: dilin ondalık ayracıysa 3 ondalık olarak reddedilir', () => {
      expect(parseAmount('25,450', 'tr')).toEqual(fail('tooManyDecimals'));
      expect(parseAmount('25.450', 'en')).toEqual(fail('tooManyDecimals'));
    });

    it('hatalı gruplama reddedilir', () => {
      expect(parseAmount('1.23.456', 'tr')).toEqual(fail('invalid'));
      expect(parseAmount('12.34,56', 'tr')).toEqual(fail('invalid'));
      expect(parseAmount('1234.567,00', 'tr')).toEqual(fail('invalid'));
      expect(parseAmount('1,234.56,78', 'en')).toEqual(fail('invalid'));
    });
  });

  it('boşlukları ve para birimi simgelerini yok sayar', () => {
    expect(parseAmount('  1 500,25 ', 'tr')).toEqual(ok(150025));
    expect(parseAmount('₺1.500', 'tr')).toEqual(ok(150000));
    expect(parseAmount('£25,450.65', 'en')).toEqual(ok(2545065));
    expect(parseAmount('1 500', 'tr')).toEqual(ok(150000));
  });

  it('boş değer', () => {
    expect(parseAmount('', 'tr')).toEqual(fail('empty'));
    expect(parseAmount('   ', 'en')).toEqual(fail('empty'));
    expect(parseAmount('₺', 'tr')).toEqual(fail('empty'));
  });

  it('sıfır ayrıştırılır (> 0 kuralını form/repository uygular)', () => {
    expect(parseAmount('0', 'tr')).toEqual(ok(0));
    expect(parseAmount('0,00', 'tr')).toEqual(ok(0));
    expect(parseAmount('0.00', 'en')).toEqual(ok(0));
  });

  it('negatif giriş reddedilir', () => {
    expect(parseAmount('-5', 'tr')).toEqual(fail('negative'));
    expect(parseAmount('−5', 'en')).toEqual(fail('negative'));
    expect(parseAmount(' -1.500,00', 'tr')).toEqual(fail('negative'));
  });

  it('3 ve daha fazla ondalık basamak reddedilir', () => {
    expect(parseAmount('1,234', 'tr')).toEqual(fail('tooManyDecimals'));
    expect(parseAmount('0,001', 'tr')).toEqual(fail('tooManyDecimals'));
    expect(parseAmount('1.2345', 'en')).toEqual(fail('tooManyDecimals'));
    expect(parseAmount('1.234,567', 'tr')).toEqual(fail('tooManyDecimals'));
  });

  it('sayı olmayan girişler reddedilir', () => {
    for (const input of ['abc', '12a', '1e5', '+5', '.', ',', '1,2,3.4.5', '12..5', '0x10']) {
      expect(parseAmount(input, 'tr')).toEqual(fail('invalid'));
    }
  });

  it('üst sınır', () => {
    expect(parseAmount('99.999.999.999,99', 'tr')).toEqual(ok(MAX_AMOUNT_MINOR));
    expect(parseAmount('100.000.000.000', 'tr')).toEqual(fail('tooLarge'));
    expect(parseAmount('99999999999999999999', 'en')).toEqual(fail('tooLarge'));
  });

  it('float hatası yok: kuruşlar tam sayı olarak hesaplanır', () => {
    expect(parseAmount('0,29', 'tr')).toEqual(ok(29));
    expect(parseAmount('1.005,57', 'tr')).toEqual(ok(100557));
    expect(parseAmount('4.35', 'en')).toEqual(ok(435));
  });
});

describe('formatMoney', () => {
  const NB = '\u00A0';

  it('Türkçe: simge sonda, her zaman 2 ondalık', () => {
    expect(formatMoney(150055, { currency: 'TRY', language: 'tr' })).toBe(`1.500,55${NB}₺`);
    expect(formatMoney(345000, { currency: 'TRY', language: 'tr' })).toBe(`3.450,00${NB}₺`);
    expect(formatMoney(2545065, { currency: 'TRY', language: 'tr' })).toBe(`25.450,65${NB}₺`);
    expect(formatMoney(5, { currency: 'TRY', language: 'tr' })).toBe(`0,05${NB}₺`);
    expect(formatMoney(0, { currency: 'TRY', language: 'tr' })).toBe(`0,00${NB}₺`);
    expect(formatMoney(123456789, { currency: 'TRY', language: 'tr' })).toBe(`1.234.567,89${NB}₺`);
  });

  it('İngilizce: simge başta (UK / US)', () => {
    expect(formatMoney(2545065, { currency: 'GBP', language: 'en' })).toBe('£25,450.65');
    expect(formatMoney(2545065, { currency: 'USD', language: 'en' })).toBe('$25,450.65');
    expect(formatMoney(345000, { currency: 'USD', language: 'en' })).toBe('$3,450.00');
  });

  it('dil ile para birimi farklı olabilir', () => {
    expect(formatMoney(150000, { currency: 'GBP', language: 'tr' })).toBe(`1.500,00${NB}£`);
    expect(formatMoney(150000, { currency: 'TRY', language: 'en' })).toBe('₺1,500.00');
  });

  it('negatif tutarın mutlak değerini biçimler', () => {
    expect(formatMoney(-64000, { currency: 'TRY', language: 'tr' })).toBe(`640,00${NB}₺`);
  });

  it('tam sayı olmayan kuruşu reddeder', () => {
    expect(() => formatMoney(10.5, { currency: 'TRY', language: 'tr' })).toThrow(RangeError);
  });
});

describe('formatSignedMoney', () => {
  const NB = '\u00A0';
  const tr = { currency: 'TRY', language: 'tr' } as const;

  it('giriş + , çıkış − (eksi işareti U+2212)', () => {
    expect(formatSignedMoney(150000, tr)).toBe(`+${NB}1.500,00${NB}₺`);
    expect(formatSignedMoney(-64000, tr)).toBe(`\u2212${NB}640,00${NB}₺`);
    expect(formatSignedMoney(-64000, { currency: 'GBP', language: 'en' })).toBe(
      `\u2212${NB}£640.00`,
    );
  });

  it('sıfırda işaret yok', () => {
    expect(formatSignedMoney(0, tr)).toBe(`0,00${NB}₺`);
  });
});

describe('formatAmountForInput', () => {
  it('düzenleme formu için gruplamasız, dilin ondalık ayracıyla', () => {
    expect(formatAmountForInput(2545065, 'tr')).toBe('25450,65');
    expect(formatAmountForInput(2545065, 'en')).toBe('25450.65');
    expect(formatAmountForInput(150000, 'tr')).toBe('1500');
    expect(formatAmountForInput(5, 'tr')).toBe('0,05');
  });

  it('parseAmount ile gidiş-dönüş', () => {
    for (const minor of [1, 99, 100, 2545065, MAX_AMOUNT_MINOR]) {
      for (const language of ['tr', 'en'] as const) {
        expect(parseAmount(formatAmountForInput(minor, language), language)).toEqual(ok(minor));
      }
    }
  });
});

describe('pickCurrency', () => {
  it('desteklenen ilk para birimini seçer, yoksa TRY', () => {
    expect(pickCurrency(['EUR', 'gbp'])).toBe('GBP');
    expect(pickCurrency([null, 'USD'])).toBe('USD');
    expect(pickCurrency(['EUR'])).toBe('TRY');
    expect(pickCurrency([])).toBe('TRY');
  });
});
