import type { WorldInteractionTarget } from '../core/runtime';
import type { ActivityKind, ErrandSpotKind, ItemId } from '../core/types';
import { GIVER_NAMES, ITEM_NAMES } from '../quests/phrases';

const titleCase = (name: string): string => name.replace(/\b[a-z]/g, char => char.toUpperCase());

const NAMES = {
  errand: {
    barn: 'Barn', cowPen: 'Cow Pen', hay: 'Hay', bell: 'Bell', bear: 'Sleepy Bear', frog: 'Frog', doggy: 'Doggy',
  } satisfies Record<ErrandSpotKind, string>,
  obstacle: {
    appleTree: 'Apple Tree', boulder: 'Boulder', bush: 'Bush', cactus: 'Cactus', crate: 'Crate',
    fence: 'Fence', flower: 'Flower', iceBlock: 'Ice Block', log: 'Log', rock: 'Rock', tree: 'Tree', vine: 'Vine',
  },
  activity: {
    boulderPush: 'Push the Rock', digSpot: 'Dig Spot', duckParade: 'Duck Parade',
    fruitShake: 'Fruit Trees', gateDash: 'Flag Race', herdSheep: 'Herd the Sheep',
    hideSeek: 'Hide and Seek', islandSwim: 'Island Swim', lanternCave: 'Lantern Cave', ringJump: 'Ring Jump',
  } satisfies Record<ActivityKind, string>,
  pond: 'Pond',
  treasure: 'Treasure',
  home: 'Home Pad',
} as const;

export function itemDisplayName(item: ItemId): string {
  return titleCase(ITEM_NAMES[item]);
}

export function interactionDisplayName(target: WorldInteractionTarget | { kind: 'activity'; id: ActivityKind }): string {
  switch (target.kind) {
    case 'item': return itemDisplayName(target.id);
    case 'errand': return NAMES.errand[target.id];
    case 'activity': return NAMES.activity[target.id];
    case 'giver': return Object.hasOwn(GIVER_NAMES, target.id)
      ? titleCase(GIVER_NAMES[target.id as keyof typeof GIVER_NAMES].replace(/^the /, ''))
      : 'Friend';
    case 'obstacle': return Object.hasOwn(NAMES.obstacle, target.id)
      ? NAMES.obstacle[target.id as keyof typeof NAMES.obstacle]
      : 'Thing';
    case 'pond':
    case 'treasure':
    case 'home': return NAMES[target.kind];
  }
}
