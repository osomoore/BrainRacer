import { describe, expect, it } from 'vitest';
import { BUDDY_KINDS, buddyName } from '../../../shared/buddies/catalog';
import { READING_LEVELS } from '../../workshop/core/types';
import { wordCount } from '../../workshop/logic/wording';
import { QUESTS } from '../config';
import { questStarterWordProblems } from '../quests/words';
import { BUDDY_PRICE, BUDDY_SHORT, buddyQuestion } from './text';

describe('World buddy wording', () => {
  it.each(READING_LEVELS)('checks the %s offer and balance message', level => {
    expect(BUDDY_SHORT).toBe('You need 10 stars.');
    expect(wordCount(BUDDY_SHORT)).toBeLessThanOrEqual(QUESTS.wordLimit[level]);
    for (const kind of BUDDY_KINDS) {
      const name = buddyName(kind);
      const line = buddyQuestion(kind, level);
      expect(line).toContain(name);
      expect(line).toContain(BUDDY_PRICE);
      if (level === 'starter') {
        // The illustrated buddy's name and the numeric price are catalog/card labels.
        expect(questStarterWordProblems(line.replace(name, '').replace(BUDDY_PRICE, ''))).toEqual([]);
        expect(questStarterWordProblems(BUDDY_SHORT.replace(BUDDY_PRICE, ''))).toEqual([]);
        for (const sentence of line.match(/[^\n.!?]+/g) ?? []) {
          expect(wordCount(sentence)).toBeLessThanOrEqual(QUESTS.wordLimit.starter);
        }
      } else {
        expect(wordCount(line)).toBeLessThanOrEqual(QUESTS.wordLimit[level]);
      }
    }
  });
});
