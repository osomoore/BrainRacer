import { QUEST_SLOTS } from '../core/types';
import type { BiomeId, ItemId, Quest, QuestTargetKind, ReadingLevel, Traits, WorldPlayerSave } from '../core/types';
import { meets } from '../logic/rules';
import { questId } from './gen';

export type QuestState = Pick<WorldPlayerSave, 'quests' | 'questSeq'>;

export interface QuestContact {
  biome: BiomeId;
  giverId?: string;
  homeId?: string;
  target?: QuestTargetKind;
  item?: ItemId;
}

export function localQuestDate(now = new Date()): number {
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}

export function canOffer(state: QuestState, giverId: string, reading: ReadingLevel, date: number): boolean {
  return state.quests.length < QUEST_SLOTS[reading] && state.questSeq[giverId] !== date;
}

export function recordOffer(state: QuestState, giverId: string, date: number): void {
  state.questSeq = { ...state.questSeq, [giverId]: date };
}

export function acceptQuest(state: QuestState, quest: Quest, reading: ReadingLevel, traits: Traits, date: number): boolean {
  if (state.quests.length >= QUEST_SLOTS[reading] || !meets(quest.needs, traits)
    || quest.id !== questId(quest.giverId, date) || state.questSeq[quest.giverId] !== date
    || state.quests.some(active => active.quest.id === quest.id)) return false;
  state.quests = [...state.quests, { quest, carrying: false }];
  return true;
}

export function pickupQuestItem(
  state: QuestState, contact: QuestContact, carriedCount: number, traits: Traits, deliveryId?: string,
): Quest | undefined {
  if (carriedCount >= traits.carry) return;
  const index = state.quests.findIndex(({ quest, carrying }) => !carrying && meets(quest.needs, traits) && (deliveryId !== undefined
    ? quest.kind === 'deliver' && quest.id === deliveryId && quest.giverId === contact.giverId
    : quest.kind === 'fetch' && contact.target === 'item' && quest.item === contact.item && quest.fromBiome === contact.biome));
  if (index < 0) return;
  const active = state.quests[index];
  state.quests = state.quests.map((entry, i) => i === index ? { ...active, carrying: true } : entry);
  return active.quest;
}

function atGoal(quest: Quest, contact: QuestContact): boolean {
  switch (quest.goal.kind) {
    case 'giver': return contact.giverId === quest.giverId;
    case 'biome': return contact.biome === quest.goal.biome;
    case 'home': return contact.homeId !== undefined;
    case 'target': return contact.target === quest.goal.target
      && (quest.goal.target !== 'item' || contact.item === quest.item);
  }
}

export function completeQuest(state: QuestState, contact: QuestContact): Quest | undefined {
  const active = state.quests.find(({ quest, carrying }) => (quest.kind === 'visit' || carrying) && atGoal(quest, contact));
  if (!active) return;
  state.quests = state.quests.filter(entry => entry !== active);
  return active.quest;
}
