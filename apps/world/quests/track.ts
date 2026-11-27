import { QUEST_SLOTS } from '../core/types';
import type {
  BiomeId, ItemSpot, Quest, ReadingLevel, Traits, WorldPlayerSave,
} from '../core/types';
import { questId } from './gen';

export type QuestState = Pick<WorldPlayerSave, 'quests' | 'questSeq' | 'stars'>;
type CarryTraits = Pick<Traits, 'carry'>;

export interface QuestContact {
  biome: BiomeId;
  /** IDs are present only on contact with the giver or home pad. */
  giverId?: string;
  homeId?: string;
}

export function nextQuestIndex(state: QuestState, giverId: string): number {
  return Object.hasOwn(state.questSeq, giverId) ? state.questSeq[giverId] : 0;
}

function canCarry(state: QuestState, traits: CarryTraits): boolean {
  return state.quests.filter((active) => active.carrying).length < traits.carry;
}

/** Advance the giver's offer on acceptance so completed or abandoned offers cannot be replayed. */
export function acceptQuest<T extends QuestState>(state: T, quest: Quest, reading: ReadingLevel, traits: CarryTraits): T {
  const n = nextQuestIndex(state, quest.giverId);
  if (state.quests.length >= QUEST_SLOTS[reading] || quest.id !== questId(quest.giverId, n)) return state;
  if (state.quests.some((active) => active.quest.id === quest.id)) return state;
  const carrying = quest.kind === 'deliver';
  if (carrying && !canCarry(state, traits)) return state;
  return {
    ...state,
    quests: [...state.quests, { quest, carrying }],
    questSeq: { ...state.questSeq, [quest.giverId]: n + 1 },
  };
}

function setCarrying<T extends QuestState>(state: T, index: number, carrying: boolean): T {
  if (index < 0) return state;
  const quests = [...state.quests];
  quests[index] = { ...quests[index], carrying };
  return { ...state, quests };
}

/** One item contact fills the oldest matching tracked fetch. */
export function pickupQuestItem<T extends QuestState>(state: T, spot: ItemSpot, biome: BiomeId, traits: CarryTraits): T {
  if (!canCarry(state, traits)) return state;
  const index = state.quests.findIndex(({ quest, carrying }) =>
    !carrying && quest.kind === 'fetch' && quest.item === spot.item && quest.fromBiome === biome);
  return setCarrying(state, index, true);
}

/** A delivery can be picked up again from its original giver after dropping it. */
export function pickupDelivery<T extends QuestState>(state: T, id: string, giverId: string, traits: CarryTraits): T {
  if (!canCarry(state, traits)) return state;
  const index = state.quests.findIndex(({ quest, carrying }) =>
    !carrying && quest.id === id && quest.kind === 'deliver' && quest.giverId === giverId);
  return setCarrying(state, index, true);
}

function atGoal(quest: Quest, contact: QuestContact): boolean {
  switch (quest.goal.kind) {
    case 'giver': return contact.giverId === quest.giverId;
    case 'biome': return contact.biome === quest.goal.biome;
    case 'home': return contact.homeId !== undefined;
  }
}

export function completeQuest<T extends QuestState>(state: T, id: string, contact: QuestContact): T {
  const active = state.quests.find(({ quest }) => quest.id === id);
  if (!active?.carrying || !atGoal(active.quest, contact)) return state;
  return { ...abandonQuest(state, id), stars: state.stars + active.quest.stars };
}

/** Dropping frees a carry slot. A fetch can be filled by another matching spot. */
export function dropQuestItem<T extends QuestState>(state: T, id: string): T {
  return setCarrying(state, state.quests.findIndex(({ quest, carrying }) => carrying && quest.id === id), false);
}

export function abandonQuest<T extends QuestState>(state: T, id: string): T {
  const quests = state.quests.filter(({ quest }) => quest.id !== id);
  return quests.length === state.quests.length ? state : { ...state, quests };
}
