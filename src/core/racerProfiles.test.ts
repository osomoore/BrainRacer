import { beforeEach, describe, expect, it } from 'vitest';
import { createProfile, listProfiles } from '../../shared/profiles';
import { removeShared } from '../../shared/storage';
import {
  applyRacerProfile, createRacer, deleteRacer, isRacerProfileId, playerRacer, racerIds, racerName, racerProfiles, racerSettingsOf, renameRacer, teamRoundSec,
  validRacerName, withRacerProfile,
} from './racerProfiles';
import type { PlayerSettings, QuestionTypes, Settings } from './types';

const base: PlayerSettings = { device: { type: 'keyboard', layout: 'left' }, difficulty: 'normal', car: 'dino' };
const q = (math: boolean, reading: boolean, jbq: boolean): QuestionTypes => ({ math, reading, jbq });
const J = { points: 10, scope: 'week' } as const;
const NEW_DEFAULT = { difficulty: 'easy', questionTypes: q(true, true, false), roundSec: 300, jbq: J };

/** Makes profiles Robin, Sam, Kim (ids p1..p3 on a clean store). */
const seed = (...names: string[]) => names.map(n => createProfile(n)!.id);

describe('racerProfiles', () => {
  beforeEach(() => { removeShared('profiles'); removeShared('profileSeq'); });

  it('a fresh device has no racers and no default racer', () => {
    expect(racerIds({})).toEqual([]);
    expect(racerProfiles({})).toEqual({});
    expect(playerRacer(undefined, 0)).toBeUndefined();
    expect(playerRacer({ profile: 'gone' }, 1)).toBeUndefined();
    expect(teamRoundSec([{}], {})).toBe(300);
    expect(applyRacerProfile(base, 0, {})).toMatchObject({ profile: undefined, difficulty: 'easy', questionTypes: q(true, true, false) });
  });

  it('every profile starts from the new-profile defaults and normalizes bad saved values', () => {
    const [a, b] = seed('Robin', 'Sam');
    expect(racerProfiles({})).toEqual({ [a]: NEW_DEFAULT, [b]: NEW_DEFAULT });
    const bad = { difficulty: 'bogus' as never, questionTypes: q(false, false, false), roundSec: 5, jbq: { points: 7, scope: 'year' } as never };
    expect(racerProfiles({ racerProfiles: { [a]: bad } })[a]).toEqual(NEW_DEFAULT);
  });

  it('defaults each slot to its own position, and keeps the last choice while it exists', () => {
    const [a, b, c] = seed('Robin', 'Sam', 'Kim');
    expect(playerRacer(undefined, 0)).toBe(a);
    expect(playerRacer({}, 1)).toBe(b);
    expect(playerRacer({ profile: c }, 0)).toBe(c);
    expect(playerRacer({}, 3)).toBeUndefined();
    deleteRacer({}, c);
    expect(playerRacer({ profile: c }, 0)).toBe(a);
  });

  it('applies saved settings onto the player', () => {
    const [a] = seed('Robin');
    const s = withRacerProfile({}, a, { difficulty: 'easyPlus', questionTypes: q(true, false, true), roundSec: 240, jbq: { points: 30, scope: 'month' } });
    expect(applyRacerProfile({ ...base, profile: a }, 0, s)).toMatchObject({ profile: a, difficulty: 'easyPlus', questionTypes: q(true, false, true), jbq: { points: 30, scope: 'month' } });
  });

  it('race length is the longest time among the racers', () => {
    const [a, b] = seed('Robin', 'Sam');
    let s: Pick<Settings, 'racerProfiles'> = withRacerProfile({}, a, { ...NEW_DEFAULT, difficulty: 'hard', roundSec: 180 } as never);
    s = { ...s, ...withRacerProfile(s, b, { ...NEW_DEFAULT, roundSec: 420 } as never) };
    expect(teamRoundSec([{ profile: a }], s)).toBe(180);
    expect(teamRoundSec([{ profile: a }, { profile: b }], s)).toBe(420);
  });

  it('creates a shared profile plus its settings, ids opaque and never reused', () => {
    const r = createRacer({}, { name: 'Robin', ageBand: '8-9', questionTypes: q(true, false, true) })!;
    expect(listProfiles().map(p => p.name)).toEqual(['Robin']);
    expect(r.patch.racerProfiles![r.id]).toEqual({ difficulty: 'normal', questionTypes: q(true, false, true), roundSec: 300, jbq: J });
    expect(racerSettingsOf(r.patch, r.id).roundSec).toBe(300);
    const old = createRacer(r.patch, { name: 'Sam', ageBand: '10+', questionTypes: q(true, false, true) })!;
    expect(old.patch.racerProfiles![old.id]!.roundSec).toBe(180);
    expect(old.patch.racerProfiles![old.id]!.difficulty).toBe('hard');
    expect(old.patch.racerProfiles![r.id]).toBeDefined();
    deleteRacer(old.patch, old.id);
    expect(createRacer({}, { name: 'Kim', ageBand: '0-5', questionTypes: q(true, true, false) })!.id).not.toBe(old.id);
    expect(createRacer({}, { name: '123', ageBand: '0-5', questionTypes: q(true, true, false) })).toBeNull();
  });

  it('renames through the shared store and rejects invalid names', () => {
    const [a] = seed('Robin');
    expect(racerName({}, a)).toBe('Robin');
    expect(renameRacer(a, 'Robyn')).toBe(true);
    expect(racerName({}, a)).toBe('Robyn');
    expect(renameRacer(a, '')).toBe(false);
    expect(racerName({}, a)).toBe('Robyn');
    expect(racerName({}, 'gone')).toBe('Racer');
    expect(racerName({}, undefined)).toBe('Racer');
  });

  it('deletes a racer everywhere and drops its settings', () => {
    const [a, b] = seed('Robin', 'Sam');
    const s = withRacerProfile({}, a, { ...NEW_DEFAULT, roundSec: 60 } as never);
    const patch = deleteRacer(s, a);
    expect(racerIds({})).toEqual([b]);
    expect(patch.racerProfiles![a]).toBeUndefined();
    expect(isRacerProfileId(a)).toBe(false);
    expect(isRacerProfileId(b)).toBe(true);
  });

  it('validates names with the shared rules', () => {
    expect(validRacerName('  Mia   Lou ')).toBe('Mia Lou');
    expect(validRacerName('Abcdefghijklmnop')).toBe('Abcdefghij');
    expect(validRacerName('R2D2')).toBeUndefined();
    expect(validRacerName('')).toBeUndefined();
    expect(validRacerName(7)).toBeUndefined();
  });
});
