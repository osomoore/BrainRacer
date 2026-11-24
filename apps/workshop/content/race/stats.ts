/**
 * Race Shop stats. Kids never see numbers; requirements compare these.
 * Base values are chosen so the default model (first starter of every aspect) has the stats listed in `note`:
 * the default-model starters mostly add nothing; the Roof Rack adds load +2 and height +1.
 * Scale: 0..10, default car around 3.
 */
import type { StatDef } from '../../core/types';

const s = (id: string, label: string, base: number): StatDef => ({ id, label, base, min: 0, max: 10 });

export const RACE_STATS: readonly StatDef[] = [
  s('speed', 'Top speed (jumps)', 3),
  s('power', 'Pulling power (hills, heavy loads)', 3),
  s('handling', 'Handling (sharp turns)', 3),
  s('mudGrip', 'Grip in mud', 1),
  s('snowGrip', 'Grip on snow and ice', 1),
  s('toughness', 'Toughness (rocks, bumps)', 2),
  s('load', 'Cargo room', 1), // default 3 with the Roof Rack
  s('weight', 'Weight (wobbly bridges)', 4),
  s('height', 'Height (low bridges)', 2), // default 3 with the Roof Rack
  s('width', 'Width (narrow paths)', 3),
  s('clearance', 'Ground clearance (rocks, deep water)', 2),
  s('range', 'Range (long trips)', 3),
  s('push', 'Pushing (logs)', 1),
  s('noise', 'Noise (sleepy town)', 3),
  s('bounce', 'Soft landing (jumps)', 2),
];
