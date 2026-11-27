import { describe, expect, it } from 'vitest';
import { chunkKey, LruCache, prioritizeChunks } from './terrainCore';

describe('terrain chunk bookkeeping', () => {
  it('uses stable floor-based keys, including negative world coordinates', () => {
    expect(chunkKey(-1, 2)).toBe('-1,2');
    expect(chunkKey(0, 0)).toBe('0,0');
  });

  it('promotes reads and evicts the least recently used value', () => {
    const cache = new LruCache<number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(1);
    expect(cache.set('c', 3)).toBe(2);
    expect(cache.has('b')).toBe(false);
    expect(cache.has('a')).toBe(true);
  });

  it('prioritizes proximity, then ahead-of-heading chunks', () => {
    const ordered = prioritizeChunks([
      { x: 0, y: 0, distance: 1, heading: 0, dx: -10, dy: 0 },
      { x: 1, y: 0, distance: 1, heading: 0, dx: 10, dy: 0 },
      { x: 2, y: 0, distance: 0.2, heading: 0, dx: 0, dy: 0 },
    ]);
    expect(ordered.map(({ x }) => x)).toEqual([2, 1, 0]);
  });
});
