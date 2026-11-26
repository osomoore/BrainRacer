import { WS_RULES } from '../config';
import { affordability } from './affordability';
import { flatChecks } from './util';
import type { Challenge, StarterSpec, WorkshopCatalog } from '../core/types';
import { resolveSpec } from './text';
import { hashSeed } from './util';

/** StarterSpec -> Challenge (source 'starter', tier 0, id = spec id). Deterministic. */
export function starterChallenge(cat: WorkshopCatalog, spec: StarterSpec): Challenge {
  return resolveSpec(cat, spec, { id: spec.id, source: 'starter', tier: 0, seed: hashSeed(`${cat.id}:${spec.id}`) });
}

interface CurrencyStarter {
  challenge: Challenge;
  shopPart?: StarterSpec['shopPart'];
}

const starterCache = new WeakMap<WorkshopCatalog, Map<string, CurrencyStarter[]>>();

/** Keep base-price starters and cards that introduce a part sold at a visible station. */
export function currencyStarters(cat: WorkshopCatalog, easy?: boolean): readonly CurrencyStarter[] {
  let byLevel = starterCache.get(cat);
  if (!byLevel) { byLevel = new Map(); starterCache.set(cat, byLevel); }
  const key = easy ? 'easy' : 'all';
  let starters = byLevel.get(key);
  if (!starters) {
    const budget = affordability(cat, { bought: [], overrides: {}, wallet: WS_RULES.startWallet, easy: easy ? true : undefined });
    starters = cat.starters.map((spec) => ({ challenge: starterChallenge(cat, spec), shopPart: spec.shopPart }))
      .filter(({ challenge, shopPart }) => shopPart ? budget.routes.has(shopPart)
        : budget.solve(flatChecks(challenge))?.cost === WS_RULES.basePrice);
    byLevel.set(key, starters);
  }
  return starters;
}
