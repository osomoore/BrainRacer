import { describe, expect, it } from 'vitest';
import type { ItemSpot, Quest, QuestGoal } from '../core/types';
import {
  abandonQuest, acceptQuest, completeQuest, dropQuestItem, nextQuestIndex, pickupDelivery, pickupQuestItem,
} from './track';
import type { QuestState } from './track';

const empty: QuestState = { quests: [], stars: 4, questSeq: {} };
const one = { carry: 1 };
const two = { carry: 2 };
const spot: ItemSpot = { id: 'rock-1', item: 'rock', at: { x: 0, y: 0 } };

function fetch(n = 0, giverId = 'turtle'): Quest {
  return {
    id: `${giverId}#${n}`, giverId, giverHex: { q: 0, r: 0 }, kind: 'fetch', item: 'rock', fromBiome: 'rocky',
    goal: { kind: 'giver' }, stars: 3, text: { starter: '', easy: '', medium: '', hard: '' },
  };
}

function delivery(goal: QuestGoal, n = 0): Quest {
  return {
    ...fetch(n), kind: 'deliver', fromBiome: undefined, goal, stars: 2,
    item: goal.kind === 'biome' ? 'duck' : 'lamb',
  };
}

describe('quest tracker', () => {
  it('tracks a fetch through matching pickup and contact with the right giver', () => {
    const quest = fetch();
    const goal = { biome: 'meadow', giverId: quest.giverId } as const;
    const start = { ...empty, using: 'dino' };
    const accepted = acceptQuest(start, quest, 'starter', one);
    expect(accepted.quests).toEqual([{ quest, carrying: false }]);
    expect(accepted.using).toBe('dino');
    expect(nextQuestIndex(start, quest.giverId)).toBe(0);
    expect(nextQuestIndex(accepted, quest.giverId)).toBe(1);
    expect(completeQuest(accepted, quest.id, goal)).toBe(accepted);
    expect(pickupQuestItem(accepted, { ...spot, item: 'egg' }, 'rocky', one)).toBe(accepted);
    expect(pickupQuestItem(accepted, spot, 'meadow', one)).toBe(accepted);

    const picked = pickupQuestItem(accepted, spot, 'rocky', one);
    expect(picked.quests[0].carrying).toBe(true);
    expect(accepted.quests[0].carrying).toBe(false);
    expect(completeQuest(picked, quest.id, { biome: 'meadow' })).toBe(picked);
    expect(completeQuest(picked, quest.id, { ...goal, giverId: 'owl' })).toBe(picked);

    const done = completeQuest(picked, quest.id, goal);
    expect(done).toEqual({ ...start, stars: 7, questSeq: { turtle: 1 } });
    expect(completeQuest(done, quest.id, goal)).toBe(done);
    expect(acceptQuest(done, quest, 'starter', one)).toBe(done);
    expect(acceptQuest(done, fetch(1), 'starter', one).quests).toHaveLength(1);
  });

  it('takes a duck on acceptance and delivers it in the lake biome', () => {
    const quest = delivery({ kind: 'biome', biome: 'lake' });
    const accepted = acceptQuest(empty, quest, 'easy', one);
    expect(accepted.quests).toEqual([{ quest, carrying: true }]);
    expect(completeQuest(accepted, quest.id, { biome: 'meadow', giverId: 'turtle', homeId: 'camp' })).toBe(accepted);
    expect(completeQuest(accepted, quest.id, { biome: 'lake' })).toEqual({ ...empty, stars: 6, questSeq: { turtle: 1 } });
  });

  it('requires touching a home pad to deliver a lamb', () => {
    const quest = delivery({ kind: 'home' });
    const accepted = acceptQuest(empty, quest, 'easy', one);
    expect(completeQuest(accepted, quest.id, { biome: 'meadow', giverId: 'turtle' })).toBe(accepted);
    const done = completeQuest(accepted, quest.id, { biome: 'meadow', homeId: 'camp' });
    expect(done).toEqual({ ...empty, stars: 6, questSeq: { turtle: 1 } });
  });

  it.each([['starter', 1], ['easy', 1], ['medium', 2], ['hard', 3]] as const)(
    'limits %s to %i tracked quests even when none are carried', (reading, limit) => {
      let state = empty;
      for (let n = 0; n < limit; n++) state = acceptQuest(state, fetch(n), reading, one);
      expect(state.quests).toHaveLength(limit);
      expect(acceptQuest(state, fetch(limit), reading, one)).toBe(state);
      expect(nextQuestIndex(state, 'turtle')).toBe(limit);
    },
  );

  it('shares carry capacity across fetch and delivery quests', () => {
    const job = delivery({ kind: 'home' });
    const accepted = acceptQuest(empty, job, 'hard', one);
    expect(acceptQuest(accepted, delivery({ kind: 'home' }, 1), 'hard', one)).toBe(accepted);
    const waiting = acceptQuest(accepted, fetch(1), 'hard', one);
    expect(pickupQuestItem(waiting, spot, 'rocky', one)).toBe(waiting);
    const picked = pickupQuestItem(waiting, spot, 'rocky', two);
    expect(picked.quests.map(({ carrying }) => carrying)).toEqual([true, true]);
    const dropped = dropQuestItem(picked, job.id);
    expect(dropped.quests.map(({ carrying }) => carrying)).toEqual([false, true]);
    expect(pickupDelivery(dropped, job.id, 'turtle', one)).toBe(dropped);
    expect(pickupDelivery(dropped, job.id, 'owl', two)).toBe(dropped);
    expect(pickupDelivery(dropped, job.id, 'turtle', two)).toEqual(picked);
  });

  it('uses one item contact for one fetch and allows dropping and replacing it', () => {
    const first = fetch();
    const waiting = acceptQuest(acceptQuest(empty, first, 'medium', two), fetch(0, 'owl'), 'medium', two);
    const carrying = pickupQuestItem(waiting, spot, 'rocky', two);
    expect(carrying.quests.map((active) => active.carrying)).toEqual([true, false]);
    const dropped = dropQuestItem(carrying, first.id);
    expect(dropped).toEqual(waiting);
    expect(pickupQuestItem(dropped, { ...spot, id: 'rock-2' }, 'rocky', two)).toEqual(carrying);
  });

  it('abandons an offer without paying stars and keeps sequences per giver', () => {
    expect(acceptQuest(empty, fetch(1), 'easy', one)).toBe(empty);
    const quest = fetch();
    const accepted = acceptQuest(empty, quest, 'easy', one);
    const abandoned = abandonQuest(accepted, quest.id);
    expect(abandoned).toEqual({ ...empty, questSeq: { turtle: 1 } });
    expect(acceptQuest(abandoned, quest, 'easy', one)).toBe(abandoned);
    expect(nextQuestIndex(abandoned, 'owl')).toBe(0);
    expect(abandonQuest(abandoned, quest.id)).toBe(abandoned);
  });
});
