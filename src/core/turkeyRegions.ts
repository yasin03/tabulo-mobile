// Türkiye il / ilçe listesi (6.2). Kaynak ve doğrulama: assets/data/tr-il-ilce.json (bkz. turkeyRegions.test.ts).

import data from '../../assets/data/tr-il-ilce.json';

export interface Province {
  /** Plaka kodu (1–81). */
  plate: number;
  name: string;
  /** Türk alfabesine göre sıralı. */
  districts: readonly string[];
}

export const PROVINCES: readonly Province[] = data;

const byName = new Map(PROVINCES.map((p) => [p.name, p]));

export function findProvince(name: string | null | undefined): Province | undefined {
  return name ? byName.get(name) : undefined;
}

/** İlin ilçeleri; il bilinmiyorsa boş liste. */
export function districtsOf(provinceName: string | null | undefined): readonly string[] {
  return findProvince(provinceName)?.districts ?? [];
}
