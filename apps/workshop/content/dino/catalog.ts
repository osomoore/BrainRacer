/**
 * Dino Lab catalog: stats, variants, scenarios, phrases, unlock order and the five starters.
 * Balance is checked in catalog.test.ts (default fails every starter, every facet level solvable, T-Rex payoff).
 */
import type { StarterSpec, VariantId, WorkshopCatalog } from '../../core/types';
import { DINO_ASPECTS, DINO_VARIANTS } from './variants';
import { DINO_STATS } from './stats';
import { DINO_SCENARIOS } from './scenarios';
import { DINO_FACET_PHRASES, DINO_PART_ALIASES, DINO_SCENARIO_PHRASES } from './phrases';

export { DINO_SCENE_NOTES } from './sceneNotes';

/** Gentle ramp: new habitats first (desert, river, high trees), the T-Rex parts last. */
export const DINO_UNLOCK_ORDER: readonly VariantId[] = [
  'color.sandy', 'legs.flippers', 'head.longNeck', 'teeth.beak', 'move.fly', 'body.sail',
  'claws.digging', 'legs.hoppy', 'head.crest', 'extra.glow', 'color.blue', 'tail.paddle',
  'size.big', 'teeth.sharp', 'body.armored', 'extra.stripes', 'move.swim', 'claws.grabby',
  'tail.spiked', 'color.spotted', 'extra.camo', 'body.belly', 'color.purple',
  // T-Rex parts
  'legs.powerful', 'tail.heavy', 'head.rex', 'claws.tinyArms', 'size.huge', 'teeth.mega',
];

const one = (id: string, scenario: string, facet: string, level = 1): StarterSpec =>
  ({ id, stages: [{ scenario, facets: [{ facet, level }] }] });

export const DINO_STARTERS: readonly StarterSpec[] = [
  one('dino-start-teeth', 'snack', 'snack.bite'), // fix: teeth.big
  one('dino-start-green', 'ferns', 'ferns.hide'), // fix: color.green
  one('dino-start-jump', 'ledge', 'ledge.jump'), // fix: legs.long
  one('dino-start-hole', 'burrow', 'burrow.fit'), // fix: size.small
  one('dino-start-stand', 'tallGrass', 'tallGrass.peek'), // fix: move.stand
];

export const DINO_CATALOG: WorkshopCatalog = {
  id: 'dino',
  title: 'Dino Lab',
  stats: DINO_STATS,
  aspects: DINO_ASPECTS,
  variants: DINO_VARIANTS,
  scenarios: DINO_SCENARIOS,
  facetPhrases: DINO_FACET_PHRASES,
  scenarioPhrases: DINO_SCENARIO_PHRASES,
  partAliases: DINO_PART_ALIASES,
  unlockOrder: DINO_UNLOCK_ORDER,
  starters: DINO_STARTERS,
};
