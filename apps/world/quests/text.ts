import type { Rng } from '../../workshop/core/rng';
import type { BiomeId, ItemId, QuestGoal, ReadingLevel } from '../core/types';
import { BIOME_NAMES, GIVER_NAMES, ITEM_NAMES, OTHER_GIVER, PLACES, QUEST_PHRASES } from './phrases';

export type QuestTextDetails = { item: ItemId; who: string } & (
  | { kind: 'fetch'; fromBiome: BiomeId }
  | { kind: 'deliver'; goal: QuestGoal }
);

export function fillQuestPhrase(phrase: string, details: QuestTextDetails): string {
  const item = ITEM_NAMES[details.item];
  const biome = details.kind === 'fetch' ? details.fromBiome
    : details.goal.kind === 'biome' ? details.goal.biome : undefined;
  const who = Object.hasOwn(GIVER_NAMES, details.who)
    ? GIVER_NAMES[details.who as keyof typeof GIVER_NAMES] : OTHER_GIVER;
  const place = details.kind === 'deliver' ? PLACES[details.goal.kind] : '';
  const slots: Record<string, string> = { item, a: /^[aeiou]/.test(item) ? 'an' : 'a', who };
  if (biome) slots.biome = BIOME_NAMES[biome];
  if (place) slots.place = place.replace('{biome}', slots.biome);
  return phrase.replace(/\{(\w+)\}/g, (match, slot: string) => slots[slot] ?? match);
}

export function questText(rng: Rng, details: QuestTextDetails): Record<ReadingLevel, string> {
  const bank = QUEST_PHRASES[details.kind];
  return {
    starter: fillQuestPhrase(rng.pick(bank.starter), details),
    easy: fillQuestPhrase(rng.pick(bank.easy), details),
    medium: fillQuestPhrase(rng.pick(bank.medium), details),
    hard: fillQuestPhrase(rng.pick(bank.hard), details),
  };
}
