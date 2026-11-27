import { GEN } from '../config';
import { BIOME_IDS, type BiomeId, type HexCoord } from '../core/types';
import { Rng } from '../../workshop/core/rng';
import { hexKey, ring } from './hex';
import { hash, hash01 } from './random';

/** Public camps appear deterministically in roughly one of every twelve hexes. */
export function isCamp(seed: number, coord: HexCoord): boolean {
  return biomeAt(seed, coord) === 'meadow'
    && hash01(seed, 'camp', coord.q, coord.r) < GEN.campChance * BIOME_IDS.length;
}

/** Deal all ten biomes per block, shuffling independently and shifting the grid by seed. */
export function biomeAt(seed: number, coord: HexCoord): BiomeId {
  const q = coord.q + (hash(seed, 'biome-q') % 5);
  const r = coord.r + (hash(seed, 'biome-r') % 2);
  const blockQ = Math.floor(q / 5), blockR = Math.floor(r / 2);
  const deck = new Rng(hash(seed, 'biome-block', blockQ, blockR)).shuffle([...BIOME_IDS]);
  return deck[(r - blockR * 2) * 5 + (q - blockQ * 5)];
}

/** Pick a stable home in rings 2–4. `occupied` lets callers resolve profile collisions in order. */
export function homeHexFor(seed: number, profileId: string, occupied: readonly HexCoord[] = []): HexCoord {
  const nearby = [2, 3, 4].flatMap(r => ring({ q: 0, r: 0 }, r));
  const privateMeadows: HexCoord[] = [];
  const fallbackNonCamps: HexCoord[] = [];
  const camps: HexCoord[] = [];
  for (const candidate of nearby) {
    if (isCamp(seed, candidate)) camps.push(candidate);
    else if (biomeAt(seed, candidate) === 'meadow') privateMeadows.push(candidate);
    else fallbackNonCamps.push(candidate);
  }
  const tiers = [privateMeadows, fallbackNonCamps, camps];
  const used = new Set(occupied.map(hexKey));
  for (let tierIndex = 0; tierIndex < tiers.length; tierIndex++) {
    const tier = tiers[tierIndex];
    if (tier.length === 0) continue;
    const tierStart = hash(seed, 'home-tier', profileId, tierIndex) % tier.length;
    for (let offset = 0; offset < tier.length; offset++) {
      const candidate = tier[(tierStart + offset) % tier.length];
      if (!used.has(hexKey(candidate))) return candidate;
    }
  }
  // More homes than all nearby hexes: deterministic fallback, still in rings 2–4.
  return nearby[hash(seed, 'home', profileId) % nearby.length];
}
