import { describe, expect, it } from 'vitest';
import title from './music/tracks/title.json';
import race from './music/tracks/race.json';
import industrial from './music/tracks/industrial.json';
import dino from './music/tracks/dino.json';
import farm from './music/tracks/farm.json';
import underground from './music/tracks/underground.json';
import sky from './music/tracks/sky.json';
import forest from './music/tracks/forest.json';
import underwater from './music/tracks/underwater.json';
import { QUEUED_TRACKS } from './music/queuedTracks';
import { TRACK_STYLES } from './music/trackStyles';
import results from './music/tracks/results.json';
import {
  beatsToSeconds, drumKind, gmDrumToBasic, looksLikeMidi, midiToFreq, midiToTrack, prepareLayerNotes, secondsToBeats, validateTrack,
  type MidiLike, type TrackStyle,
} from './musicTheory';

describe('per-track note style', () => {
  const notes = [
    { t: 1, d: 0.8, p: 65, v: 1 },
    { t: 0, d: 0.5, p: 60, v: 1 },
    { t: 0, d: 0.9, p: 64, v: 1 },
  ];
  it('defaults to seconds: d is played as seconds, untouched', () => {
    const out = prepareLayerNotes({ instrument: 'triangle', volume: 1, notes }, 120, 2);
    expect(out.map((n) => n.durationSec)).toEqual([0.5, 0.9, 0.8]);
    expect(out.map(({ p }) => p).sort()).toEqual([60, 64, 65]);
  });
  it('beats mode converts d at the track tempo', () => {
    const out = prepareLayerNotes({ instrument: 'triangle', volume: 1, notes }, 120, 2, { durationUnit: 'beats' });
    expect(out[0].durationSec).toBeCloseTo(0.25);
    expect(out[1].durationSec).toBeCloseTo(0.45);
    expect(out[2].durationSec).toBeCloseTo(0.4);
    const slow = prepareLayerNotes({ instrument: 'triangle', volume: 1, notes }, 60, 2, { durationUnit: 'beats' });
    expect(slow[0].durationSec).toBeCloseTo(0.5);
  });
  it('sustain extends pitched notes within their available time and leaves percussion alone', () => {
    const style = { durationUnit: 'beats', sustain: true } as const;
    const pitched = prepareLayerNotes({ instrument: 'triangle', volume: 1, notes }, 120, 2, style);
    expect(pitched[0].durationSec).toBeCloseTo(0.35); // 0.25 * 1.4
    expect(pitched[1].durationSec).toBeCloseTo(0.5); // capped at the next onset
    expect(pitched[2].durationSec).toBeCloseTo(0.5);
    const percussion = prepareLayerNotes({ instrument: 'noise', volume: 1, notes }, 120, 2, style);
    expect(percussion[0].durationSec).toBeCloseTo(0.25);
    expect(notes[1].d).toBe(0.5);
  });
});

describe('track styles', () => {
  const ids = ['title', 'race', 'industrial', 'harbor', 'farm', 'underground', 'sky', 'forest', 'underwater', 'dino', 'results', ...Object.keys(QUEUED_TRACKS)];
  it('every track id has a valid style', () => {
    for (const id of ids) {
      const st = (TRACK_STYLES as Record<string, TrackStyle | undefined>)[id];
      expect(st, id).toBeDefined();
      expect(['beats', 'seconds']).toContain(st!.durationUnit);
      if (st!.sustain !== undefined) expect(typeof st!.sustain).toBe('boolean');
      if (st!.lowpassHz !== undefined) expect(st!.lowpassHz).toBeGreaterThan(200);
    }
    expect(Object.keys(TRACK_STYLES).sort()).toEqual([...ids].sort());
  });
  it('matches the chosen picks', () => {
    expect(TRACK_STYLES.brickworks).toMatchObject({ durationUnit: 'beats', lowpassHz: 5600 });
    expect(TRACK_STYLES.race?.durationUnit).toBe('seconds');
    expect(TRACK_STYLES.farm?.sustain).toBeFalsy();
    expect(TRACK_STYLES.volcano?.sustain).toBe(true);
  });
});

describe('units', () => {
  it('beats <-> seconds', () => {
    expect(beatsToSeconds(4, 120)).toBeCloseTo(2);
    expect(beatsToSeconds(1, 60)).toBeCloseTo(1);
    expect(secondsToBeats(2, 120)).toBeCloseTo(4);
  });
  it('midi -> freq', () => {
    expect(midiToFreq(69)).toBeCloseTo(440);
    expect(midiToFreq(57)).toBeCloseTo(220);
    expect(midiToFreq(60)).toBeCloseTo(261.63, 1);
  });
  it('drum kinds', () => {
    expect(drumKind(36)).toBe('kick');
    expect(drumKind(38)).toBe('snare');
    expect(drumKind(42)).toBe('hat');
    expect(gmDrumToBasic(35)).toBe(36);
    expect(gmDrumToBasic(46)).toBe(42);
  });
});

describe('validateTrack', () => {
  for (const [name, t] of Object.entries({ title, race, industrial, farm, underground, sky, forest, underwater, dino, results, ...QUEUED_TRACKS })) {
    it(`${name}.json is well-formed`, () => {
      expect(validateTrack(t)).toEqual([]);
    });
  }
  it('farm loops on a bar boundary', () => {
    expect(farm.lengthBeats % 4).toBe(0);
    expect(farm.bpm).toBeGreaterThanOrEqual(120);
    expect(farm.bpm).toBeLessThanOrEqual(140);
  });
  it('flags bad data', () => {
    const bad = { name: 'x', bpm: 0, loop: true, lengthBeats: 4, tracks: [{ instrument: 'banjo', volume: 1, notes: [{ t: 3.5, d: 1, p: 60, v: 1 }] }] };
    const errs = validateTrack(bad);
    expect(errs.some((e) => e.includes('bpm'))).toBe(true);
    expect(errs.some((e) => e.includes('instrument'))).toBe(true);
    expect(errs.some((e) => e.includes('lengthBeats'))).toBe(true);
    expect(validateTrack(null).length).toBeGreaterThan(0);
  });
});

describe('midiToTrack', () => {
  const midi: MidiLike = {
    header: { ppq: 480, tempos: [{ bpm: 100 }] },
    tracks: [
      { channel: 0, instrument: { percussion: false }, notes: [{ ticks: 0, durationTicks: 480, midi: 72, velocity: 0.8 }, { ticks: 480, durationTicks: 240, midi: 74, velocity: 0.8 }] },
      { channel: 1, instrument: { percussion: false }, notes: [{ ticks: 0, durationTicks: 960, midi: 40, velocity: 0.7 }] },
      { channel: 9, instrument: { percussion: true }, notes: [{ ticks: 0, durationTicks: 120, midi: 35, velocity: 1 }, { ticks: 960, durationTicks: 120, midi: 42, velocity: 1 }] },
      { channel: 3, instrument: { percussion: false }, notes: [] },
    ],
  };
  const t = midiToTrack(midi, 'm', true);
  it('converts tempo, ticks and instruments', () => {
    expect(t.bpm).toBe(100);
    expect(t.tracks).toHaveLength(3);
    expect(t.tracks[0].instrument).toBe('square');
    expect(t.tracks[0].notes[1].t).toBeCloseTo(1);
    expect(t.tracks[0].notes[1].d).toBeCloseTo(0.5);
    expect(t.tracks[1].instrument).toBe('triangle');
    expect(t.tracks[2].instrument).toBe('noise');
    expect(t.tracks[2].notes.map((n) => n.p)).toEqual([36, 42]);
  });
  it('produces a valid track', () => {
    expect(validateTrack(t)).toEqual([]);
    expect(t.lengthBeats % 4).toBe(0);
  });
  it('detects MIDI header', () => {
    expect(looksLikeMidi([0x4d, 0x54, 0x68, 0x64, 0])).toBe(true);
    expect(looksLikeMidi([0x3c, 0x21, 0x44, 0x4f])).toBe(false);
  });
});
