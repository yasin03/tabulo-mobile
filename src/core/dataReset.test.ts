import { matchesConfirmPhrase, resolveDataSelection } from './dataReset';

describe('resolveDataSelection', () => {
  it('yalnızca seçilenleri, sabit sırada döner', () => {
    expect(resolveDataSelection(['settings', 'transactions'])).toEqual({
      categories: ['transactions', 'settings'],
      transactionsForced: false,
    });
    expect(resolveDataSelection([]).categories).toEqual([]);
  });

  it.each(['contacts', 'definitions', 'accounts'] as const)(
    '%s seçilince hareketler de silinir',
    (category) => {
      expect(resolveDataSelection([category])).toEqual({
        categories: ['transactions', category],
        transactionsForced: true,
      });
    },
  );
});

describe('matchesConfirmPhrase', () => {
  it('boşluk ve büyük/küçük harf önemsiz (Türkçe kurallarıyla)', () => {
    expect(matchesConfirmPhrase('Verileri Sil', 'Verileri Sil', 'tr-TR')).toBe(true);
    expect(matchesConfirmPhrase('  verileri   sil ', 'Verileri Sil', 'tr-TR')).toBe(true);
    expect(matchesConfirmPhrase('VERİLERİ SİL', 'Verileri Sil', 'tr-TR')).toBe(true);
    expect(matchesConfirmPhrase('delete data', 'Delete Data', 'en-US')).toBe(true);
  });

  it('eksik veya farklı ifadeyi kabul etmez', () => {
    expect(matchesConfirmPhrase('', 'Verileri Sil', 'tr-TR')).toBe(false);
    expect(matchesConfirmPhrase('Verileri', 'Verileri Sil', 'tr-TR')).toBe(false);
    expect(matchesConfirmPhrase('Verileri Sİl x', 'Verileri Sil', 'tr-TR')).toBe(false);
  });
});
