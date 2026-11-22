import { describe, expect, it } from 'vitest';
import type { InputDevice, RacerProfileId } from '../../core/types';
import { allReady, canAdvance, claimSlot, freeRacer, isLocked, leaveSlot, newJoinPlayer, nextRacer, racerOptions, setReady, waitingFor, type JoinSlot } from './joinLogic';

const pad = (index: number): InputDevice => ({ type: 'gamepad', index });
const kb: InputDevice = { type: 'keyboard', layout: 'left' };
const join = (...ds: InputDevice[]) => ds.reduce<JoinSlot[]>((s, d) => claimSlot(s, d), []);
const R = (...v: string[]) => v as RacerProfileId[];

describe('slot assignment', () => {
  it('claims panels in order and ignores duplicates', () => {
    expect(join(pad(2), kb, pad(2)).map((x) => x.device)).toEqual([pad(2), kb]);
  });
  it('caps at 4 players', () => {
    expect(join(pad(0), pad(1), pad(2), pad(3), pad(4))).toHaveLength(4);
  });
  it('leaving compacts later players up', () => {
    expect(leaveSlot(join(pad(0), pad(1), pad(2)), 1).map((x) => x.device)).toEqual([pad(0), pad(2)]);
  });
});

describe('ready, lock and advance', () => {
  it('ready locks choices and un-ready unlocks them', () => {
    let s = join(pad(0), pad(1));
    expect(isLocked(s, 0)).toBe(false);
    s = setReady(s, 0, true);
    expect(isLocked(s, 0)).toBe(true);
    expect(isLocked(s, 1)).toBe(false);
    s = setReady(s, 0, false);
    expect(isLocked(s, 0)).toBe(false);
  });
  it('only P1 can advance, and only when everyone joined is ready', () => {
    let s = join(pad(0), pad(1), pad(2));
    s = setReady(setReady(s, 0, true), 1, true);
    expect(allReady(s)).toBe(false);
    expect(canAdvance(s, 0)).toBe(false);
    expect(waitingFor(s)).toEqual([3]);
    s = setReady(s, 2, true);
    expect(canAdvance(s, 0)).toBe(true);
    expect(canAdvance(s, 1)).toBe(false);
    expect(canAdvance(s, 2)).toBe(false);
  });
  it('nobody joined means nothing to advance', () => {
    expect(allReady([])).toBe(false);
    expect(canAdvance([], 0)).toBe(false);
  });
});

describe('unique racers', () => {
  const ids = R('robin', 'sam', 'kim', 'lee', 'u1');
  it('excludes racers held by other players', () => {
    expect(racerOptions(ids, R('robin', 'kim'), true)).toEqual(['sam', 'lee', 'u1', 'new']);
  });
  it('cycles over the free ones with wrap', () => {
    expect(nextRacer(ids, R('robin', 'sam', 'kim'), false, 'lee' as RacerProfileId, 1)).toBe('u1');
    expect(nextRacer(ids, R('robin', 'sam', 'kim'), false, 'u1' as RacerProfileId, 1)).toBe('lee');
  });
  it('freeRacer prefers the wish, else the first free', () => {
    expect(freeRacer(ids, R('sam'), 'sam' as RacerProfileId)).toBe('robin');
    expect(freeRacer(ids, R('robin'), 'sam' as RacerProfileId)).toBe('sam');
    expect(freeRacer(ids, R(...ids))).toBeUndefined();
    expect(freeRacer([], [])).toBeUndefined();
  });
  it('new joiners get distinct defaults', () => {
    const taken: RacerProfileId[] = [];
    for (let i = 0; i < 4; i++) {
      const p = newJoinPlayer(i, pad(i), undefined, undefined, ids, taken, i === 0 ? 'sam' as RacerProfileId : i === 1 ? 'robin' as RacerProfileId : undefined);
      taken.push(p.profile!);
    }
    expect(taken).toEqual(['sam', 'robin', 'kim', 'lee']);
  });
  it('a joiner with no free racer gets no profile (they make one)', () => {
    expect(newJoinPlayer(0, pad(0), undefined, undefined, [], [], undefined).profile).toBeUndefined();
    expect(newJoinPlayer(1, pad(1), undefined, undefined, R('robin'), R('robin'), 'robin').profile).toBeUndefined();
  });
});
