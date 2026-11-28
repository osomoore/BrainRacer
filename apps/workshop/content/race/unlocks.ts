/**
 * Order in which first-time wins hand out new variants (every non-starter exactly once).
 * Gentle ramp: the first unlocks open the tier-1 scenarios (parade, snow, beach, rocky clearance, narrow alley,
 * wobbly bridge), then the tier-2 tools (snorkel, winch, bouncy springs, pusher, dark paint, quiet motor),
 * then the parts that push existing facets to their top levels.
 */
import type { VariantId } from '../../core/types';

export const RACE_UNLOCK_ORDER: readonly VariantId[] = [
  'paint.red', // parade 1
  'wheels.snow', // snow 1-2
  'engine.efficient', // beach 1-2, quiet 1
  'springs.lifted', // rocky clearance 1-2
  'size.tiny', // narrow 2, low bridge 3, wobbly 2
  'wheels.racing', // turns, jumps
  'body.jeep', // rocks, mud 2
  'extra.snorkel', // river 1
  'extra.winch', // mud pull
  'springs.bouncy', // jump landing
  'bumpers.pusher', // fallen log
  'paint.black', // hide-and-seek
  'engine.electric', // quiet 2, wobbly 3
  'gears.climbing', // hill 2-3, mud pull 2
  'extra.floats', // river 2
  'paint.green', // parade 2
  'body.van', // delivery 2-3
  'body.sports', // speed, light, low
  'gears.fourByFour', // mud 3, snow 3
  'size.big', // delivery 3, toughness
  'shape.sleek', // speed, range, narrow
  'bumpers.rubber', // toughness 3, landing 2
  'extra.spoiler', // turn 3
  'engine.turbo', // jump 3
  'shape.wedge', // log 2, low bridge
  'wheels.monster', // rocks, mud
  'paint.rainbow', // parade 3
  'extra.rallyLights', // dark roads
  'extra.radiator', // hot roads
];
