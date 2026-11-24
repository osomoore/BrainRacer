/** Race Shop catalog (Race Shop content package). */
import type { WorkshopCatalog } from '../../core/types';
import { CLEVER_WIN_PHRASES } from '../cleverWinPhrases';
import { RACE_ASPECTS, RACE_VARIANTS } from './variants';
import { RACE_STATS } from './stats';
import { RACE_SCENARIOS } from './scenarios';
import { RACE_FACET_PHRASES, RACE_PART_ALIASES, RACE_SCENARIO_PHRASES } from './phrases';
import { RACE_UNLOCK_ORDER } from './unlocks';
import { RACE_STARTERS } from './starters';

export { RACE_SCENE_NOTES } from './sceneNotes';

export const RACE_CATALOG: WorkshopCatalog = {
  id: 'race',
  title: 'Race Shop',
  stats: RACE_STATS,
  aspects: RACE_ASPECTS,
  variants: RACE_VARIANTS,
  scenarios: RACE_SCENARIOS,
  facetPhrases: RACE_FACET_PHRASES,
  scenarioPhrases: RACE_SCENARIO_PHRASES,
  cleverWinPhrases: CLEVER_WIN_PHRASES,
  partAliases: RACE_PART_ALIASES,
  unlockOrder: RACE_UNLOCK_ORDER,
  starters: RACE_STARTERS,
};
