import type { Challenge, StarterSpec, WorkshopCatalog } from '../core/types';
import { resolveSpec } from './text';
import { hashSeed } from './util';

/** StarterSpec -> Challenge (source 'starter', tier 0, id = spec id). Deterministic. */
export function starterChallenge(cat: WorkshopCatalog, spec: StarterSpec): Challenge {
  return resolveSpec(cat, spec, { id: spec.id, source: 'starter', tier: 0, seed: hashSeed(`${cat.id}:${spec.id}`) });
}
