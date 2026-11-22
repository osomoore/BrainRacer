/**
 * Dino Lab catalog. STUB from the orchestrator: the Dino Lab content package replaces stats, scenarios,
 * phrases, unlock order and starters (keep the export name and type).
 */
import type { WorkshopCatalog } from '../../core/types';
import { DINO_ASPECTS, DINO_VARIANTS } from './variants';

export const DINO_CATALOG: WorkshopCatalog = {
  id: 'dino',
  title: 'Dino Lab',
  stats: [],
  aspects: DINO_ASPECTS,
  variants: DINO_VARIANTS,
  scenarios: [],
  facetPhrases: [],
  scenarioPhrases: [],
  unlockOrder: [],
  starters: [],
};
