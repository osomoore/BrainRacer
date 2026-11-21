import { describe, expect, it } from 'vitest';
import { applyRacerProfile, playerRacer, racerProfiles, teamRoundSec, withRacerProfile } from './racerProfiles';
import type { PlayerSettings } from './types';

const base: PlayerSettings = { device: { type: 'keyboard', layout: 'left' }, difficulty: 'normal', car: 'dino' };

describe('racerProfiles', () => {
  it('has the requested defaults', () => {
    const p = racerProfiles({});
    expect(p.abe).toEqual({ difficulty: 'easy', questionTypes: { addition: true, multiplication: false, spelling: true }, roundSec: 300 });
    expect(p.gideon).toEqual({ difficulty: 'normal', questionTypes: { addition: true, multiplication: false, spelling: true }, roundSec: 300 });
    expect(p.helen).toEqual({ difficulty: 'hard', questionTypes: { addition: false, multiplication: true, spelling: true }, roundSec: 180 });
    expect(p.daddy).toEqual(p.helen);
  });

  it('falls back on invalid saved data and never leaves all types off', () => {
    const p = racerProfiles({ racerProfiles: { abe: { difficulty: 'bogus' as never, questionTypes: { addition: false, multiplication: false, spelling: false }, roundSec: 300 } } });
    expect(p.abe.difficulty).toBe('easy');
    expect(p.abe.questionTypes.spelling).toBe(true);
  });

  it('defaults P1 to Gideon and P2 to Abe', () => {
    expect(playerRacer(undefined, 0)).toBe('gideon');
    expect(playerRacer({}, 1)).toBe('abe');
    expect(playerRacer({ profile: 'helen' }, 0)).toBe('helen');
  });

  it('applies edited profiles to the player', () => {
    const s = withRacerProfile({}, 'helen', { difficulty: 'easyPlus', questionTypes: { addition: true, multiplication: true, spelling: false }, roundSec: 240 });
    const p = applyRacerProfile({ ...base, profile: 'helen' }, 0, s);
    expect(p.difficulty).toBe('easyPlus');
    expect(p.questionTypes).toEqual({ addition: true, multiplication: true, spelling: false });
  });

  it('uses the longer race time of the two racers, and admin edits', () => {
    expect(teamRoundSec([{ profile: 'helen' }], {})).toBe(180);
    expect(teamRoundSec([{ profile: 'helen' }, { profile: 'abe' }], {})).toBe(300);
    expect(teamRoundSec([{ profile: 'daddy' }, { profile: 'helen' }], {})).toBe(180);
    const s = withRacerProfile({}, 'daddy', { ...racerProfiles({}).daddy, roundSec: 420 });
    expect(teamRoundSec([{ profile: 'daddy' }, { profile: 'gideon' }], s)).toBe(420);
    expect(racerProfiles({ racerProfiles: { abe: { ...racerProfiles({}).abe, roundSec: -5 } } }).abe.roundSec).toBe(300);
  });
});
