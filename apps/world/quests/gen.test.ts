import { describe, expect, it } from 'vitest';
import { BIOME_IDS } from '../core/types';
import type { BiomeId, QuestGiverSpot } from '../core/types';
import { questFor } from './gen';

const giver: QuestGiverSpot = { id: '-2,3:g', at: { x: 21, y: 42 }, who: 'turtle' };
const hex = { q: -2, r: 3 };
const series = (nearby: (biome: BiomeId) => boolean, seed = 42, spot = giver) =>
  Array.from({ length: 40 }, (_, n) => questFor(seed, spot, hex, n, nearby));

describe('questFor', () => {
  it('generates a stable sequence of quests, including the wording', () => {
    const quests = series(() => true);
    expect(quests).toEqual(series(() => true));
    expect(quests.map((quest) => quest.id)).toEqual(quests.map((_, n) => `${giver.id}#${n}`));
    expect(quests.every((quest) => quest.giverId === giver.id && quest.giverHex.q === hex.q && quest.giverHex.r === hex.r)).toBe(true);
    expect(quests.map((quest) => quest.item)).not.toEqual(series(() => true, 43).map((quest) => quest.item));
    expect(quests.map((quest) => quest.item)).not.toEqual(
      series(() => true, 42, { ...giver, id: '0,3:g' }).map((quest) => quest.item),
    );
    expect(new Set(quests.map((quest) => quest.goal.kind))).toEqual(new Set(['giver', 'biome', 'home']));
    expect(new Set(quests.map((quest) => quest.stars))).toEqual(new Set([2, 3]));
  });

  it.each(BIOME_IDS)('fetches a native item when %s is the only nearby biome', (biome) => {
    const nativeItems = {
      meadow: ['feather'], mud: ['mudPie'], rocky: ['rock'], lake: ['shell'], darkwood: ['pinecone'],
      snow: ['snowball'], desert: ['cactusFlower'], jungle: ['pinecone', 'fern'], canyon: ['crystal'], geyser: ['crystal'],
    };
    const quests = series((other) => other === biome);
    const fetches = quests.filter((quest) => quest.kind === 'fetch');
    expect(fetches.length).toBeGreaterThan(0);
    for (const quest of fetches) {
      expect(quest.fromBiome).toBe(biome);
      expect(nativeItems[biome]).toContain(quest.item);
      expect(quest.goal).toEqual({ kind: 'giver' });
    }
    for (const quest of quests.filter((quest) => quest.kind === 'deliver')) {
      expect(quest.fromBiome).toBeUndefined();
      if (quest.item === 'duck') {
        expect(biome).toBe('lake');
        expect(quest.goal).toEqual({ kind: 'biome', biome: 'lake' });
      } else {
        expect(quest.item).toBe('lamb');
        expect(quest.goal).toEqual({ kind: 'home' });
      }
    }
  });

  it('offers a home delivery when the lookup finds no biomes', () => {
    for (const quest of series(() => false)) {
      expect(quest).toMatchObject({ kind: 'deliver', item: 'lamb', goal: { kind: 'home' }, stars: 2 });
    }
  });
});
