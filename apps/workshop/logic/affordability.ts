import type { Check, WorkshopCatalog, WorkshopProgress } from '../core/types';
import { available } from './available';
import { purchaseCosts } from './shop';
import { solve } from './solver';

/** Each build uses one part per aspect. Either offer at a station costs the same for its next purchase. */
export function affordability(cat: WorkshopCatalog, progress: Pick<WorkshopProgress, 'wallet' | 'bought' | 'overrides'>) {
  const owned = available(cat, progress);
  const prices = purchaseCosts(cat, progress);
  const pool = new Set(owned);
  for (const [variant, price] of prices) {
    if (price <= progress.wallet) pool.add(variant);
  }
  return {
    owned,
    pool,
    solve: (checks: readonly Check[]) => solve(cat, checks, pool, {
      variantCosts: prices, costLimit: progress.wallet + 1,
    }),
  };
}

export function solveAffordable(cat: WorkshopCatalog, checks: readonly Check[], progress: Pick<WorkshopProgress, 'wallet' | 'bought' | 'overrides'>) {
  return affordability(cat, progress).solve(checks);
}
