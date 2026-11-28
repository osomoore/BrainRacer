import { describe, expect, it } from 'vitest';
import { READING_LEVELS } from '../../workshop/core/types';
import { wordCount } from '../../workshop/logic/wording';
import { QUESTS } from '../config';
import { BIOME_IDS, ITEM_IDS } from '../core/types';
import type { ItemId, ReadingLevel } from '../core/types';
import { BIOME_NAMES, GIVER_NAMES, ITEM_NAMES, QUEST_PHRASES } from './phrases';
import { fillQuestPhrase } from './text';
import type { QuestTextDetails } from './text';
import { questStarterWordProblems } from './words';

function checkPhrases(level: ReadingLevel, details: QuestTextDetails, place: string): void {
  for (const phrase of QUEST_PHRASES[details.kind][level]) {
    const line = fillQuestPhrase(phrase, details);
    expect(line, phrase).toContain(ITEM_NAMES[details.item]);
    if (place) expect(line, phrase).toContain(place);
    expect(line).not.toMatch(/[{}]|\ba egg\b/);
    expect(line).toMatch(/[.!?]$/);
    if (level === 'starter') {
      expect(questStarterWordProblems(line), line).toEqual([]);
      // Starter cards can use several short sentences to name both the item and the place.
      for (const sentence of line.match(/[^.!?]+/g) ?? []) {
        expect(wordCount(sentence), line).toBeGreaterThanOrEqual(2);
        expect(wordCount(sentence), line).toBeLessThanOrEqual(QUESTS.wordLimit.starter);
      }
    } else {
      expect(wordCount(line), line).toBeLessThanOrEqual(QUESTS.wordLimit[level]);
    }
  }
}

describe('quest wording', () => {
  it.each(READING_LEVELS)('validates every %s phrase with every biome and item fill', (level) => {
    const givers = [...Object.keys(GIVER_NAMES), 'unknownGiver'];
    for (const item of ITEM_IDS) {
      for (const who of givers) {
        for (const biome of BIOME_IDS) {
          checkPhrases(level, { kind: 'fetch', item, fromBiome: biome, who }, BIOME_NAMES[biome]);
        }
        checkPhrases(level, { kind: 'visitItem', item, who }, '');
      }
    }
    checkPhrases(level, { kind: 'visitPond', item: 'duck', who: 'farmer' }, 'pond');
    checkPhrases(level, { kind: 'deliver', item: 'duck', who: 'farmer' }, 'pond');
  });

  it('uses the correct article for every item', () => {
    for (const item of ITEM_IDS) {
      const phrase = fillQuestPhrase('Get {a} {item}.', { kind: 'fetch', item, fromBiome: 'meadow', who: 'owl' });
      const vowelStarts: ItemId[] = ['egg'];
      expect(phrase).toBe(`Get ${vowelStarts.includes(item) ? 'an' : 'a'} ${ITEM_NAMES[item]}.`);
    }
  });

  it('allows full world names and catches unfamiliar words outside them', () => {
    expect(questStarterWordProblems('Get a cactus flower. Go to the Hot Springs.')).toEqual([]);
    expect(questStarterWordProblems('Get cactus. Flee the Frozen Lake.')).toEqual(['cactus', 'flee', 'frozen']);
    expect(questStarterWordProblems('Get a rockfish. Maneuver.')).toEqual(['rockfish', 'maneuver']);
  });
});
