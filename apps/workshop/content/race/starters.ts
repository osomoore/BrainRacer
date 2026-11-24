/**
 * Race Shop starter challenges (offered first, in order). Each fails with the default model and is fixed by one part:
 *   race-start-mud    mud.grip 1       -> wheels: Mud Tires
 *   race-start-jump   jump.speed 1     -> gears: Speed Gears, or extras: Rocket Booster
 *   race-start-turn   turn.handling 1  -> springs: Sport Springs (top view)
 *   race-start-hill   hill.power 1     -> engine: Big Engine
 *   race-start-bright fog.bright 1     -> paint: Bright Yellow
 */
import type { StarterSpec } from '../../core/types';

const one = (id: string, scenario: string, facet: string, level = 1): StarterSpec =>
  ({ id, stages: [{ scenario, facets: [{ facet, level }] }] });

export const RACE_STARTERS: readonly StarterSpec[] = [
  one('race-start-mud', 'mud', 'mud.grip'),
  one('race-start-jump', 'jump', 'jump.speed'),
  one('race-start-turn', 'turn', 'turn.handling'),
  one('race-start-hill', 'hill', 'hill.power'),
  one('race-start-bright', 'fog', 'fog.bright'),
];
