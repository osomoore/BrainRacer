import type { RewardKind } from '../core/types';
import type { Rng } from '../core/rng';

export type Flavor = Exclude<RewardKind, 'turbo'>;
export const FLAVORS: readonly Flavor[] = ['rainbow', 'shockwave', 'ghost', 'magnet'];

/** Weighted random flavor, never equal to `last` (when other flavors have weight). */
export function pickFlavor(rng: Rng, weights: Record<Flavor, number>, last: Flavor | null): Flavor {
  const items = FLAVORS.filter((f) => f !== last && weights[f] > 0);
  if (items.length === 0) return last ?? FLAVORS[0];
  return rng.weighted(items, items.map((f) => weights[f]));
}

/** New remaining turbo time after a correct answer while turbo may already be active. */
export function extendTurbo(remaining: number, addSec: number, maxSec: number): number {
  return Math.min(Math.max(0, remaining) + addSec, Math.max(maxSec, addSec));
}
