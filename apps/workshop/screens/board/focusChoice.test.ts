import { describe, expect, it } from 'vitest';
import { chooseBoardFocus, restoreChallengeIndex } from './focusChoice';

describe('board focus restoration', () => {
  it('finds the same challenge even if it moves', () => {
    expect(restoreChallengeIndex(['c', 'a', 'b'], 'a', 0)).toBe(1);
  });

  it('uses the nearest slot when the challenge disappears', () => {
    expect(restoreChallengeIndex(['a', 'b', 'c'], 'missing', 1)).toBe(1);
    expect(restoreChallengeIndex(['a', 'b'], 'missing', 2)).toBe(1);
    expect(restoreChallengeIndex([], 'missing', 2)).toBe(0);
  });

  it('restores the same card or option when it remains available', () => {
    const available = ['card:a', 'card:b', 'test', 'back'] as const;
    expect(chooseBoardFocus('card:a', available, 'card:b')).toBe('card:a');
    expect(chooseBoardFocus('test', available, 'card:b')).toBe('test');
  });

  it('falls back to the other page arrow or the selected card', () => {
    expect(chooseBoardFocus('textNext', ['card:b', 'textPrev', 'back'], 'card:b')).toBe('textPrev');
    expect(chooseBoardFocus('textNext', ['card:b', 'back'], 'card:b')).toBe('card:b');
    expect(chooseBoardFocus('test', ['back'], undefined)).toBe('back');
  });
});
