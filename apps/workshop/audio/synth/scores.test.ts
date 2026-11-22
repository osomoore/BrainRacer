import { describe, expect, it } from 'vitest';
import { WS_MUSIC_NAMES } from '../manifest';
import { SCORES, loopBeats, loopSeconds } from './scores';

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
});
