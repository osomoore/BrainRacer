import { WS_RULES } from '../config';
import { solveAffordable } from './affordability';
import { flatChecks } from './util';
import type { Challenge, StarterSpec, WorkshopCatalog } from '../core/types';
import { resolveSpec } from './text';
import { hashSeed } from './util';

/** StarterSpec -> Challenge (source 'starter', tier 0, id = spec id). Deterministic. */
export function starterChallenge(cat: WorkshopCatalog, spec: StarterSpec): Challenge {
  return resolveSpec(cat, spec, { id: spec.id, source: 'starter', tier: 0, seed: hashSeed(`${cat.id}:${spec.id}`) });
}

const starterCache = new WeakMap<WorkshopCatalog, Map<string, Challenge[]>>();

/** Keep only starters whose cheapest fresh-profile build needs one base-price purchase. */
export function currencyStarters(cat: WorkshopCatalog, easy?: boolean): readonly Challenge[] {
  let byLevel = starterCache.get(cat);
  if (!byLevel) { byLevel = new Map(); starterCache.set(cat, byLevel); }
  const key = easy ? 'easy' : 'all';
  let starters = byLevel.get(key);
  if (!starters) {
    const fresh = { bought: [], overrides: {}, wallet: WS_RULES.startWallet, ...(easy ? { easy: true as const } : {}) };
    starters = cat.starters.map((spec) => starterChallenge(cat, spec)).filter((challenge) =>
      solveAffordable(cat, flatChecks(challenge), fresh)?.cost === WS_RULES.basePrice);
    byLevel.set(key, starters);
  }
  return starters;
}
