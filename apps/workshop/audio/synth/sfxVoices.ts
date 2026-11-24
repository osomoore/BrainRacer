/** Acoustic-style layers for Workshop's offline cartoon effects. */
import * as Tone from 'tone';
import { midiHz, type Voice } from './voice';

/** A struck object with a rounded body and two shorter, higher resonances. */
export function mallet(v: Voice, t: number, hz: number, dur: number, vol: number): void {
  v.tone({ type: 'sine', pitch: [[0, hz * 1.04], [0.018, hz]], t, dur, vol, attack: 0.004, hold: 0.12 });
  v.tone({ type: 'sine', pitch: [[0, hz * 2.76]], t, dur: dur * 0.5, vol: vol * 0.27, attack: 0.002 });
  v.tone({ type: 'sine', pitch: [[0, hz * 4.08]], t, dur: dur * 0.25, vol: vol * 0.13, attack: 0.001 });
}

/** Bright coin or glass resonance. The upper partial dies away before the note. */
export function glint(v: Voice, t: number, midi: number, dur: number, vol: number): void {
  const hz = midiHz(midi);
  v.tone({ type: 'sine', pitch: [[0, hz]], t, dur, vol, attack: 0.004, hold: 0.12 });
  v.tone({ type: 'sine', pitch: [[0, hz * 2.01]], t, dur: dur * 0.67, vol: vol * 0.32, attack: 0.003 });
  v.tone({ type: 'sine', pitch: [[0, hz * 3.02]], t, dur: dur * 0.26, vol: vol * 0.12, attack: 0.002 });
}

/** A small air bubble detaches, expands, and breaks. */
export function bubble(v: Voice, t: number, hz: number, dur: number, vol: number): void {
  const pitch: [number, number][] = [[0, hz * 0.58], [dur * 0.26, hz], [dur * 0.8, hz * 0.82]];
  v.tone({ type: 'sine', pitch, t, dur, vol, attack: dur * 0.11, hold: 0.09 });
  v.noise({ filter: 'bandpass', f0: 1950, q: 0.8, t: t + dur * 0.29, dur: dur * 0.42, vol: vol * 0.19, attack: 0.002 });
}

/** Contact body, audible surface, and a short softening tail. */
export function impact(v: Voice, t: number, hz: number, surfaceHz: number, dur: number, vol: number): void {
  v.tone({ type: 'sine', pitch: [[0, hz], [dur * 0.52, hz * 0.51]], t, dur, vol, attack: 0.003, hold: 0.12 });
  v.tone({ type: 'triangle', pitch: [[0, hz * 2.16], [dur * 0.32, hz * 1.24]], t, dur: dur * 0.68,
    vol: vol * 0.42, attack: 0.004 });
  v.noise({ color: 'pink', filter: 'bandpass', f0: surfaceHz, f1: surfaceHz * 0.44, q: 0.7, t,
    dur: dur * 0.78, vol: vol * 0.62, attack: 0.004, hold: 0.11 });
}

interface Syllable {
  t: number;
  dur: number;
  pitch: [number, number][];
  /** First and second vowel resonance, in Hz, at the start and end of the syllable. */
  mouth: [[number, number], [number, number]];
  vol: number;
  attack?: number;
  roughness?: number;
}

/** Shape a cartoon character voice with changing vowels and a quiet breath layer. */
export function syllable(v: Voice, { t, dur, pitch, mouth, vol, attack = 0.028, roughness = 0.16 }: Syllable): void {
  const throat = v.add(new Tone.Gain(1));
  mouth.forEach(([first, last], i) => {
    const resonator = v.add(new Tone.BiquadFilter({ type: 'bandpass', frequency: first, Q: i === 0 ? 3.1 : 4.3 }));
    resonator.frequency.setValueAtTime(first, t);
    resonator.frequency.exponentialRampToValueAtTime(last, t + dur * 0.78);
    throat.connect(resonator);
    resonator.connect(v.add(new Tone.Gain(i === 0 ? 1 : 0.53)).connect(v.out));
  });
  v.tone({ type: 'sawtooth', pitch, t, dur, vol, attack, hold: 0.44,
    vib: [32, 6.4], trem: [roughness, 23] }, throat);
  v.tone({ type: 'triangle', pitch, t, dur, vol: vol * 0.18, attack, hold: 0.39, vib: [32, 6.4] });
  v.noise({ color: 'pink', filter: 'bandpass', f0: mouth[1][0], f1: mouth[1][1], q: 1,
    t, dur: dur * 0.78, vol: vol * 0.28, attack, hold: 0.28 });
}
