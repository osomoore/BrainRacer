import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './gameConfig';
import { parseLaunchOptions } from './launchOptions';

describe('parseLaunchOptions', () => {
  it('uses defaults (300 s / 10 s / 0.6 / 0.8) when nothing is given', () => {
    expect(parseLaunchOptions('')).toEqual({ roundLengthSec: 300, challengeIntervalSec: 10, musicVolume: 0.6, sfxVolume: 0.8 });
    expect(DEFAULT_SETTINGS.roundLengthSec).toBe(300);
  });
  it('parses valid values', () => {
    expect(parseLaunchOptions('?round=240&every=12&music=0.5&sfx=0.7'))
      .toEqual({ roundLengthSec: 240, challengeIntervalSec: 12, musicVolume: 0.5, sfxVolume: 0.7 });
  });
  it('falls back on invalid or out-of-range round/every', () => {
    const o = parseLaunchOptions('?round=abc&every=0');
    expect(o.roundLengthSec).toBe(300);
    expect(o.challengeIntervalSec).toBe(10);
    expect(parseLaunchOptions('?round=99999&every=-5')).toMatchObject({ roundLengthSec: 300, challengeIntervalSec: 10 });
    expect(parseLaunchOptions('?round=&every=Infinity').roundLengthSec).toBe(300);
  });
  it('clamps volumes to 0..1 and ignores garbage', () => {
    expect(parseLaunchOptions('?music=3&sfx=-1')).toMatchObject({ musicVolume: 1, sfxVolume: 0 });
    expect(parseLaunchOptions('?music=0&sfx=x')).toMatchObject({ musicVolume: 0, sfxVolume: 0.8 });
  });
});
