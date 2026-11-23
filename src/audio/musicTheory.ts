/** Pure (Tone-free, Phaser-free) music helpers: units, validation, MIDI-file -> track conversion. */

export type InstrumentKind = 'square' | 'pulse25' | 'triangle' | 'sawtooth' | 'pluck' | 'noise';
export const INSTRUMENTS: readonly InstrumentKind[] = ['square', 'pulse25', 'triangle', 'sawtooth', 'pluck', 'noise'];

/** Note start (t) and duration (d) are measured in beats. */
export interface TrackNote { t: number; d: number; p: number; v: number }
export interface TrackLayer { instrument: InstrumentKind; volume: number; notes: TrackNote[] }
export interface TrackData {
  name: string;
  bpm: number;
  loop: boolean;
  lengthBeats: number;
  tracks: TrackLayer[];
}

export function beatsToSeconds(beats: number, bpm: number): number {
  return (beats * 60) / bpm;
}
export function secondsToBeats(sec: number, bpm: number): number {
  return (sec * bpm) / 60;
}
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Returns a list of problems; empty means the track is well-formed. */
export function validateTrack(track: unknown): string[] {
  const errs: string[] = [];
  if (typeof track !== 'object' || track === null) return ['not an object'];
  const t = track as Partial<TrackData>;
  if (typeof t.name !== 'string') errs.push('name must be a string');
  if (typeof t.bpm !== 'number' || !(t.bpm > 0)) errs.push('bpm must be > 0');
  if (typeof t.loop !== 'boolean') errs.push('loop must be boolean');
  if (typeof t.lengthBeats !== 'number' || !(t.lengthBeats > 0)) errs.push('lengthBeats must be > 0');
  if (!Array.isArray(t.tracks) || t.tracks.length === 0) {
    errs.push('tracks must be a non-empty array');
    return errs;
  }
  const len = typeof t.lengthBeats === 'number' ? t.lengthBeats : Infinity;
  t.tracks.forEach((layer, i) => {
    const where = `tracks[${i}]`;
    if (!INSTRUMENTS.includes(layer?.instrument)) errs.push(`${where}: invalid instrument ${String(layer?.instrument)}`);
    if (typeof layer?.volume !== 'number' || layer.volume < 0 || layer.volume > 1.5) errs.push(`${where}: volume out of range`);
    if (!Array.isArray(layer?.notes)) { errs.push(`${where}: notes must be an array`); return; }
    layer.notes.forEach((n, j) => {
      const w = `${where}.notes[${j}]`;
      if (!(n.t >= 0)) errs.push(`${w}: t must be >= 0`);
      if (!(n.d > 0)) errs.push(`${w}: d must be > 0`);
      if (n.t + n.d > len + 1e-6) errs.push(`${w}: ends after lengthBeats`);
      if (!(n.p >= 0 && n.p <= 127)) errs.push(`${w}: p out of MIDI range`);
      if (!(n.v >= 0 && n.v <= 1)) errs.push(`${w}: v out of 0..1`);
    });
  });
  return errs;
}

/** Drum pitch class used by the player: 36 kick, 38 snare, 42 hat. */
export function drumKind(p: number): 'kick' | 'snare' | 'hat' {
  if (p <= 37) return 'kick';
  if (p <= 41) return 'snare';
  return 'hat';
}

/** Map a General-MIDI drum note to the 36/38/42 vocabulary of our noise tracks. */
export function gmDrumToBasic(p: number): number {
  if (p === 35 || p === 36 || p === 41 || p === 43 || p === 45) return 36;
  if (p === 38 || p === 39 || p === 40 || p === 37) return 38;
  return 42;
}

/** Minimal structural view of a parsed MIDI file (matches @tonejs/midi's `Midi`). */
export interface MidiLike {
  header: { ppq: number; tempos: { bpm: number }[] };
  tracks: {
    channel: number;
    instrument: { percussion: boolean };
    notes: { ticks: number; durationTicks: number; midi: number; velocity: number }[];
  }[];
}

const MELODIC_CYCLE: InstrumentKind[] = ['square', 'pulse25'];

export function midiToTrack(midi: MidiLike, name: string, loop: boolean): TrackData {
  const ppq = midi.header.ppq || 480;
  const bpm = midi.header.tempos[0]?.bpm ?? 120;
  const layers: TrackLayer[] = [];
  let melodicIdx = 0;
  let end = 0;
  for (const tr of midi.tracks) {
    if (tr.notes.length === 0) continue;
    const drums = tr.instrument.percussion || tr.channel === 9; // channel 10 (1-based)
    const notes: TrackNote[] = tr.notes.map((n) => {
      const t = n.ticks / ppq;
      const d = Math.max(0.05, n.durationTicks / ppq);
      end = Math.max(end, t + d);
      return {
        t,
        d: drums ? Math.min(d, 0.25) : d,
        p: drums ? gmDrumToBasic(n.midi) : n.midi,
        v: Math.min(1, Math.max(0.05, n.velocity)),
      };
    });
    notes.sort((a, b) => a.t - b.t);
    if (drums) {
      layers.push({ instrument: 'noise', volume: 0.6, notes });
    } else {
      const avg = notes.reduce((s, n) => s + n.p, 0) / notes.length;
      const instrument: InstrumentKind = avg < 52 ? 'triangle' : MELODIC_CYCLE[melodicIdx++ % MELODIC_CYCLE.length];
      layers.push({ instrument, volume: instrument === 'triangle' ? 0.8 : 0.5, notes });
    }
  }
  const lengthBeats = Math.max(4, Math.ceil(end / 4) * 4);
  return { name, bpm, loop, lengthBeats, tracks: layers };
}

/** True if the buffer starts with the MIDI header chunk "MThd" (guards against SPA fallback -> index.html). */
export function looksLikeMidi(bytes: ArrayLike<number>): boolean {
  return bytes.length >= 4 && bytes[0] === 0x4d && bytes[1] === 0x54 && bytes[2] === 0x68 && bytes[3] === 0x64;
}
