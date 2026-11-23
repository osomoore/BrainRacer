/**
 * Dino Lab scene kit. Public surface for scenario players (`run/dino/<scenarioId>.ts`):
 *   scenario(id, run, opts)       wrap a script `(a: Act) => Promise<void>` into a ScenarioPlayer
 *   Act                           per-stage helper: world container, levels, tweens, hop/walk, particles, cleanup
 *   backdrop/sky/clouds/sun/ground/cliff/farBackdrop   environment builders (world.ts)
 *   Critter/Bird/Friend/BigDino   cartoon creatures (critters.ts)
 *   image/def/...                 baked picture registry and canvas primitives (paint.ts, art.ts)
 *   layout.ts                     pure sizing maths per scenario (unit tested)
 */
import './art';

export { Act } from './act';
export type { BurstOpts, FxKind } from './act';
export * from './art';
export * from './critters';
export * from './layout';
export { image, swap } from './paint';
export * from './world';
export * from './ramp';
export * from './hide';
