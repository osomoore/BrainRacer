import { describe, expect, it } from 'vitest';
import { applyRacerProfile, playerRacer, racerProfiles, withRacerProfile } from './racerProfiles';
import type { PlayerSettings } from './types';

const base: PlayerSettings = { device: { type: 'keyboard', layout: 'left' }, difficulty: 'normal', car: 'dino' };

describe('racerProfiles', () => {
  it('has the requested defaults', () => {
    const p = racerProfiles({});
    expect(p.abe).toEqual({ difficulty: 'easy', questionTypes: { addition: true, multiplication: false, spelling: true } });
    expect(p.gideon).toEqual({ difficulty: 'normal', questionTypes: { addition: true, multiplication: false, spelling: true } });
    expect(p.helen).toEqual({ difficulty: 'hard', questionTypes: { addition: false, multiplication: true, spelling: true } });
  });

  it('falls back on invalid saved data and never leaves all types off', () => {
    const p = racerProfiles({ racerProfiles: { abe: { difficulty: 'bogus' as never, questionTypes: { addition: false, multiplication: false, spelling: false } } } });
    expect(p.abe.difficulty).toBe('easy');
    expect(p.abe.questionTypes.spelling).toBe(true);
  });

  it('defaults P1 to Gideon and P2 to Abe', () => {
    expect(playerRacer(undefined, 0)).toBe('gideon');
    expect(playerRacer({}, 1)).toBe('abe');
    expect(playerRacer({ profile: 'helen' }, 0)).toBe('helen');
  });

  it('applies edited profiles to the player', () => {
    const s = withRacerProfile({}, 'helen', { difficulty: 'easyPlus', questionTypes: { addition: true, multiplication: true, spelling: false } });
    const p = applyRacerProfile({ ...base, profile: 'helen' }, 0, s);
    expect(p.difficulty).toBe('easyPlus');
    expect(p.questionTypes).toEqual({ addition: true, multiplication: true, spelling: false });
  });
});
