import { foldForSearch, initials, matchesSearch } from './text';

describe('foldForSearch', () => {
  it('Türkçe büyük/küçük harf ve karakter farkını yok sayar', () => {
    expect(foldForSearch('Şahin')).toBe('sahin');
    expect(foldForSearch('ŞAHİN')).toBe('sahin');
    expect(foldForSearch('IŞIK')).toBe('isik');
    expect(foldForSearch('Çağrı Öztürk')).toBe('cagri ozturk');
    expect(foldForSearch('  Çok   boşluk ')).toBe('cok bosluk');
  });
});

describe('matchesSearch', () => {
  it('kelimeleri herhangi bir sırada ve alanda arar', () => {
    expect(matchesSearch('yilmaz ahmet', 'Ahmet Yılmaz')).toBe(true);
    expect(matchesSearch('istanbul', 'Ahmet', 'İstanbul')).toBe(true);
    expect(matchesSearch('ışık', 'ISIK HIRDAVAT')).toBe(true);
    expect(matchesSearch('ankara', 'Ahmet', null, 'İzmir')).toBe(false);
  });

  it('boş arama her şeyle eşleşir', () => {
    expect(matchesSearch('   ', 'x')).toBe(true);
  });
});

describe('initials', () => {
  it('ilk ve son kelimenin baş harfleri', () => {
    expect(initials('Ahmet Yılmaz')).toBe('AY');
    expect(initials('Demir Hırdavat Ltd. Şti.')).toBe('DŞ');
    expect(initials('demir')).toBe('D');
    expect(initials('ismail ışık')).toBe('İI');
    expect(initials('  ')).toBe('');
  });
});
