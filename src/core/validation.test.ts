import {
  defaultPhoneCountry,
  formatIban,
  formatPhone,
  isValidIban,
  normalizeIban,
  isIsoDate,
  isValidNationalId,
  isValidTaxNumber,
  maskNationalId,
  nationalIdIssue,
  normalizePhone,
} from './validation';

describe('isValidNationalId', () => {
  it('11 hane ve ilk hane 0 değilse geçerli (kontrol hanesi algoritması yok)', () => {
    expect(isValidNationalId('10000000146')).toBe(true);
    expect(isValidNationalId('23451274714')).toBe(true);
    expect(isValidNationalId('12345678901')).toBe(true);
  });

  it('11 hane değilse geçersiz', () => {
    expect(isValidNationalId('1000000014')).toBe(false);
    expect(isValidNationalId('100000001460')).toBe(false);
    expect(isValidNationalId('')).toBe(false);
  });

  it('ilk hane 0 olamaz', () => {
    expect(isValidNationalId('01234567890')).toBe(false);
  });

  it('yalnızca rakam', () => {
    expect(isValidNationalId('1000000014a')).toBe(false);
    expect(isValidNationalId('100 0000014')).toBe(false);
  });
});

describe('nationalIdIssue', () => {
  it('sorunun türünü verir', () => {
    expect(nationalIdIssue('10000000146')).toBeNull();
    expect(nationalIdIssue('1000000014')).toBe('length');
    expect(nationalIdIssue('1000000014a')).toBe('length');
    expect(nationalIdIssue('01234567890')).toBe('firstDigit');
    // Kontrol hanesi algoritması uygulanmaz.
    expect(nationalIdIssue('23451274714')).toBeNull();
  });
});

describe('maskNationalId', () => {
  it('ilk 3 ve son 2 hane görünür', () => {
    expect(maskNationalId('12345678901')).toBe('123******01');
  });
});

describe('isValidTaxNumber', () => {
  it('10 hane rakam', () => {
    expect(isValidTaxNumber('1234567890')).toBe(true);
    expect(isValidTaxNumber('0123456789')).toBe(true);
  });

  it('diğerleri geçersiz', () => {
    expect(isValidTaxNumber('123456789')).toBe(false);
    expect(isValidTaxNumber('12345678901')).toBe(false);
    expect(isValidTaxNumber('12345a7890')).toBe(false);
  });
});

describe('normalizePhone', () => {
  it('Türkiye ulusal biçimleri', () => {
    expect(normalizePhone('0532 000 00 00', 'TR')).toBe('+905320000000');
    expect(normalizePhone('532 000 00 00', 'TR')).toBe('+905320000000');
    expect(normalizePhone('(0532) 000-00-00', 'TR')).toBe('+905320000000');
    expect(normalizePhone('0212 555 12 34', 'TR')).toBe('+902125551234');
  });

  it('uluslararası biçim (+ veya 00) varsayılan ülkeden bağımsızdır', () => {
    expect(normalizePhone('+90 532 000 00 00', 'GB')).toBe('+905320000000');
    expect(normalizePhone('0090 532 000 00 00', 'US')).toBe('+905320000000');
    expect(normalizePhone('+44 7700 900123', 'TR')).toBe('+447700900123');
  });

  it('İngiltere ve ABD', () => {
    expect(normalizePhone('07700 900123', 'GB')).toBe('+447700900123');
    expect(normalizePhone('(201) 555-0123', 'US')).toBe('+12015550123');
    expect(normalizePhone('1 201 555 0123', 'US')).toBe('+12015550123');
  });

  it('geçersiz numaralar', () => {
    expect(normalizePhone('', 'TR')).toBeNull();
    expect(normalizePhone('12345', 'TR')).toBeNull();
    expect(normalizePhone('0532 000 00 0', 'TR')).toBeNull();
    expect(normalizePhone('1532 000 00 00', 'TR')).toBeNull(); // 11 hane ama 0 ile başlamıyor
    expect(normalizePhone('+0 532', 'TR')).toBeNull();
    expect(normalizePhone('0532-ABC', 'TR')).toBeNull();
    expect(normalizePhone('+90+532', 'TR')).toBeNull();
  });

  it('varsayılan ülke para biriminden', () => {
    expect(defaultPhoneCountry('TRY')).toBe('TR');
    expect(defaultPhoneCountry('GBP')).toBe('GB');
    expect(defaultPhoneCountry('USD')).toBe('US');
  });
});

describe('isIsoDate', () => {
  it('geçerli tarihler', () => {
    expect(isIsoDate('2026-10-19')).toBe(true);
    expect(isIsoDate('2024-02-29')).toBe(true);
  });

  it('geçersiz tarihler', () => {
    expect(isIsoDate('2025-02-29')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-04-31')).toBe(false);
    expect(isIsoDate('2026-1-5')).toBe(false);
    expect(isIsoDate('19.10.2026')).toBe(false);
  });
});

describe('formatPhone', () => {
  it('varsayılan ülkenin numarasını ulusal biçimde gösterir', () => {
    expect(formatPhone('+905320000000', 'TR')).toBe('0532 000 00 00');
    expect(formatPhone('+447700900000', 'GB')).toBe('07700 900000');
    expect(formatPhone('+12015550123', 'US')).toBe('(201) 555-0123');
  });

  it('başka ülkenin numarası olduğu gibi kalır', () => {
    expect(formatPhone('+447700900000', 'TR')).toBe('+447700900000');
  });
});

describe('IBAN', () => {
  it('geçerli IBAN (TR ve GB), boşluk ve küçük harf kabul', () => {
    expect(isValidIban('TR33 0006 1005 1978 6457 8413 26')).toBe(true);
    expect(isValidIban('gb29nwbk60161331926819')).toBe(true);
  });

  it('kontrol hanesi veya uzunluk hatalıysa geçersiz', () => {
    expect(isValidIban('TR34 0006 1005 1978 6457 8413 26')).toBe(false);
    expect(isValidIban('TR33 0006 1005 1978 6457 8413')).toBe(false);
    expect(isValidIban('1234')).toBe(false);
  });

  it('gösterim ve normalleştirme', () => {
    expect(normalizeIban(' tr33 0006 ')).toBe('TR330006');
    expect(formatIban('TR330006100519786457841326')).toBe('TR33 0006 1005 1978 6457 8413 26');
  });
});
