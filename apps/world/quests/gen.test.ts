import { describe, expect, it } from 'vitest';
import type { QuestGiverSpot } from '../core/types';
import { traitsOf } from '../logic/traits';
import { questFor } from './gen';

const giver: QuestGiverSpot = { id: '-2,3:g', at: { x: 21, y: 42 }, who: 'turtle' };
const hex = { q: -2, r: 3 };
const traits = traitsOf({ workshop: 'race', model: {} });
const date = 20261127;

describe('questFor', () => {
  it('generates deterministic daily offers of all three shapes, each worth one star', () => {
    const make = () => Array.from({ length: 48 }, (_, seed) =>
      questFor(seed, giver, hex, date, [{ item: 'rock', biome: 'rocky' }], true, traits)!);
    const offers = make();
    expect(offers).toEqual(make());
    expect(new Set(offers.map(quest => quest.kind))).toEqual(new Set(['visit', 'fetch', 'deliver']));
    for (const offer of offers) {
      expect(offer).toMatchObject({ id: `${giver.id}#${date}`, giverId: giver.id, giverHex: hex, stars: 1 });
    }
  });

  it('only offers part-gated fetches to a build that can reach the item', () => {
    const make = (reach: number) => Array.from({ length: 48 }, (_, seed) =>
      questFor(seed, giver, hex, date, [{ item: 'cactusFlower', biome: 'desert' }], false, { ...traits, reach })!);
    expect(make(1).every(offer => offer.kind === 'visit')).toBe(true);
    expect(make(2).filter(offer => offer.kind === 'fetch')).toContainEqual(expect.objectContaining({
      item: 'cactusFlower', fromBiome: 'desert', needs: [{ trait: 'reach', min: 2 }],
    }));
    expect(questFor(42, giver, hex, date, [], false, traits)).toBeUndefined();
  });
});
