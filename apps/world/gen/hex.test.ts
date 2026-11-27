import { describe, expect, it } from 'vitest';
import { corners, distance, edgeMidpoint, hexToWorld, hexKey, neighbor, neighbors, ring, worldToHex } from './hex';

describe('hex geometry', () => {
  it('round trips centers and keeps neighbors at distance one', () => {
    for (let q = -8; q <= 8; q++) for (let r = -8; r <= 8; r++) {
      const coord = { q, r };
      expect(worldToHex(hexToWorld(coord).x, hexToWorld(coord).y)).toEqual(coord);
      expect(neighbors(coord).every(n => distance(coord, n) === 1)).toBe(true);
    }
  });

  it('uses six clockwise edge neighbors starting east', () => {
    const origin = { q: 0, r: 0 };
    expect(Array.from({ length: 6 }, (_, edge) => neighbor(origin, edge))).toEqual([
      { q: 1, r: 0 }, { q: 0, r: 1 }, { q: -1, r: 1 },
      { q: -1, r: 0 }, { q: 0, r: -1 }, { q: 1, r: -1 },
    ]);
    expect(edgeMidpoint(origin, 0).x).toBeGreaterThan(0);
    expect(Math.abs(edgeMidpoint(origin, 0).y)).toBeLessThan(1e-8);
  });

  it('returns a complete ring without duplicate keys', () => {
    for (let radius = 1; radius <= 8; radius++) {
      const coords = ring({ q: 4, r: -7 }, radius);
      expect(coords).toHaveLength(6 * radius);
      expect(new Set(coords.map(hexKey)).size).toBe(coords.length);
      expect(coords.every(c => distance(c, { q: 4, r: -7 }) === radius)).toBe(true);
    }
    expect(corners({ q: 0, r: 0 })).toHaveLength(6);
  });
});
