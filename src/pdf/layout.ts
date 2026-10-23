// PDF sayfa ölçüleri (pt, 72 PPI).

/** A4 (expo-print `width` / `height`). */
export const A4 = { width: 595, height: 842 } as const;
/** Kenar boşlukları. iOS'ta expo-print `margins` seçeneğiyle, Android'de `@page` kuralıyla uygulanır. */
export const PAGE_MARGINS = { top: 36, right: 32, bottom: 36, left: 32 } as const;
