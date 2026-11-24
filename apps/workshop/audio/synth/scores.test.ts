import { describe, expect, it } from 'vitest';
import { WS_MUSIC_NAMES, WS_STING_NAMES } from '../manifest';
import { SCORES, STINGS, loopBeats, loopSeconds } from './scores';

describe('workshop music scores', () => {
  for (const name of WS_MUSIC_NAMES) {
    const score = SCORES[name]();
    it(`${name}: 30-60 s, whole bars, events inside the loop`, () => {
      expect(score.name).toBe(name);
      expect(loopSeconds(score)).toBeGreaterThanOrEqual(30);
      expect(loopSeconds(score)).toBeLessThanOrEqual(60);
      expect(loopBeats(score) % 4).toBe(0);
      for (const e of score.events) {
        expect(e.t).toBeGreaterThanOrEqual(0);
        expect(e.t + e.d).toBeLessThanOrEqual(loopBeats(score) + 0.01);
        expect(e.d).toBeGreaterThan(0);
        expect(e.p).toBeGreaterThanOrEqual(0);
        expect(e.p).toBeLessThanOrEqual(127);
        expect(e.v).toBeGreaterThan(0);
        expect(e.v).toBeLessThanOrEqual(1);
      }
    });
  }

  it.each(['raceRun', 'dinoRun'] as const)('%s introduces its hook in the first bar', (name) => {
    const score = SCORES[name]();
    expect(score.events.some((e) => e.t < 1 && (e.inst === 'drive' || e.inst === 'reed'))).toBe(true);
    expect(score.events.some((e) => e.t < 1 && (e.inst === 'kick' || e.inst === 'tom'))).toBe(true);
  });
});

describe('workshop stings', () => {
  it.each(WS_STING_NAMES)('%s starts immediately and resolves within 1.4 s before release', (name) => {
    const cue = STINGS[name];
    expect(Math.min(...cue.events.map((e) => e.t))).toBe(0);
    const end = Math.max(...cue.events.map((e) => e.t + e.d));
    expect(end * 60 / cue.bpm).toBeLessThan(1.4);
    expect(cue.events.every((e) => e.d > 0 && e.v > 0 && e.v <= 1)).toBe(true);
  });
});
