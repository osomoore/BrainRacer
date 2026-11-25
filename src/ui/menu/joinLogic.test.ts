import { describe, expect, it } from 'vitest';
import { duplicateProfileSlots } from './joinLogic';

describe('duplicateProfileSlots', () => {
  it('marks later copies after a merge while allowing the New Profile and anonymous slots', () => {
    expect(duplicateProfileSlots(['p1', 'p1', undefined, 'p4'], [false, false, true, false])).toEqual([1]);
  });

  it('keeps the first occurrence and ignores slots marked as new', () => {
    expect(duplicateProfileSlots(['p1', 'p2', 'p1', 'p2'], [true, false, false, false])).toEqual([3]);
  });
});
