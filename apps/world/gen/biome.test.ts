import { describe, expect, it } from 'vitest';
import { BIOME_IDS, type BiomeId } from '../core/types';
import { biomeAt, homeHexFor, isCamp } from './biome';
import { distance, ring } from './hex';
import { hash } from './random';

describe('biome field', () => {
  it('is stable, spatially coherent, and covers every biome in a 20-ring area', () => {
    const counts = new Map<BiomeId, number>(BIOME_IDS.map(id => [id, 0]));
    for (let q = -20; q <= 20; q++) for (let r = -20; r <= 20; r++) {
      if (distance({ q, r }, { q: 0, r: 0 }) > 20) continue;
      const at = { q, r };
      const biome = biomeAt(417, at);
      expect(biomeAt(417, at)).toBe(biome);
      counts.set(biome, counts.get(biome)! + 1);
    }
    for (const count of counts.values()) expect(count / 1261).toBeGreaterThanOrEqual(0.04);
    for (const count of counts.values()) expect(count / 1261).toBeLessThanOrEqual(0.2);
  });

  it('keeps every biome between 4% and 20% across 256 world seeds', () => {
    const area: { q: number; r: number }[] = [];
    for (let q = -20; q <= 20; q++) for (let r = -20; r <= 20; r++) {
      if (distance({ q, r }, { q: 0, r: 0 }) <= 20) area.push({ q, r });
    }
    for (let seed = 0; seed < 256; seed++) {
      const counts = new Map<BiomeId, number>(BIOME_IDS.map(id => [id, 0]));
      for (const coord of area) {
        const biome = biomeAt(seed, coord);
        counts.set(biome, counts.get(biome)! + 1);
      }
      for (const count of counts.values()) {
        expect(count / area.length, `seed ${seed}`).toBeGreaterThanOrEqual(0.04);
        expect(count / area.length, `seed ${seed}`).toBeLessThanOrEqual(0.2);
      }
    }
  });

  it('makes camps deterministic meadow hexes and homes deterministic in rings two through four', () => {
    const area = ring({ q: 0, r: 0 }, 12);
    for (const c of area) if (isCamp(23, c)) expect(biomeAt(23, c)).toBe('meadow');
    const home = homeHexFor(23, 'profile-a');
    expect(distance(home, { q: 0, r: 0 })).toBeGreaterThanOrEqual(2);
    expect(distance(home, { q: 0, r: 0 })).toBeLessThanOrEqual(4);
    const second = homeHexFor(23, 'profile-b', [home]);
    expect(second).not.toEqual(home);
    expect(homeHexFor(23, 'profile-a')).toEqual(home);
  });

  it('hashes typed parts deterministically', () => {
    expect(hash(7, 'x', 4)).toBe(hash(7, 'x', 4));
    expect(hash(7, 'x', 4)).not.toBe(hash(7, 'x', 5));
    expect(hash(7, 1)).not.toBe(hash(7, '1'));
  });
});
