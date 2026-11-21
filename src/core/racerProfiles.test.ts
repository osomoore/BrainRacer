import { describe, expect, it } from 'vitest';
import {
  applyRacerProfile, createRacer, deleteRacer, isRacerProfileId, playerRacer, racerIds, racerName, racerProfiles, renameRacer, teamRoundSec,
  validRacerName, withRacerProfile,
} from './racerProfiles';
import type { Settings } from './types';
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

const qt = { addition: true, multiplication: true, spelling: false };
const mk = (s: Pick<Settings, 'racerProfiles' | 'customRacers'>, name: string, under10 = true) => {
  const r = createRacer(s, { name, under10, difficulty: 'normal', questionTypes: qt });
  return { id: r.id, s: { ...s, ...r.patch } };
};

describe('custom racers', () => {
  it('allocates ids, including after deletes', () => {
    const a = mk({}, 'Ann');
    const b = mk(a.s, 'Bo');
    expect([a.id, b.id]).toEqual(['u1', 'u2']);
    const d = { ...b.s, ...deleteRacer(b.s, 'u1') };
    expect(racerIds(d)).toEqual(['abe', 'gideon', 'helen', 'daddy', 'u2']);
    expect(mk(d, 'Cy').id).toBe('u3');
    expect(mk({ ...d, ...deleteRacer(d, 'u2') }, 'Di').id).toBe('u1');
  });

  it('sets round time from under10 and keeps types/name', () => {
    const a = mk({}, 'ann', true);
    const b = mk(a.s, 'Bo', false);
    expect(racerProfiles(b.s).u1.roundSec).toBe(300);
    expect(racerProfiles(b.s).u2.roundSec).toBe(180);
    expect(racerProfiles(b.s).u1).toMatchObject({ name: 'ann', difficulty: 'normal', questionTypes: qt });
    const none = createRacer({}, { name: 'X', under10: true, difficulty: 'easy', questionTypes: { addition: false, multiplication: false, spelling: false } });
    expect(Object.values(none.patch.racerProfiles![none.id]!.questionTypes).some(Boolean)).toBe(true);
  });

  it('normalizes and validates names', () => {
    expect(validRacerName('  Mary   Jo ')).toBe('Mary Jo');
    expect(validRacerName('ABCDEFGHIJKLMNOP')).toBe('ABCDEFGHIJ');
    expect(validRacerName('')).toBeUndefined();
    expect(validRacerName('   ')).toBeUndefined();
    expect(validRacerName('R2D2')).toBeUndefined();
    expect(validRacerName(5)).toBeUndefined();
  });

  it('lists only custom racers with a valid profile, deduped', () => {
    const a = mk({}, 'Ann');
    expect(racerIds({ ...a.s, customRacers: ['u1', 'u1', 'u9', 'bad' as never] })).toEqual(['abe', 'gideon', 'helen', 'daddy', 'u1']);
    expect(isRacerProfileId('u1', a.s)).toBe(true);
    expect(isRacerProfileId('u9', a.s)).toBe(false);
    expect(isRacerProfileId('u9')).toBe(true);
    expect(isRacerProfileId('x')).toBe(false);
  });

  it('falls back to the slot default when a custom racer was deleted', () => {
    const a = mk({}, 'Ann');
    expect(playerRacer({ profile: 'u1' }, 1, a.s)).toBe('u1');
    const d = { ...a.s, ...deleteRacer(a.s, 'u1') };
    expect(playerRacer({ profile: 'u1' }, 1, d)).toBe('abe');
    expect(playerRacer({ profile: 'u1' }, 0, d)).toBe('gideon');
  });

  it('works with apply/team time and names', () => {
    const a = mk({}, 'Ann', false);
    expect(applyRacerProfile({ ...base, profile: 'u1' }, 0, a.s)).toMatchObject({ profile: 'u1', difficulty: 'normal', questionTypes: qt });
    expect(teamRoundSec([{ profile: 'u1' }, { profile: 'abe' }], a.s)).toBe(300);
    const e = { ...a.s, ...withRacerProfile(a.s, 'u1', { ...racerProfiles(a.s).u1, roundSec: 240 }) };
    expect(racerName(e, 'u1')).toBe('Ann');
    expect(teamRoundSec([{ profile: 'u1' }], e)).toBe(240);
  });

  it('renames built-ins (reset on empty) and ignores empty for custom', () => {
    let s: Pick<Settings, 'racerProfiles'> = { ...renameRacer({}, 'abe', 'Abraham') };
    expect(racerName(s, 'abe')).toBe('Abraham');
    s = { ...s, ...renameRacer(s, 'abe', '') };
    expect(racerName(s, 'abe')).toBe('Abe');
    const a = mk({}, 'Ann');
    expect(racerName({ ...a.s, ...renameRacer(a.s, 'u1', '') }, 'u1')).toBe('Ann');
    expect(racerName({ ...a.s, ...renameRacer(a.s, 'u1', 'Anna') }, 'u1')).toBe('Anna');
  });

  it('does not delete built-ins', () => {
    expect(deleteRacer({}, 'abe')).toEqual({});
  });
});
