import { Rng } from '../../workshop/core/rng';
import { QUESTS } from '../config';
import { BIOME_IDS } from '../core/types';
import type { BiomeId, HexCoord, ItemId, Quest, QuestGiverSpot, QuestGoal } from '../core/types';
import { questText } from './text';

// Match W1's biome-native item spots. Eggs can occur anywhere and are optional.
const FETCH_ITEMS: Record<BiomeId, readonly ItemId[]> = {
  meadow: ['feather'], mud: ['mudPie'], rocky: ['rock'], lake: ['shell'], darkwood: ['pinecone'],
  snow: ['snowball'], desert: ['cactusFlower'], jungle: ['pinecone', 'fern'], canyon: ['crystal'], geyser: ['crystal'],
};

export function questId(giverId: string, n: number): string {
  return `${giverId}#${n}`;
}

/** `nearby` reports biomes within QUESTS.nearbyRings of this giver. */
export function questFor(
  seed: number, giver: QuestGiverSpot, giverHex: HexCoord, n: number, nearby: (biome: BiomeId) => boolean,
): Quest {
  const id = questId(giver.id, n);
  let hash = seed;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 0x01000193);
  const rng = new Rng(hash);
  const base = { id, giverId: giver.id, giverHex: { ...giverHex } };

  if (rng.chance(QUESTS.fetchChance)) {
    const biomes = BIOME_IDS.filter(nearby);
    if (biomes.length) {
      const fromBiome = rng.pick(biomes);
      const item = rng.pick(FETCH_ITEMS[fromBiome]);
      return {
        ...base, kind: 'fetch', item, fromBiome, goal: { kind: 'giver' }, stars: QUESTS.stars.fetch,
        text: questText(rng, { kind: 'fetch', item, fromBiome, who: giver.who }),
      };
    }
  }

  const duck = nearby('lake') && rng.chance(QUESTS.duckChance);
  const item = duck ? 'duck' : 'lamb';
  const goal: QuestGoal = duck ? { kind: 'biome', biome: 'lake' } : { kind: 'home' };
  return {
    ...base, kind: 'deliver', item, goal, stars: QUESTS.stars.deliver,
    text: questText(rng, { kind: 'deliver', item, goal, who: giver.who }),
  };
}
