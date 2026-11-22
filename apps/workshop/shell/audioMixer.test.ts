import { describe, expect, it } from 'vitest';
import type { WorkshopAudio, WsMusic } from '../core/runtime';
import { arbitrateMusic, AudioMixer, paneSfxPan } from './audioMixer';

describe('arbitrateMusic', () => {
  it('same or single track wins, different tracks give the title theme, none is silence', () => {
    expect(arbitrateMusic([null, null])).toBeNull();
    expect(arbitrateMusic(['raceShop', null])).toBe('raceShop');
    expect(arbitrateMusic(['raceShop', 'raceShop'])).toBe('raceShop');
    expect(arbitrateMusic(['raceShop', 'dinoLab'])).toBe('title');
  });
});

describe('paneSfxPan', () => {
  it('pans by pane only in 2P', () => {
    expect(paneSfxPan(0, 1)).toBe(0);
    expect(paneSfxPan(0, 2)).toBeLessThan(0);
    expect(paneSfxPan(1, 2)).toBeGreaterThan(0);
  });
});

describe('AudioMixer', () => {
  it('only changes the base track when the arbitrated result changes', () => {
    const calls: (WsMusic | null)[] = [];
    const pans: number[] = [];
    const base: WorkshopAudio = {
      music: (t) => { calls.push(t); },
      sfx: (_n, o) => { pans.push(o?.pan ?? 0); },
      sting() {}, loop: () => () => {},
    };
    const mixer = new AudioMixer(base);
    mixer.count = 2;
    const a = mixer.forPane(0);
    const b = mixer.forPane(1);
    a.music('raceShop'); a.music('raceShop');
    b.music('dinoLab');
    b.music('raceShop');
    expect(calls).toEqual(['raceShop', 'title', 'raceShop']);
    a.sfx('click'); b.sfx('click');
    expect(pans[0]).toBeLessThan(0);
    expect(pans[1]).toBeGreaterThan(0);
  });
});
