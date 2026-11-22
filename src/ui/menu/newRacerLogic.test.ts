import { describe, expect, it } from 'vitest';
import { cycleChoice, nameTaken, racerChoices, toggleQuestionType } from './newRacerLogic';

describe('newRacerLogic', () => {
  it('racerChoices excludes the other racer and appends new', () => {
    expect(racerChoices(['robin', 'sam', 'u1'], 'robin', true)).toEqual(['sam', 'u1', 'new']);
    expect(racerChoices(['robin', 'sam'], undefined, false)).toEqual(['robin', 'sam']);
  });
  it('cycleChoice wraps', () => {
    expect(cycleChoice(['a', 'b', 'c'], 'c', 1)).toBe('a');
    expect(cycleChoice(['a', 'b', 'c'], 'a', -1)).toBe('c');
    expect(cycleChoice(['a', 'b'], 'zzz', 1)).toBe('a');
  });
  it('toggleQuestionType keeps at least one on', () => {
    const q = { addition: true, multiplication: false, spelling: false };
    expect(toggleQuestionType(q, 'addition')).toBe(q);
    expect(toggleQuestionType(q, 'spelling')).toEqual({ addition: true, multiplication: false, spelling: true });
  });
  it('nameTaken is case-insensitive', () => {
    expect(nameTaken(' robin ', ['Robin'])).toBe(true);
    expect(nameTaken('Zed', ['Robin'])).toBe(false);
  });
});
