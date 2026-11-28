import type { Rng } from '../../workshop/core/rng';
import type { BiomeId, ItemId, ReadingLevel } from '../core/types';
import { BIOME_NAMES, GIVER_NAMES, ITEM_NAMES, OTHER_GIVER, QUEST_PHRASES } from './phrases';

export type QuestTextDetails = { item: ItemId; who: string } & (
  | { kind: 'fetch'; fromBiome: BiomeId }
  | { kind: Exclude<keyof typeof QUEST_PHRASES, 'fetch'> }
);

export function fillQuestPhrase(phrase: string, details: QuestTextDetails): string {
  const item = ITEM_NAMES[details.item];
  const who = Object.hasOwn(GIVER_NAMES, details.who)
    ? GIVER_NAMES[details.who as keyof typeof GIVER_NAMES] : OTHER_GIVER;
  const use = details.item === 'shell' || details.item === 'feather' ? 'hat' : 'box';
  const slots: Record<string, string> = { item, a: /^[aeiou]/.test(item) ? 'an' : 'a', who, use };
  if (details.kind === 'fetch') slots.biome = BIOME_NAMES[details.fromBiome];
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
