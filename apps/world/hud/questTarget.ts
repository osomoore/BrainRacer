import { QUESTS, WORLD_QUEST_HUD } from '../config';
import type { WorldQuery } from '../core/runtime';
import type { ActiveQuest, HexPlan, Vec } from '../core/types';
import { hexToWorld } from '../gen/hex';

/** The arrow texture points right. Camera rotation turns a world bearing into a screen bearing. */
export function targetAngle(from: Vec, to: Vec, rotation: number): number {
  return Math.atan2(to.y - from.y, to.x - from.x) + rotation;
}

function nearest(from: Vec, points: Iterable<Vec>): Vec | undefined {
  let target: Vec | undefined;
  let best = Infinity;
  for (const point of points) {
    const distance = (point.x - from.x) ** 2 + (point.y - from.y) ** 2;
    if (distance < best) { best = distance; target = point; }
  }
  return target;
}

export function questTarget(
  world: Pick<WorldQuery, 'plan' | 'live' | 'hexesNear' | 'homeFor'>,
  player: Vec, profileId: string, { quest, carrying }: ActiveQuest,
): Vec | undefined {
  if ((!carrying && quest.kind === 'deliver') || (carrying && quest.goal.kind === 'giver')) {
    const giver = world.plan(quest.giverHex).giver;
    return giver?.id === quest.giverId ? giver.at : hexToWorld(quest.giverHex);
  }

  const goal = quest.goal;
  const points = (plans: HexPlan[]): Vec[] => plans.flatMap(plan => {
    if (!carrying) {
      if (plan.biome !== quest.fromBiome) return [];
      const items = plan.items.filter(spot => spot.item === quest.item);
      if (!items.length) return [];
      const taken = world.live(plan.coord).takenItems;
      return items.filter(spot => !taken.has(spot.id)).map(spot => spot.at);
    }
    if (goal.kind === 'home') return plan.home ? [plan.home.at] : [];
    return goal.kind === 'biome' && plan.biome === goal.biome ? [plan.center] : [];
  });
  const plansNear = (at: Vec, rings: number) => world.hexesNear(at.x, at.y, rings).map(coord => world.plan(coord));
  const home = carrying && goal.kind === 'home' ? world.homeFor(profileId) : undefined;
  const local = points(plansNear(player, QUESTS.nearbyRings));
  if (home) local.push(world.plan(home).home?.at ?? hexToWorld(home));
  const close = nearest(player, local);
  if (close) return close;
  const giver = hexToWorld(quest.giverHex);
  return nearest(player, points(plansNear(giver, QUESTS.nearbyRings)))
    ?? nearest(player, points(plansNear(player, WORLD_QUEST_HUD.targetRings)));
}
