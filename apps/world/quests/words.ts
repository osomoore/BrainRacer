import { starterWordProblems } from '../../workshop/content/starterWords';
import type { WorkshopCatalog } from '../../workshop/core/types';
import { BIOME_NAMES, ITEM_NAMES } from './phrases';

// World has no Workshop part or station labels to exempt.
const NO_SHOP_NAMES: WorkshopCatalog = {
  id: 'race', title: '', stats: [], aspects: [], variants: [], scenarios: [],
  facetPhrases: [], scenarioPhrases: [], unlockOrder: [], starters: [],
};

// Allow names of places, items and the pictured hand control. Check other words with Workshop rules.
const names = [...Object.values(BIOME_NAMES), ...Object.values(ITEM_NAMES),
  'cow pen', 'cows', 'farm', 'pond', 'hand', 'ring', 'roar']
  .sort((a, b) => b.length - a.length);
const worldNames = new RegExp(`(?<![\\p{L}\\p{N}])(?:${names.join('|')})(?![\\p{L}\\p{N}])`, 'giu');
const worldSoundOut = new Set(['bring', 'home']);

export function questStarterWordProblems(text: string): string[] {
  return starterWordProblems(NO_SHOP_NAMES, text.replace(worldNames, '#'))
    .filter((word) => !worldSoundOut.has(word));
}
