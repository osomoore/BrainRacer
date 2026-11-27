import type { Rng } from '../../workshop/core/rng';
import { GEN } from '../config';
import type { ActivityKind, ActivityTarget, BiomeId, ItemId, TraitNeed } from '../core/types';
import type { FeatureSite } from './features';
import { hexKey } from './hex';
import { offset, type HexLayout } from './layout';

const ACTIVITY: Record<ActivityKind, { role: string; needs: TraitNeed[]; minTargets?: number }> = {
  duckParade: { role: 'pond', needs: [{ trait: 'water', min: 1 }] },
  hideSeek: { role: 'hideout', needs: [{ trait: 'stealth', min: 2 }] },
  ringJump: { role: 'ring', needs: [{ trait: 'jump', min: 2 }] },
  boulderPush: { role: 'spot', needs: [{ trait: 'push', min: 2 }] },
  fruitShake: { role: 'tree', needs: [{ trait: 'reach', min: 2 }] },
  digSpot: { role: 'dig', needs: [{ trait: 'dig', min: 2 }] },
  islandSwim: { role: 'island', needs: [{ trait: 'water', min: 2 }] },
  gateDash: { role: 'gate', needs: [], minTargets: 3 },
  lanternCave: { role: 'lantern', needs: [{ trait: 'light', min: 2 }, { trait: 'height', max: 2 }] },
  herdSheep: { role: 'pen', needs: [{ trait: 'loud', min: 2 }] },
};

const BIOME_SITES: Record<BiomeId, { activities: readonly ActivityKind[]; items: readonly ItemId[]; giver: string }> = {
  meadow: { activities: ['herdSheep', 'gateDash', 'digSpot'], items: ['feather'], giver: 'farmer' },
  mud: { activities: ['duckParade', 'digSpot', 'boulderPush'], items: ['mudPie'], giver: 'turtle' },
  rocky: { activities: ['boulderPush', 'gateDash', 'digSpot'], items: ['rock'], giver: 'goat' },
  lake: { activities: ['duckParade', 'gateDash', 'digSpot'], items: ['shell'], giver: 'turtle' },
  darkwood: { activities: ['hideSeek', 'fruitShake', 'digSpot'], items: ['pinecone'], giver: 'owl' },
  snow: { activities: ['gateDash', 'digSpot', 'boulderPush'], items: ['snowball'], giver: 'owl' },
  desert: { activities: ['gateDash', 'digSpot', 'boulderPush'], items: ['cactusFlower'], giver: 'goat' },
  jungle: { activities: ['fruitShake', 'hideSeek', 'digSpot'], items: ['fern', 'pinecone'], giver: 'owl' },
  canyon: { activities: ['boulderPush', 'gateDash', 'digSpot'], items: ['crystal'], giver: 'goat' },
  geyser: { activities: ['digSpot', 'gateDash', 'boulderPush'], items: ['crystal'], giver: 'turtle' },
};

export function buildActivities(layout: HexLayout, rng: Rng, featureSite?: FeatureSite): void {
  const plan = layout.plan;
  const count = plan.home ? rng.int(0, 1) : rng.int(2, 3);
  const choices = rng.shuffle([...BIOME_SITES[plan.biome].activities]);
  for (let index = 0; index < count; index++) {
    const special = index === 0 ? featureSite : undefined;
    const at = special?.at ?? layout.place(rng, GEN.activityRadius, true);
    if (!at) break;
    const kind = special?.kind ?? choices.pop()!;
    const activity = ACTIVITY[kind];
    const targets: ActivityTarget[] = special?.targets
      ?? buildTargets(at, activity.role, rng.int(activity.minTargets ?? 1, 3), rng);
    plan.activities.push({
      id: `${hexKey(plan.coord)}:a${index}`, kind, at, radius: GEN.activityRadius,
      needs: activity.needs.map(need => ({ ...need })), targets, stars: rng.int(1, 3),
    });
  }
}

function buildTargets(at: ActivityTarget['at'], role: string, count: number, rng: Rng): ActivityTarget[] {
  const angle = rng.range(0, 2 * Math.PI);
  return Array.from({ length: count }, (_, index) => {
    const targetAngle = angle + index * 2 * Math.PI / count;
    return { at: offset(at, 138 * Math.cos(targetAngle), 138 * Math.sin(targetAngle)), role };
  });
}

export function buildPickups(layout: HexLayout, rng: Rng): void {
  const plan = layout.plan;
  const id = hexKey(plan.coord);
  const content = BIOME_SITES[plan.biome];
  const items = rng.int(2, 4);
  for (let index = 0; index < items; index++) {
    const at = layout.place(rng, 32);
    if (!at) break;
    plan.items.push({ id: `${id}:i${index}`, at,
      item: index > 0 && rng.chance(0.17) ? 'egg' : rng.pick(content.items) });
  }
  if (rng.chance(GEN.giverChance)) {
    const at = layout.place(rng, 100, true);
    if (at) plan.giver = { id: `${id}:g`, at, who: content.giver };
  }
  if (rng.chance(GEN.treasureChance)) {
    const at = layout.place(rng, 48);
    if (at) plan.treasure = { id: `${id}:t`, at, stars: 5, needs: [{ trait: 'dig', min: 2 }] };
  }
}
