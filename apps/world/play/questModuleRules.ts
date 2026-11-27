import type { WorldQuery } from '../core/runtime';
import type { BiomeId, HexPlan, Quest, Vec } from '../core/types';
import { QUESTS, WORLD_PLAY, WORLD_QUEST_HUD } from '../config';
import { questFor } from '../quests/gen';
import type { QuestContact } from '../quests/track';

export function touches(point: Vec, spot: Vec, radius: number): boolean {
  return (point.x - spot.x) ** 2 + (point.y - spot.y) ** 2 <= radius ** 2;
}

export function questContact(plan: HexPlan, point: Vec): QuestContact {
  return {
    biome: plan.biome,
    giverId: plan.giver && touches(point, plan.giver.at, WORLD_QUEST_HUD.talkRadius) ? plan.giver.id : undefined,
    homeId: plan.home && touches(point, plan.home.at, WORLD_PLAY.homeRadius) ? plan.home.id : undefined,
  };
}

export function offerAt(world: Pick<WorldQuery, 'seed' | 'plan' | 'hexesNear'>, plan: HexPlan, n: number): Quest | undefined {
  const { giver } = plan;
  if (!giver) return;
  const plans = world.hexesNear(giver.at.x, giver.at.y, QUESTS.nearbyRings).map(coord => world.plan(coord));
  const biomes = new Set(plans.map(plan => plan.biome));
  const missingFetchBiomes = new Set<BiomeId>();
  while (true) {
    const quest = questFor(world.seed, giver, plan.coord, n, biome => biomes.has(biome) && !missingFetchBiomes.has(biome));
    const { fromBiome } = quest;
    if (!fromBiome || plans.some(plan => plan.biome === fromBiome && plan.items.some(item => item.item === quest.item))) {
      return quest;
    }
    // A biome may exist nearby without generating the selected item (e.g. a Jungle with only ferns).
    missingFetchBiomes.add(fromBiome);
  }
}
