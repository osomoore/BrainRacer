import { starterWordProblems } from '../../workshop/content/starterWords';
import type { WorkshopCatalog } from '../../workshop/core/types';
import { BIOME_NAMES, ITEM_NAMES } from './phrases';

// World has no Workshop part or station labels to exempt.
const NO_SHOP_NAMES: WorkshopCatalog = {
  id: 'race', title: '', stats: [], aspects: [], variants: [], scenarios: [],
  facetPhrases: [], scenarioPhrases: [], unlockOrder: [], starters: [],
};

// Allow whole map and item names. Other words still use the Workshop checker.
const names = [...Object.values(BIOME_NAMES), ...Object.values(ITEM_NAMES)]
  .sort((a, b) => b.length - a.length);
const worldNames = new RegExp(`(?<![\\p{L}\\p{N}])(?:${names.join('|')})(?![\\p{L}\\p{N}])`, 'giu');
const worldSoundOut = new Set(['bring', 'home']);

export function questStarterWordProblems(text: string): string[] {
  return starterWordProblems(NO_SHOP_NAMES, text.replace(worldNames, '#'))
    .filter((word) => !worldSoundOut.has(word));
}
