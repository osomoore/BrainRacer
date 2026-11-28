import { describe, expect, it } from 'vitest';
import { WORLD_QUEST_HUD as HUD } from '../config';
import type { HexLive, WorldQuery } from '../core/runtime';
import { generateHex } from '../gen/world';
import { traitsOf } from '../logic/traits';
import { nearestInteraction, offerAt } from './questModuleRules';

const traits = traitsOf({ workshop: 'race', model: {} });

function setup(): HexLive {
  const plan = generateHex(29, { q: 0, r: 0 });
  plan.biome = 'rocky';
  plan.giver = { id: 'pal', who: 'goat', at: { x: 600, y: 0 } };
  plan.items = [{ id: 'rock', item: 'rock', at: { x: 160, y: 0 } }];
  plan.activities = [];
  plan.errands = [];
  return { plan, obstacles: new Map(), takenItems: new Set() };
}

describe('quest runtime rules', () => {
  it('finds the same hand interactions with no quest state and ignores taken or broken props', () => {
    const live = setup();
    expect(nearestInteraction([live], { x: 600 + HUD.talkRadius, y: 0 })?.kind).toBe('giver');
    expect(nearestInteraction([live], { x: 600 + HUD.talkRadius + 1, y: 0 })).toBeUndefined();
    expect(nearestInteraction([live], { x: 160, y: 0 })?.kind).toBe('item');
    live.takenItems.add('rock');
    expect(nearestInteraction([live], { x: 160, y: 0 })).toBeUndefined();
    const obstacle = { id: 'log', kind: 'log', at: { x: 160, y: 0 }, radius: 40, gone: false };
    live.obstacles.set(obstacle.id, obstacle);
    expect(nearestInteraction([live], { x: 220, y: 0 })?.kind).toBe('obstacle');
    obstacle.gone = true;
    expect(nearestInteraction([live], { x: 220, y: 0 })).toBeUndefined();
  });

  it('offers quests only for available item and pond kinds', () => {
    const live = setup();
    const world: Pick<WorldQuery, 'seed' | 'live' | 'hexesNear' | 'surfaceAt'> = {
      seed: 29, live: () => live, hexesNear: () => [live.plan.coord],
      surfaceAt: () => ({ kind: 'grass', biome: 'rocky', dark: 0, covered: false }),
    };
    const offers = Array.from({ length: 24 }, (_, n) => offerAt(world, live.plan, 20261101 + n, traits));
    expect(new Set(offers.map(offer => offer?.kind))).toEqual(new Set(['fetch']));
    expect(offers.every(quest => quest?.item === 'rock')).toBe(true);
    live.takenItems.add('rock');
    expect(offerAt(world, live.plan, 20261127, traits)).toBeUndefined();
  });

  it('uses the same hand contact for an errand prop whether or not a quest is tracked', () => {
    const live = setup();
    const at = { x: 300, y: 0 };
    live.plan.errands = [{ id: 'frog', kind: 'frog', at }];
    expect(nearestInteraction([live], at)).toMatchObject({
      kind: 'errand', contact: { target: 'frog' }, errand: { id: 'frog' },
    });
    const apple = { id: 'canopy', item: 'apple', at } as const;
    live.obstacles.set(apple.id, { id: apple.id, kind: 'appleCanopy', at, radius: 47 });
    live.plan.errands = [];
    expect(nearestInteraction([live], at)).toBeUndefined();
    expect(nearestInteraction([live], at, new Map([[apple.id, apple]]))).toMatchObject({
      contact: { target: 'item', item: 'apple' },
    });
  });
});
