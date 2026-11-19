/**
 * Place words that can appear as buildings in the CITY biome (Phase 1). Each must have >= 1 image
 * in scenes.json; ideally >= 2 so the rooftop sign and the challenge use different art.
 * Countryside/industrial lists are for Wave 5.
 */
import { scenesForWord } from './scenes';

const CITY_CANDIDATES = [
  'school', 'house', 'library', 'shop', 'hospital', 'fire station', 'police station', 'church',
  'playground', 'zoo', 'train station', 'restaurant', 'bakery', 'post office', 'museum', 'castle',
  'park', 'tower', 'fountain', 'stadium',
];
const COUNTRY_CANDIDATES = ['farm', 'barn', 'windmill', 'wind turbine', 'campsite', 'lake', 'forest', 'well', 'cave'];
const INDUSTRIAL_CANDIDATES = ['water tower', 'dam', 'harbor', 'lighthouse', 'airport', 'bridge'];

const present = (w: string) => scenesForWord(w).length > 0;

export const CITY_PLACE_WORDS: readonly string[] = CITY_CANDIDATES.filter(present);
export const COUNTRY_PLACE_WORDS: readonly string[] = COUNTRY_CANDIDATES.filter(present);
export const INDUSTRIAL_PLACE_WORDS: readonly string[] = INDUSTRIAL_CANDIDATES.filter(present);
/** Farm map: the countryside list plus a few town words for the village crossroads. */
export const FARM_VILLAGE_WORDS: readonly string[] = ['house', 'shop', 'bakery', 'school'].filter(present);
export const FARM_PLACE_WORDS: readonly string[] = [...COUNTRY_PLACE_WORDS, ...FARM_VILLAGE_WORDS];

/** Scene used for the rooftop sign of a place (stable: first image of that word). */
export function signSceneFor(word: string): string {
  const list = scenesForWord(word);
  if (!list.length) throw new Error(`no image for place ${word}`);
  return list[0].id;
}

/** Scenes usable in a challenge about a place: different art from the sign when possible. */
export function challengeScenesFor(word: string): string[] {
  const list = scenesForWord(word).map((s) => s.id);
  return list.length > 1 ? list.slice(1) : list;
}
