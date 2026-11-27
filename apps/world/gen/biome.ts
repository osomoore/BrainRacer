import { GEN } from '../config';
import { BIOME_IDS, type BiomeId, type HexCoord } from '../core/types';
import { hexKey, ring } from './hex';
import { hash, hash01 } from './random';

const OTHER_BIOMES = BIOME_IDS.filter((id): id is Exclude<BiomeId, 'meadow'> => id !== 'meadow');

function smooth(t: number): number { return t * t * (3 - 2 * t); }

// Approximate the normal CDF so value noise's center-heavy distribution maps to balanced biome bands.
function normalCdf(x: number): number {
  const z = Math.abs(x), t = 1 / (1 + 0.2316419 * z);
  const tail = 0.3989423 * Math.exp(-z * z / 2) * t * (
    0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))
  );
  return x >= 0 ? 1 - tail : tail;
}

function latticeValue(seed: number, q: number, r: number): number {
  return hash01(seed, 'biome-field', q, r);
}

/** A deterministic low-frequency value-noise field in [0,1). */
function field(seed: number, coord: HexCoord): number {
  const x = (coord.q + coord.r * 0.5) / GEN.biomeScale;
  const y = (coord.r * Math.sqrt(3) / 2) / GEN.biomeScale;
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = smooth(x - ix), fy = smooth(y - iy);
  const a = latticeValue(seed, ix, iy), b = latticeValue(seed, ix + 1, iy);
  const c = latticeValue(seed, ix, iy + 1), d = latticeValue(seed, ix + 1, iy + 1);
  const top = a + (b - a) * fx, bottom = c + (d - c) * fx;
  return top + (bottom - top) * fy;
}

/** Public camps appear deterministically in roughly one of every twelve hexes. */
export function isCamp(seed: number, coord: HexCoord): boolean {
  return hash01(seed, 'camp', coord.q, coord.r) < GEN.campChance;
}

/** Return the same biome for the same seed/hex; camps use meadow ground. */
export function biomeAt(seed: number, coord: HexCoord): BiomeId {
  if (isCamp(seed, coord)) return 'meadow';
  // Two channels soften grid artifacts. The CDF balances the center-heavy interpolated values.
  const raw = field(seed, coord) * 0.82 + field(seed ^ 0x5bd1e995, coord) * 0.18;
  const v = normalCdf((raw - 0.5) / 0.18);
  // Camp overrides already supply most meadow hexes, so reserve a smaller field band for meadow.
  if (v < GEN.meadowFieldShare) return 'meadow';
  const remaining = (v - GEN.meadowFieldShare) / (1 - GEN.meadowFieldShare);
  return OTHER_BIOMES[Math.floor(remaining * OTHER_BIOMES.length)];
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
