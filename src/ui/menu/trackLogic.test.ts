import { describe, expect, it } from 'vitest';
import type { RaceMap } from '../../core/types';
import { stepMap } from './trackLogic';

const all = ['city', 'industrial', 'harbor', 'underground', 'farm', 'sky'] as RaceMap[];

describe('stepMap', () => {
  it('steps right through open worlds and skips locked ones', () => {
    expect(stepMap(all, ['city', 'harbor'], 'city', 1, 0, 4)).toBe('harbor');
    expect(stepMap(all, ['city', 'harbor'], 'harbor', 1, 0, 4)).toBe('city');
  });
  it('steps left with wrap', () => {
    expect(stepMap(all, ['city', 'industrial'], 'city', -1, 0, 4)).toBe('industrial');
  });
  it('moves a row up/down', () => {
    expect(stepMap(all, all, 'city', 0, 1, 4)).toBe('farm');
  });
  it('stays when only the current world is open', () => {
    expect(stepMap(all, ['city'], 'city', 1, 0, 4)).toBe('city');
  });
});
