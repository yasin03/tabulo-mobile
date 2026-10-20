import { districtsOf, findProvince, PROVINCES } from './turkeyRegions';

describe('Türkiye il / ilçe verisi', () => {
  it('81 il, plaka sırasıyla', () => {
    expect(PROVINCES).toHaveLength(81);
    expect(PROVINCES.map((p) => p.plate)).toEqual(Array.from({ length: 81 }, (_, i) => i + 1));
  });

  it('973 ilçe; her ilde en az bir ilçe ve tekrar yok', () => {
    expect(PROVINCES.reduce((sum, p) => sum + p.districts.length, 0)).toBe(973);
    for (const province of PROVINCES) {
      expect(province.districts.length).toBeGreaterThan(0);
      expect(new Set(province.districts).size).toBe(province.districts.length);
    }
    expect(new Set(PROVINCES.map((p) => p.name)).size).toBe(81);
  });

  it('bilinen örnekler', () => {
    expect(findProvince('İstanbul')?.plate).toBe(34);
    expect(districtsOf('İstanbul')).toHaveLength(39);
    expect(districtsOf('Ankara')).toContain('Çankaya');
    expect(districtsOf('Samsun')).toContain('19 Mayıs');
    expect(findProvince('Afyonkarahisar')?.plate).toBe(3);
    expect(districtsOf('Bilinmeyen')).toEqual([]);
  });

  it('ilçeler Türk alfabesine göre sıralı', () => {
    const collator = new Intl.Collator('tr');
    for (const province of PROVINCES) {
      const sorted = [...province.districts].sort(collator.compare);
      expect(province.districts).toEqual(sorted);
    }
  });
});
