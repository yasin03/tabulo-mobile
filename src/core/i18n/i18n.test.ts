import en from './en.json';
import { pickLanguage } from './index';
import tr from './tr.json';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === 'object' ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

function placeholders(obj: object): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const walk = (o: object, prefix: string) => {
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string')
        out[prefix + k] = [...v.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]!).sort();
      else if (v && typeof v === 'object') walk(v as object, `${prefix}${k}.`);
    }
  };
  walk(obj, '');
  return out;
}

describe('çeviri dosyaları', () => {
  it('tr ve en aynı anahtarlara sahip', () => {
    expect(keys(en).sort()).toEqual(keys(tr).sort());
  });

  it('boş çeviri yok', () => {
    const values = (o: object): string[] =>
      Object.values(o).flatMap((v) => (typeof v === 'string' ? [v] : values(v as object)));
    expect(values(tr).filter((v) => v.trim() === '')).toEqual([]);
    expect(values(en).filter((v) => v.trim() === '')).toEqual([]);
  });

  it('değişken yer tutucuları iki dilde aynı', () => {
    expect(placeholders(en)).toEqual(placeholders(tr));
  });
});

describe('pickLanguage', () => {
  it('desteklenen ilk cihaz dilini seçer', () => {
    expect(pickLanguage(['de-DE', 'en-GB', 'tr-TR'])).toBe('en');
    expect(pickLanguage(['tr-TR'])).toBe('tr');
    expect(pickLanguage(['EN-us'])).toBe('en');
  });

  it('desteklenmeyen veya boş dilde Türkçeye düşer', () => {
    expect(pickLanguage(['de-DE', null, undefined])).toBe('tr');
    expect(pickLanguage([])).toBe('tr');
  });
});
