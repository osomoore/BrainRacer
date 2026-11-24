import type { Check, WorkshopCatalog, WorkshopProgress } from '../core/types';
import { available } from './available';
import { purchaseRoutes } from './shop';
import { solve } from './solver';

export const BOARD_CATEGORIES = ['ready', 'affordable', 'future'] as const;
export type BoardCategory = typeof BOARD_CATEGORIES[number];

/** Find the cheapest complete build across all options, including zero-cost owned solutions. */
export function affordability(cat: WorkshopCatalog, progress: Pick<WorkshopProgress, 'wallet' | 'bought' | 'overrides'>) {
  const owned = available(cat, progress);
  const routes = purchaseRoutes(cat, progress);
  const prices = new Map([...routes].map(([id, route]) => [id, route.cost]));
  const futurePool = new Set([...owned, ...prices.keys()]);
  const pool = new Set(owned);
  for (const [variant, price] of prices) {
    if (price <= progress.wallet) pool.add(variant);
  }
  return {
    owned,
    pool,
    futurePool,
    routes,
    solve: (checks: readonly Check[]) => solve(cat, checks, pool, {
      variantCosts: prices, costLimit: progress.wallet + 1,
    }),
    cheapest: (checks: readonly Check[]) => solve(cat, checks, futurePool, { variantCosts: prices }),
  };
}

export function boardCategory(cost: number, wallet: number): BoardCategory {
  if (cost === 0) return 'ready';
  return cost <= wallet ? 'affordable' : 'future';
}

export function solveAffordable(cat: WorkshopCatalog, checks: readonly Check[], progress: Pick<WorkshopProgress, 'wallet' | 'bought' | 'overrides'>) {
  return affordability(cat, progress).solve(checks);
}
