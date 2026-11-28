import type { HexLive, WorldPlayer, WorldQuery } from '../core/runtime';
import type { ErrandSpot, HexPlan, ItemSpot, Obstacle, Quest, Traits, Vec } from '../core/types';
import { QUESTS, WORLD_QUEST_HUD as HUD } from '../config';
import { isPathLog, touchesPath } from '../gen/errandSites';
import { surfaceEffect } from '../logic/rules';
import { questFor, type QuestPlace } from '../quests/gen';
import type { QuestContact } from '../quests/track';

type Interactable = {
  at: Vec;
  contact: QuestContact;
  kind: 'giver' | 'item' | 'pond' | 'obstacle' | 'treasure' | 'activity' | 'errand';
  spot?: ItemSpot;
  errand?: ErrandSpot;
  obstacle?: Obstacle;
  live: HexLive;
};

export function pondPoints(plan: HexPlan): Vec[] {
  // The duck activity renders its first pond target, or the site when there is no target.
  return plan.activities.filter(site => site.kind === 'duckParade')
    .map(site => site.targets.find(target => target.role === 'pond')?.at ?? site.at);
}

export function deliveryPoint(world: Pick<WorldQuery, 'surfaceAt'>, plan: HexPlan, traits: Traits): Vec {
  const { at } = plan.giver!;
  const towardCenter = Math.atan2(plan.center.y - at.y, plan.center.x - at.x);
  for (const turn of [0, 1, -1, 2, -2, 3, -3, 4]) {
    const angle = towardCenter + turn * Math.PI / 4;
    const x = at.x + Math.cos(angle) * HUD.pickupRadius;
    const y = at.y + Math.sin(angle) * HUD.pickupRadius;
    if (surfaceEffect(traits.kind, world.surfaceAt(x, y), traits).passable) return { x, y };
  }
  return at;
}

export function nearestInteraction(
  plans: readonly HexLive[], point: Vec, apples?: ReadonlyMap<string, ItemSpot>,
): Interactable | undefined {
  let nearest: Interactable | undefined;
  let fallback: Interactable | undefined;
  let best = Infinity;
  let bestFallback = Infinity;
  for (const live of plans) {
    const { plan, obstacles, takenItems } = live;
    const consider = (
      kind: Interactable['kind'], at: Vec, radius: number, details?: Partial<QuestContact>,
      props?: Pick<Interactable, 'spot' | 'errand' | 'obstacle'>,
    ) => {
      const distance = Math.hypot(point.x - at.x, point.y - at.y);
      if (distance > radius) return;
      const hit = { kind, at, contact: { biome: plan.biome, ...details }, ...props, live };
      if (kind === 'obstacle' || kind === 'treasure') {
        if (distance < bestFallback) { bestFallback = distance; fallback = hit; }
        return;
      }
      if (distance >= best) return;
      best = distance;
      nearest = hit;
    };

    if (plan.giver) consider('giver', plan.giver.at, HUD.talkRadius, { giverId: plan.giver.id });
    const item = (spot: ItemSpot) => consider('item', spot.at, HUD.pickupRadius,
      { target: 'item', item: spot.item }, { spot });
    for (const spot of plan.items) {
      if (!takenItems.has(spot.id)) item(spot);
    }
    for (const errand of plan.errands ?? []) {
      const { kind, at } = errand;
      if (kind === 'hay') consider('errand', at, HUD.pickupRadius, { target: 'item', item: 'hay' }, { errand });
      else consider('errand', at, HUD.talkRadius,
        kind === 'doggy' ? undefined : { target: kind === 'barn' ? 'farm' : kind }, { errand });
    }
    for (const at of pondPoints(plan)) consider('pond', at, HUD.talkRadius, { target: 'pond' });
    for (const obstacle of obstacles.values()) {
      if (obstacle.gone) continue;
      if (obstacle.kind === 'appleCanopy') {
        const apple = apples?.get(obstacle.id);
        if (apple) item(apple);
        continue;
      }
      consider('obstacle', obstacle.at, obstacle.radius + HUD.pickupRadius, undefined, { obstacle });
    }
    if (plan.treasure) consider('treasure', plan.treasure.at, HUD.pickupRadius);
    for (const site of plan.activities) consider('activity', site.at, site.radius);
  }
  return nearest ?? fallback;
}

export function nearestBear(plans: readonly HexLive[], at: Vec): { live: HexLive; bear: ErrandSpot } | undefined {
  let nearest: { live: HexLive; bear: ErrandSpot } | undefined;
  let distance: number = QUESTS.bearRadius;
  for (const live of plans) {
    for (const bear of live.plan.errands ?? []) {
      if (bear.kind !== 'bear') continue;
      const range = Math.hypot(bear.at.x - at.x, bear.at.y - at.y);
      if (range > distance) continue;
      nearest = { live, bear };
      distance = range;
    }
  }
  return nearest;
}

/** W9c hook: call the bear handler from the resolved honk/roar fallback once B selects a special. */
export function pressedHonk(player: Pick<WorldPlayer, 'controls'>): boolean {
  const { b, y, menu } = player.controls.pressed;
  return b && !y && !menu;
}

export function offerAt(
  world: Pick<WorldQuery, 'seed' | 'live' | 'hexesNear' | 'surfaceAt'>, plan: HexPlan, date: number, traits: Traits,
): Quest | undefined {
  const { giver } = plan;
  if (!giver) return;
  const plans = world.hexesNear(giver.at.x, giver.at.y, QUESTS.nearbyRings).map(coord => world.live(coord));
  const items = new Map<string, { item: ItemSpot['item']; biome: HexPlan['biome'] }>();
  const places = new Set<QuestPlace>();
  const passable = ({ x, y }: Vec) => surfaceEffect(traits.kind, world.surfaceAt(x, y), traits).passable;
  for (const { plan, takenItems, obstacles } of plans) {
    for (const spot of plan.items) {
      if (!takenItems.has(spot.id) && passable(spot.at)) items.set(`${plan.biome}:${spot.item}`, { item: spot.item, biome: plan.biome });
    }
    if (pondPoints(plan).some(passable)) places.add('pond');
    for (const spot of plan.errands ?? []) {
      if (spot.kind !== 'doggy' && passable(spot.at)) places.add(spot.kind === 'barn' ? 'farm' : spot.kind);
    }
    for (const obstacle of obstacles.values()) {
      if (obstacle.gone) continue;
      if (obstacle.kind === 'appleTree' && passable(obstacle.at)) places.add('apple');
      if (isPathLog(obstacle) && touchesPath(plan, obstacle) && passable(obstacle.at)) places.add('pathLog');
    }
  }
  return questFor(world.seed, giver, plan.coord, date, [...items.values()], places, traits);
}
