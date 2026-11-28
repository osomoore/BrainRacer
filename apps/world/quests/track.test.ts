import { describe, expect, it } from 'vitest';
import { QUEST_SLOTS, type Quest, type ReadingLevel } from '../core/types';
import { normalizePlayerSave } from '../logic/save';
import { traitsOf } from '../logic/traits';
import { questId } from './gen';
import { acceptQuest, canOffer, completeQuest, localQuestDate, pickupQuestItem, recordOffer } from './track';

const date = localQuestDate(new Date(2026, 10, 27, 23, 59));
const traits = { ...traitsOf({ workshop: 'race', model: {} }), carry: 2 };
const text = { starter: 'Get a rock.', easy: 'Get a rock.', medium: 'Get a rock.', hard: 'Get a rock.' };
const makeQuest = (giverId: string, overrides: Partial<Quest> = {}): Quest => ({
  id: questId(giverId, date), giverId, giverHex: { q: 1, r: 0 }, kind: 'fetch',
  item: 'rock', fromBiome: 'rocky', goal: { kind: 'giver' }, text, stars: 1, ...overrides,
});

describe('daily quest offers', () => {
  it('records the offer before acceptance, survives reload and resets at local midnight only for that kid', () => {
    const save = normalizePlayerSave(undefined);
    const other = normalizePlayerSave(undefined);
    const quest = makeQuest('goat');
    expect(date).toBe(20261127);
    expect(acceptQuest(save, quest, 'easy', traits, date)).toBe(false);
    recordOffer(save, 'goat', date);
    const reloaded = normalizePlayerSave(JSON.parse(JSON.stringify(save)));
    expect(canOffer(reloaded, 'goat', 'easy', date)).toBe(false);
    expect(canOffer(other, 'goat', 'easy', date)).toBe(true);
    expect(canOffer(reloaded, 'goat', 'easy', localQuestDate(new Date(2026, 10, 28)))).toBe(true);
    expect(acceptQuest(save, quest, 'easy', traits, date)).toBe(true);
    expect(acceptQuest(save, quest, 'easy', traits, date)).toBe(false);
  });

  it.each(Object.entries(QUEST_SLOTS) as [ReadingLevel, number][])('enforces %s slot capacity', (reading, capacity) => {
    const save = normalizePlayerSave(undefined);
    for (let i = 0; i < capacity; i++) {
      const quest = makeQuest(`goat${i}`);
      recordOffer(save, quest.giverId, date);
      expect(acceptQuest(save, quest, reading, traits, date)).toBe(true);
    }
    expect(canOffer(save, 'owl', reading, date)).toBe(false);
    expect(save.questSeq.owl).toBeUndefined();
  });
});

describe('quest contact', () => {
  it('completes a visit at any object of the right kind, with no pickup', () => {
    const visit = makeQuest('goat', { kind: 'visit', goal: { kind: 'target', target: 'item' }, fromBiome: undefined });
    const save = normalizePlayerSave({ quests: [{ quest: visit, carrying: false }] });
    expect(completeQuest(save, { biome: 'meadow', target: 'item', item: 'egg' })).toBeUndefined();
    expect(completeQuest(save, { biome: 'meadow', target: 'item', item: 'rock' })).toEqual(visit);
    expect(save.quests).toEqual([]);
  });

  it('tracks a fetch and a delivery independently and honors carry without dropping either', () => {
    const fetch = makeQuest('goat');
    const deliver = makeQuest('turtle', { kind: 'deliver', item: 'duck', fromBiome: undefined, goal: { kind: 'target', target: 'pond' } });
    const save = normalizePlayerSave({ quests: [fetch, deliver].map(quest => ({ quest, carrying: false })) });
    const pond = { biome: 'mud', target: 'pond' } as const;
    expect(completeQuest(save, pond)).toBeUndefined();
    expect(pickupQuestItem(save, { biome: 'rocky', item: 'rock', target: 'item' }, 0, traits)).toEqual(fetch);
    const turtle = { biome: 'lake', giverId: 'turtle' } as const;
    expect(pickupQuestItem(save, turtle, 1, { ...traits, carry: 1 }, deliver.id)).toBeUndefined();
    expect(pickupQuestItem(save, turtle, 1, traits, deliver.id)).toEqual(deliver);
    expect(save.quests.map(quest => quest.carrying)).toEqual([true, true]);
    expect(completeQuest(save, { biome: 'lake' })).toBeUndefined();
    expect(completeQuest(save, pond)).toEqual(deliver);
    expect(completeQuest(save, { biome: 'meadow', giverId: 'owl' })).toBeUndefined();
    expect(completeQuest(save, { biome: 'rocky', giverId: 'goat' })).toEqual(fetch);
  });

  it('loads old tracked deliveries and counters alongside daily offers', () => {
    const quest = makeQuest('owl', { id: 'owl#0', kind: 'deliver', item: 'lamb', stars: 2, goal: { kind: 'home' } });
    const save = normalizePlayerSave({ questSeq: { owl: 1 }, quests: [{ quest, carrying: true }] });
    expect(canOffer(save, 'owl', 'easy', date)).toBe(true);
    expect(completeQuest(save, { biome: 'meadow', homeId: 'camp' })).toEqual(quest);
  });

  it.each([
    ['bear', 'bear', 'honk'],
    ['log', 'pathLog', 'push'],
  ] as const)('reloads %s errands and requires the right action', (item, target, action) => {
    const quest = makeQuest(item, { kind: 'visit', item, goal: { kind: 'target', target } });
    const save = normalizePlayerSave({ quests: [{ quest, carrying: false }] });
    expect(save.quests).toHaveLength(1);
    expect(completeQuest(save, { biome: 'meadow', target })).toBeUndefined();
    expect(completeQuest(save, { biome: 'meadow', target, action })).toEqual(quest);
  });

  it.each([['hay', 'fetch'], ['doggy', 'deliver'], ['apple', 'fetch']] as const)(
    'reloads carried %s and completes it at the right place', (item, kind) => {
      const goal = item === 'apple' ? { kind: 'giver' } as const
        : { kind: 'target', target: item === 'doggy' ? 'farm' : 'cowPen' } as const;
      const quest = makeQuest('farmer', { item, kind, goal });
      const save = normalizePlayerSave({ quests: [{ quest, carrying: true }] });
      expect(save.quests).toHaveLength(1);
      expect(completeQuest(save, { biome: 'meadow', target: 'pond' })).toBeUndefined();
      const contact = item === 'apple' ? { giverId: 'farmer' } : { target: 'cowPen' as const };
      expect(completeQuest(save, { biome: 'snow', ...contact })).toEqual(quest);
    },
  );
});
