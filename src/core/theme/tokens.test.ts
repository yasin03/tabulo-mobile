import { readFileSync } from 'fs';
import { join } from 'path';

import { colorTokens, type ThemeMode } from './tokens';

const css = readFileSync(join(__dirname, '../../../global.css'), 'utf8');

function variantBlock(mode: ThemeMode): string {
  const start = css.indexOf(`@variant ${mode} {`);
  if (start === -1) throw new Error(`@variant ${mode} bulunamadı`);
  const end = css.indexOf('\n    }', start);
  return css.slice(start, end);
}

function cssVar(block: string, name: string): string | undefined {
  const match = block.match(new RegExp(`--${name}:\\s*([^;]+);`));
  return match?.[1]?.trim().toLowerCase();
}

describe('tasarım tokenları', () => {
  it.each<ThemeMode>(['light', 'dark'])('%s teması global.css ile birebir aynı', (mode) => {
    const block = variantBlock(mode);
    for (const [name, value] of Object.entries(colorTokens[mode])) {
      expect({ name, value: cssVar(block, name) }).toEqual({ name, value: value.toLowerCase() });
    }
  });

  it('açık ve koyu tema aynı CSS değişkenlerini tanımlar', () => {
    const names = (mode: ThemeMode) =>
      [...variantBlock(mode).matchAll(/--([a-z-]+):/g)].map((m) => m[1]).sort();
    expect(names('dark')).toEqual(names('light'));
  });

  it('koyu temada saf siyah kullanılmaz', () => {
    expect(colorTokens.dark.background.toLowerCase()).not.toBe('#000000');
  });
});
