import { describe, expect, it } from 'vitest';
import { LiveWorld } from '../host/liveWorld';
import { WorldGen } from '../gen/world';
import type { Quest } from '../core/types';
import { questTarget, targetAngle } from './questTarget';

describe('quest directions', () => {
  it('rotates a world bearing into the camera view', () => {
    const from = { x: 50, y: 50 };
    expect(targetAngle(from, { x: 150, y: 50 }, -Math.PI / 2)).toBeCloseTo(-Math.PI / 2);
    expect(targetAngle(from, { x: 50, y: 150 }, -Math.PI / 2)).toBeCloseTo(0);
  });

  it('guides a fetch to an available matching spot and back to the giver after pickup', () => {
    const world = new LiveWorld(new WorldGen(29));
    const plan = world.plan({ q: 0, r: 0 });
    const giver = { id: 'pal', who: 'turtle', at: { x: 345, y: 321 } };
    const rock = { id: 'nearest', item: 'rock', at: { x: 200, y: 0 } } as const;
    const farther = { id: 'farther', item: 'rock', at: { x: 410, y: 0 } } as const;
    plan.biome = 'rocky';
    plan.items = [{ id: 'egg', item: 'egg', at: plan.center }, rock, farther];
    plan.giver = giver;
    const quest: Quest = {
      kind: 'fetch', id: 'pal#0', giverId: giver.id, giverHex: plan.coord, item: 'rock', fromBiome: 'rocky',
      goal: { kind: 'giver' }, stars: 3, text: { starter: '', easy: '', medium: '', hard: '' },
    };
    expect(questTarget(world, plan.center, 'p', { quest, carrying: false })).toEqual(rock.at);
    world.live(plan.coord).takenItems.add(rock.id);
    expect(questTarget(world, plan.center, 'p', { quest, carrying: false })).toEqual(farther.at);
    expect(questTarget(world, plan.center, 'p', { quest, carrying: true })).toEqual(giver.at);
  });
});
