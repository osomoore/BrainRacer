import { describe, expect, it } from 'vitest';
import { GAMES, gameUrl, lastGame, setLastGame } from './hub';
import { readShared, writeShared } from './storage';

describe('hub', () => {
  it('lists Brain Racer and Adventure Workshop as separate pages', () => {
    expect(GAMES.map((g) => g.id)).toEqual(['racer', 'workshop']);
    expect(new Set(GAMES.map((g) => g.page)).size).toBe(GAMES.length);
    expect(gameUrl('racer', '?race=1')).toBe('racer.html?race=1');
  });
  it('marks only Adventure Workshop as beta', () => {
    expect(GAMES.filter((g) => g.beta).map((g) => g.id)).toEqual(['workshop']);
  });
  it('remembers the last game (in-memory fallback without localStorage)', () => {
    expect(lastGame()).toBeNull();
    setLastGame('workshop');
    expect(lastGame()).toBe('workshop');
  });
  it('ignores unknown stored ids', () => {
    writeShared('lastGame', 'pinball');
    expect(lastGame()).toBeNull();
  });
  it('round-trips shared JSON values', () => {
    writeShared('x', { a: 1 });
    expect(readShared('x', null)).toEqual({ a: 1 });
    expect(readShared('missing', 7)).toBe(7);
  });
});
