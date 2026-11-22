/**
 * Run scene kit: player boilerplate.
 *
 *   export default racePlayer('mud', async (ctx) => {
 *     const plan = planStage(ctx, ['mud.grip', 'mud.pull']);   // facets in left-to-right order; plan.level('mud.grip')
 *     ... build the scene with plan.level(...) ...
 *     await plan.run({ 'mud.grip': async (p) => { p.pass ? ... : ... }, ... });   // runs phases up to and including the gag
 *     if (plan.ok) { success finale }
 *   });
 * Each phase receives its FacetPlay: `pass` (show success), `gag` (this is THE failure gag: stage ends after it).
 */
import type { FacetId } from '../../core/types';
import type { ScenarioPlayer, StageContext } from '../types';
import { type FacetPlay, facetPlays, orderPlays, playsUntilGag } from './plan';

export interface Plan {
  /** Facets in spatial order, cut after the gag. */
  readonly plays: FacetPlay[];
  /** All facets (not cut), spatial order. */
  readonly all: FacetPlay[];
  readonly ok: boolean;
  readonly gag: FacetPlay | undefined;
  has(f: FacetId): boolean;
  level(f: FacetId, dflt?: number): number;
  /** Max level among facets of this stage (for scenes with a single "difficulty"). */
  maxLevel(): number;
  run(phases: Record<FacetId, (p: FacetPlay) => Promise<void>>): Promise<void>;
}

export function planStage(ctx: StageContext, order: readonly FacetId[]): Plan {
  const all = orderPlays(facetPlays(ctx.stage, ctx.result, ctx.requirements), order);
  const plays = playsUntilGag(all);
  const gag = all.find((p) => p.gag);
  return {
    plays, all, ok: !gag, gag,
    has: (f) => all.some((p) => p.facet === f),
    level: (f, d = 1) => all.find((p) => p.facet === f)?.level ?? d,
    maxLevel: () => Math.max(1, ...all.map((p) => p.level)),
    async run(phases) { for (const p of plays) { const fn = phases[p.facet]; if (fn) await fn(p); } },
  };
}

export function racePlayer(scenario: string, play: (ctx: StageContext) => Promise<void>): ScenarioPlayer {
  return { workshop: 'race', scenario, play };
}
