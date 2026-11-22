/**
 * Race Shop catalog. STUB from the orchestrator: the Race Shop content package replaces stats, scenarios,
 * phrases, unlock order and starters (keep the export name and type).
 */
import type { WorkshopCatalog } from '../../core/types';
import { RACE_ASPECTS, RACE_VARIANTS } from './variants';

export const RACE_CATALOG: WorkshopCatalog = {
  id: 'race',
  title: 'Race Shop',
  stats: [],
  aspects: RACE_ASPECTS,
  variants: RACE_VARIANTS,
  scenarios: [],
  facetPhrases: [],
  scenarioPhrases: [],
  unlockOrder: [],
  starters: [],
};
