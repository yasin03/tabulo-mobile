import {
  convertMinor,
  counterCurrency,
  formatRate,
  formatRateForInput,
  normalizeRate,
  parseRate,
  type ExchangeRate,
} from './exchange';

const USD_TRY: ExchangeRate = { base: 'USD', quote: 'TRY', micro: 49_553_000 }; // 1 USD = 49,553 ₺

describe('normalizeRate', () => {
  it("kuru 1'den büyük yönde tutar", () => {
    expect(normalizeRate('USD', 'TRY', 49.553)).toEqual(USD_TRY);
    expect(normalizeRate('TRY', 'USD', 0.02018)).toEqual({
      base: 'USD',
      quote: 'TRY',
      micro: 49_554_014,
    });
  });
});

describe('convertMinor', () => {
  it('TRY → USD bölerek, USD → TRY çarparak; kuruşa yuvarlar', () => {
    expect(convertMinor(500_000, 'TRY', USD_TRY)).toBe(10_090); // 5.000 ₺ → 100,90 $
    expect(convertMinor(10_000, 'USD', USD_TRY)).toBe(495_530); // 100 $ → 4.955,30 ₺
    expect(convertMinor(0, 'TRY', USD_TRY)).toBe(0);
  });

  it('negatif tutar (ör. açılış bakiyesi) simetrik yuvarlanır', () => {
    expect(convertMinor(-500_000, 'TRY', USD_TRY)).toBe(-10_090);
  });

  it('eşit tutarlar eşit kalır: kapalı hesap kapalı kalır', () => {
    const sale = convertMinor(123_456, 'TRY', USD_TRY);
    const collection = convertMinor(123_456, 'TRY', USD_TRY);
    expect(sale - collection).toBe(0);
  });

  it('büyük tutarlarda hassasiyet kaybı yok (BigInt)', () => {
    expect(
      convertMinor(9_999_999_999_999, 'USD', { base: 'USD', quote: 'TRY', micro: 1_000_001 }),
    ).toBe(10_000_009_999_999);
  });

  it('kur bu para birimini içermiyorsa hata', () => {
    expect(() => convertMinor(100, 'GBP', USD_TRY)).toThrow(RangeError);
  });

  it('counterCurrency', () => {
    expect(counterCurrency(USD_TRY, 'TRY')).toBe('USD');
    expect(counterCurrency(USD_TRY, 'USD')).toBe('TRY');
  });
});

describe('parseRate / formatRate', () => {
  it('virgül veya nokta ondalık', () => {
    expect(parseRate('49,553')).toEqual({ ok: true, micro: 49_553_000 });
    expect(parseRate('49.553')).toEqual({ ok: true, micro: 49_553_000 });
    expect(parseRate(' 1 ')).toEqual({ ok: true, micro: 1_000_000 });
  });

  it('geçersiz girişler', () => {
    expect(parseRate('')).toEqual({ ok: false, error: 'empty' });
    expect(parseRate('0')).toEqual({ ok: false, error: 'notPositive' });
    expect(parseRate('1,2345678')).toEqual({ ok: false, error: 'tooManyDecimals' });
    expect(parseRate('1.000,5')).toEqual({ ok: false, error: 'invalid' });
    expect(parseRate('-2')).toEqual({ ok: false, error: 'invalid' });
  });

  it('giriş alanı ve gösterim', () => {
    expect(formatRateForInput(49_553_000, 'tr')).toBe('49,553');
    expect(formatRateForInput(49_553_000, 'en')).toBe('49.553');
    expect(formatRateForInput(2_000_000, 'tr')).toBe('2');
    expect(formatRate(49_553_000, 'tr', 'TRY')).toBe('49,553');
    expect(formatRate(1_300_000, 'en', 'GBP')).toBe('1.30');
  });
});
