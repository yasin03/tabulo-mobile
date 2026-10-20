import { moveId } from './order';

describe('moveId', () => {
  it('yukarı ve aşağı taşır', () => {
    expect(moveId(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
    expect(moveId(['a', 'b', 'c'], 'b', 1)).toEqual(['a', 'c', 'b']);
  });

  it('sınırda veya bulunamazsa null', () => {
    expect(moveId(['a', 'b'], 'a', -1)).toBeNull();
    expect(moveId(['a', 'b'], 'b', 1)).toBeNull();
    expect(moveId(['a'], 'x', 1)).toBeNull();
  });
});
