import type { HexLive, WorldQuery } from '../core/runtime';
import type { HexPlan, ItemSpot, Quest, Traits, Vec } from '../core/types';
import { QUESTS, WORLD_QUEST_HUD as HUD } from '../config';
import { surfaceEffect } from '../logic/rules';
import { questFor } from '../quests/gen';
import type { QuestContact } from '../quests/track';

type Interactable = {
  at: Vec;
  contact: QuestContact;
  kind: 'giver' | 'item' | 'pond' | 'obstacle' | 'treasure' | 'activity';
  spot?: ItemSpot;
  live: HexLive;
};

export function pondPoints(plan: HexPlan): Vec[] {
  // The duck activity renders its first pond target, or the site when there is no target.
  return plan.activities.filter(site => site.kind === 'duckParade')
    .map(site => site.targets.find(target => target.role === 'pond')?.at ?? site.at);
}

export function nearestInteraction(plans: readonly HexLive[], point: Vec): Interactable | undefined {
  let nearest: Interactable | undefined;
  let fallback: Interactable | undefined;
  let best = Infinity;
  let bestFallback = Infinity;
  for (const live of plans) {
    const { plan, obstacles, takenItems } = live;
    const consider = (
      kind: Interactable['kind'], at: Vec, radius: number, details?: Partial<QuestContact>, spot?: ItemSpot,
    ) => {
      const distance = Math.hypot(point.x - at.x, point.y - at.y);
      if (distance > radius) return;
      const hit = { kind, at, contact: { biome: plan.biome, ...details }, spot, live };
      if (kind === 'obstacle' || kind === 'treasure') {
        if (distance < bestFallback) { bestFallback = distance; fallback = hit; }
        return;
      }
      if (distance >= best) return;
      best = distance;
      nearest = hit;
    };

    if (plan.giver) consider('giver', plan.giver.at, HUD.talkRadius, { giverId: plan.giver.id });
    for (const spot of plan.items) {
      if (!takenItems.has(spot.id)) consider('item', spot.at, HUD.pickupRadius, { target: 'item', item: spot.item }, spot);
    }
    for (const at of pondPoints(plan)) consider('pond', at, HUD.talkRadius, { target: 'pond' });
    for (const obstacle of obstacles.values()) {
      if (!obstacle.gone) consider('obstacle', obstacle.at, obstacle.radius + HUD.pickupRadius);
    }
    if (plan.treasure) consider('treasure', plan.treasure.at, HUD.pickupRadius);
    for (const site of plan.activities) consider('activity', site.at, site.radius);
  }
  return nearest ?? fallback;
}

export function offerAt(
  world: Pick<WorldQuery, 'seed' | 'live' | 'hexesNear' | 'surfaceAt'>, plan: HexPlan, date: number, traits: Traits,
): Quest | undefined {
  const { giver } = plan;
  if (!giver) return;
  const plans = world.hexesNear(giver.at.x, giver.at.y, QUESTS.nearbyRings).map(coord => world.live(coord));
  const items = new Map<string, { item: ItemSpot['item']; biome: HexPlan['biome'] }>();
  const passable = ({ x, y }: Vec) => surfaceEffect(traits.kind, world.surfaceAt(x, y), traits).passable;
  for (const { plan, takenItems } of plans) {
    for (const spot of plan.items) {
      if (!takenItems.has(spot.id) && passable(spot.at)) items.set(`${plan.biome}:${spot.item}`, { item: spot.item, biome: plan.biome });
    }
  }
  return questFor(world.seed, giver, plan.coord, date, [...items.values()],
    plans.some(({ plan }) => pondPoints(plan).some(passable)), traits);
}
