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

const starterCache = new WeakMap<WorkshopCatalog, Challenge[]>();

/** Keep only starters whose cheapest fresh-profile build needs one base-price purchase. */
export function currencyStarters(cat: WorkshopCatalog): readonly Challenge[] {
  let starters = starterCache.get(cat);
  if (!starters) {
    const fresh = { bought: [], overrides: {}, wallet: WS_RULES.startWallet };
    starters = cat.starters.map((spec) => starterChallenge(cat, spec)).filter((challenge) =>
      solveAffordable(cat, flatChecks(challenge), fresh)?.cost === WS_RULES.basePrice);
    starterCache.set(cat, starters);
  }
  return starters;
}
