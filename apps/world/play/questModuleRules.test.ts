import { describe, expect, it } from 'vitest';
import { WORLD_PLAY, WORLD_QUEST_HUD } from '../config';
import type { WorldQuery } from '../core/runtime';
import { generateHex, WorldGen } from '../gen/world';
import { offerAt, questContact } from './questModuleRules';

describe('quest runtime rules', () => {
  it('reports giver and home contact only inside their interaction radii', () => {
    const plan = generateHex(29, { q: 0, r: 0 });
    plan.giver = { id: 'pal', who: 'owl', at: { x: 600, y: 0 } };
    plan.home = { id: 'camp', at: { x: 0, y: 0 } };
    expect(questContact(plan, { x: 600 + WORLD_QUEST_HUD.talkRadius, y: 0 }).giverId).toBe('pal');
    expect(questContact(plan, { x: 600 + WORLD_QUEST_HUD.talkRadius + 1, y: 0 }).giverId).toBeUndefined();
    expect(questContact(plan, { x: 0, y: WORLD_PLAY.homeRadius }).homeId).toBe('camp');
    expect(questContact(plan, { x: 0, y: WORLD_PLAY.homeRadius + 1 }).homeId).toBeUndefined();
  });

  it('offers reachable items and falls back to delivery when nearby plans have no matching items', () => {
    const gen = new WorldGen(29);
    const plan = generateHex(29, { q: 0, r: 0 });
    plan.biome = 'rocky';
    plan.giver = { id: '0,0:g', who: 'goat', at: plan.center };
    const world: Pick<WorldQuery, 'seed' | 'plan' | 'hexesNear'> = {
      seed: gen.seed, plan: () => plan, hexesNear: () => [plan.coord],
    };
    plan.items = [{ id: 'rock', item: 'rock', at: plan.center }];
    const offers = Array.from({ length: 12 }, (_, n) => offerAt(world, plan, n));
    const n = offers.findIndex(quest => quest?.kind === 'fetch');
    expect(n).toBeGreaterThanOrEqual(0);
    expect(offers[n]?.item).toBe('rock');
    plan.items = [{ id: 'egg', item: 'egg', at: plan.center }];
    expect(offerAt(world, plan, n)).toMatchObject({ id: offers[n]?.id, kind: 'deliver' });
  });
});
