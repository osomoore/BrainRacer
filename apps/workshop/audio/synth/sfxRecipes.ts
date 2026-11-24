/** Recipes for every WsSfx and WsSting (offline, mono). Silly and friendly: nothing harsh, nothing scary. */
import type { WsSting } from '../../core/runtime';
import type { WsAudioSfx } from '../manifest';
import { chime, midiHz, type Voice } from './voice';

export const SFX_SR = 32000;

export interface Recipe {
  /** Render window in seconds (trailing silence is trimmed). For loops: the exact loop length. */
  sec: number;
  /** Final peak level (linear). */
  peak: number;
  /** Seamless loop: rendered `sec` long with a crossfade seam. */
  loop?: boolean;
  play: (v: Voice) => void;
}

const sine = 'sine' as const;
const tri = 'triangle' as const;
const saw = 'sawtooth' as const;
const sq = 'square' as const;

export const SFX_RECIPES: Record<WsAudioSfx, Recipe> = {
  // ---- UI
  click: { sec: 0.2, peak: 0.6, play: (v) => {
    v.tone({ type: tri, pitch: [[0, 1500], [0.05, 900]], t: 0, dur: 0.06, vol: 0.8, attack: 0.002 });
    v.noise({ filter: 'highpass', f0: 3000, t: 0, dur: 0.02, vol: 0.3, attack: 0.001 });
  } },
  select: { sec: 0.4, peak: 0.6, play: (v) => {
    v.tone({ type: tri, pitch: [[0, midiHz(72)]], t: 0, dur: 0.12, vol: 0.7, attack: 0.004 });
    v.tone({ type: tri, pitch: [[0, midiHz(79)]], t: 0.08, dur: 0.22, vol: 0.7, attack: 0.004 });
    v.tone({ type: sine, pitch: [[0, midiHz(91)]], t: 0.08, dur: 0.18, vol: 0.2 });
  } },
  back: { sec: 0.4, peak: 0.55, play: (v) => {
    v.tone({ type: tri, pitch: [[0, midiHz(74)]], t: 0, dur: 0.1, vol: 0.7, attack: 0.004 });
    v.tone({ type: tri, pitch: [[0, midiHz(67)]], t: 0.08, dur: 0.2, vol: 0.7, attack: 0.004 });
  } },
  step: { sec: 0.25, peak: 0.55, play: (v) => {
    v.tone({ type: sine, pitch: [[0, 240], [0.08, 110]], t: 0, dur: 0.1, vol: 0.9, attack: 0.003 });
    v.noise({ filter: 'lowpass', f0: 900, t: 0, dur: 0.05, vol: 0.25, attack: 0.002 });
  } },
  whoosh: { sec: 0.7, peak: 0.55, play: (v) => {
    v.noise({ color: 'pink', filter: 'bandpass', f0: 500, f1: 3200, q: 1.2, t: 0, dur: 0.4, vol: 0.7, attack: 0.15 });
    v.noise({ color: 'pink', filter: 'bandpass', f0: 3200, f1: 700, q: 1.2, t: 0.25, dur: 0.3, vol: 0.4, attack: 0.05 });
  } },
  pop: { sec: 0.25, peak: 0.6, play: (v) => {
    v.tone({ type: sine, pitch: [[0, 320], [0.07, 1000]], t: 0, dur: 0.1, vol: 0.9, attack: 0.002 });
    v.noise({ filter: 'bandpass', f0: 2500, q: 0.8, t: 0, dur: 0.03, vol: 0.3, attack: 0.001 });
  } },
  sparkle: { sec: 1.0, peak: 0.5, play: (v) => {
    [84, 88, 91, 96, 100, 103].forEach((m, i) => chime(v, i * 0.07, m, 0.45, 0.5));
  } },
  buy: { sec: 0.52, peak: 0.5, play: (v) => {
    // A warm two-note coin chime with a tiny bubbly lift.
    v.tone({ type: tri, pitch: [[0, midiHz(76)], [0.07, midiHz(84)]], t: 0, dur: 0.22, vol: 0.6, attack: 0.004 });
    v.tone({ type: sine, pitch: [[0, midiHz(88)], [0.06, midiHz(96)]], t: 0.12, dur: 0.24, vol: 0.28, attack: 0.003 });
    v.tone({ type: sine, pitch: [[0, 760], [0.08, 1120], [0.18, 920]], t: 0.27, dur: 0.16, vol: 0.22, attack: 0.004 });
  } },
  notEnough: { sec: 0.38, peak: 0.38, play: (v) => {
    // Soft, low-volume downward pair: clear feedback without a harsh buzzer.
    v.tone({ type: sine, pitch: [[0, midiHz(69)], [0.08, midiHz(67)]], t: 0, dur: 0.14, vol: 0.58, attack: 0.015 });
    v.tone({ type: tri, pitch: [[0, midiHz(64)]], t: 0.12, dur: 0.14, vol: 0.18, attack: 0.018 });
  } },
  payout: { sec: 0.72, peak: 0.42, play: (v) => {
    // Three gentle counting ticks that rise slightly in pitch and finish with a light ping.
    [0, 0.13, 0.26].forEach((t, i) => {
      const f = midiHz([72, 76, 79][i]);
      v.tone({ type: sine, pitch: [[0, f * 0.72], [0.025, f]], t, dur: 0.075, vol: 0.58, attack: 0.002 });
      v.tone({ type: tri, pitch: [[0, f]], t, dur: 0.06, vol: 0.17, attack: 0.002 });
    });
    v.tone({ type: sine, pitch: [[0, midiHz(84)]], t: 0.42, dur: 0.2, vol: 0.27, attack: 0.004 });
  } },

  // ---- car
  engine: { sec: 1.0, peak: 0.55, loop: true, play: (v) => {
    // 70 Hz x 1 s = whole cycles; 28 Hz putter = whole cycles
    v.tone({ type: saw, pitch: [[0, 70]], t: 0, dur: 1.4, vol: 0.5, attack: 0.001, lp: 420, q: 1.4, trem: [0.55, 28], hold: 1 });
    v.tone({ type: sq, pitch: [[0, 35]], t: 0, dur: 1.4, vol: 0.3, attack: 0.001, lp: 300, hold: 1 });
    v.tone({ type: tri, pitch: [[0, 140]], t: 0, dur: 1.4, vol: 0.15, attack: 0.001, hold: 1 });
  } },
  engineRev: { sec: 1.4, peak: 0.6, play: (v) => {
    v.tone({ type: saw, pitch: [[0, 70], [0.5, 280], [0.8, 200], [1.2, 150]], t: 0, dur: 1.3, vol: 0.55, attack: 0.03, lp: 500, lpEnd: 1600, q: 1.5, trem: [0.4, 30], hold: 0.7 });
    v.tone({ type: sq, pitch: [[0, 35], [0.5, 140], [0.8, 100], [1.2, 75]], t: 0, dur: 1.3, vol: 0.3, attack: 0.03, lp: 600, hold: 0.7 });
  } },
  skid: { sec: 0.9, peak: 0.5, play: (v) => {
    v.noise({ filter: 'bandpass', f0: 2600, f1: 2000, q: 3, t: 0, dur: 0.7, vol: 0.5, attack: 0.05, hold: 0.6 });
    v.tone({ type: sine, pitch: [[0, 1700], [0.35, 1350], [0.7, 1000]], t: 0, dur: 0.7, vol: 0.18, attack: 0.05, vib: [40, 18], hold: 0.6 });
  } },
  splat: { sec: 0.8, peak: 0.7, play: (v) => {
    v.noise({ color: 'brown', filter: 'lowpass', f0: 900, f1: 150, q: 1, t: 0, dur: 0.35, vol: 1.0, attack: 0.005 });
    v.tone({ type: sine, pitch: [[0, 220], [0.18, 60]], t: 0, dur: 0.25, vol: 0.8, attack: 0.004 });
    v.tone({ type: sine, pitch: [[0, 300], [0.08, 700]], t: 0.2, dur: 0.12, vol: 0.4, attack: 0.003 });
    v.tone({ type: sine, pitch: [[0, 250], [0.08, 600]], t: 0.34, dur: 0.12, vol: 0.3, attack: 0.003 });
  } },
  splash: { sec: 1.0, peak: 0.6, play: (v) => {
    v.noise({ filter: 'bandpass', f0: 1800, f1: 700, q: 0.7, t: 0, dur: 0.6, vol: 0.7, attack: 0.03 });
    [[0.05, 500], [0.15, 700], [0.27, 600], [0.4, 850]].forEach(([t, f]) =>
      v.tone({ type: sine, pitch: [[0, f], [0.07, f * 2]], t, dur: 0.1, vol: 0.35, attack: 0.003 }));
  } },
  spin: { sec: 0.5, peak: 0.5, loop: true, play: (v) => {
    // 12 Hz flutter x 0.5 s = 6 whole cycles
    v.noise({ filter: 'bandpass', f0: 1800, q: 1.5, t: 0, dur: 0.8, vol: 0.45, attack: 0.001, trem: [0.7, 12], hold: 1 });
    v.tone({ type: saw, pitch: [[0, 240]], t: 0, dur: 0.8, vol: 0.15, attack: 0.001, lp: 900, trem: [0.6, 12], hold: 1 });
  } },
  boing: { sec: 1.0, peak: 0.65, play: (v) => {
    v.tone({ type: sine, pitch: [[0, 160], [0.04, 700], [0.14, 240], [0.24, 560], [0.36, 280], [0.5, 440], [0.65, 320], [0.8, 360]], t: 0, dur: 0.9, vol: 0.8, attack: 0.004, vib: [60, 14] });
    v.tone({ type: tri, pitch: [[0, 320], [0.04, 1400], [0.14, 480], [0.24, 1120], [0.36, 560], [0.5, 880], [0.65, 640], [0.8, 720]], t: 0, dur: 0.8, vol: 0.2, attack: 0.004 });
  } },
  thud: { sec: 0.5, peak: 0.7, play: (v) => {
    v.tone({ type: sine, pitch: [[0, 130], [0.15, 45]], t: 0, dur: 0.3, vol: 1.0, attack: 0.002 });
    v.noise({ color: 'brown', filter: 'lowpass', f0: 400, t: 0, dur: 0.1, vol: 0.5, attack: 0.002 });
  } },
  honk: { sec: 0.6, peak: 0.55, play: (v) => {
    v.tone({ type: sq, pitch: [[0, 392]], t: 0, dur: 0.14, vol: 0.5, attack: 0.01, lp: 1700, hold: 0.8 });
    v.tone({ type: sq, pitch: [[0, 523]], t: 0.16, dur: 0.24, vol: 0.5, attack: 0.01, lp: 1700, hold: 0.8 });
    v.tone({ type: tri, pitch: [[0, 392]], t: 0, dur: 0.14, vol: 0.4, attack: 0.01, hold: 0.8 });
    v.tone({ type: tri, pitch: [[0, 523]], t: 0.16, dur: 0.24, vol: 0.4, attack: 0.01, hold: 0.8 });
  } },
  crash: { sec: 0.8, peak: 0.65, play: (v) => {
    // soft comic "bonk" (wood-block + tiny spring), nothing violent
    v.tone({ type: sine, pitch: [[0, 520], [0.12, 200]], t: 0, dur: 0.18, vol: 0.9, attack: 0.002 });
    v.tone({ type: tri, pitch: [[0, 880], [0.1, 400]], t: 0, dur: 0.12, vol: 0.4, attack: 0.002 });
    v.tone({ type: sine, pitch: [[0, 300], [0.05, 650], [0.2, 330]], t: 0.14, dur: 0.4, vol: 0.4, attack: 0.004, vib: [80, 12] });
  } },
  quack: { sec: 0.7, peak: 0.6, play: (v) => {
    for (const t of [0, 0.24]) {
      v.tone({ type: saw, pitch: [[0, 430], [0.07, 380], [0.16, 300]], t, dur: 0.18, vol: 0.7, attack: 0.012, lp: 900, lpEnd: 2400, q: 5, trem: [0.4, 55], hold: 0.7 });
    }
  } },

  // ---- dino
  stomp: { sec: 0.9, peak: 0.75, play: (v) => {
    v.tone({ type: sine, pitch: [[0, 100], [0.25, 36]], t: 0, dur: 0.5, vol: 1.0, attack: 0.003 });
    v.noise({ color: 'brown', filter: 'lowpass', f0: 300, f1: 80, t: 0, dur: 0.5, vol: 0.7, attack: 0.004 });
  } },
  roar: { sec: 1.7, peak: 0.65, play: (v) => {
    // big but goofy: a wobbly "RAWR" that ends in a squeaky yodel
    v.tone({ type: saw, pitch: [[0, 130], [0.25, 230], [0.7, 190], [1.0, 105]], t: 0, dur: 1.1, vol: 0.7, attack: 0.08, lp: 600, lpEnd: 1500, q: 3, vib: [50, 6], trem: [0.45, 22], hold: 0.6 });
    v.tone({ type: sq, pitch: [[0, 65], [0.25, 115], [0.7, 95], [1.0, 52]], t: 0, dur: 1.1, vol: 0.3, attack: 0.08, lp: 500, hold: 0.6 });
    v.noise({ color: 'pink', filter: 'bandpass', f0: 900, q: 0.8, t: 0, dur: 1.0, vol: 0.18, attack: 0.1, hold: 0.6 });
    v.tone({ type: tri, pitch: [[0, 220], [0.14, 700]], t: 1.1, dur: 0.22, vol: 0.4, attack: 0.01, vib: [80, 10] });
  } },
  chomp: { sec: 0.7, peak: 0.7, play: (v) => {
    for (const t of [0, 0.2]) {
      v.noise({ filter: 'bandpass', f0: 1800, q: 1.4, t, dur: 0.06, vol: 0.7, attack: 0.002 });
      v.tone({ type: sine, pitch: [[0, 190], [0.08, 80]], t, dur: 0.1, vol: 0.8, attack: 0.002 });
    }
  } },
  gulp: { sec: 0.7, peak: 0.65, play: (v) => {
    v.tone({ type: sine, pitch: [[0, 350], [0.1, 110]], t: 0, dur: 0.14, vol: 0.9, attack: 0.01, lp: 1200 });
    v.tone({ type: sine, pitch: [[0, 300], [0.12, 90]], t: 0.2, dur: 0.18, vol: 0.9, attack: 0.01, lp: 1000 });
    v.noise({ filter: 'lowpass', f0: 500, t: 0.2, dur: 0.1, vol: 0.2, attack: 0.01 });
  } },
  burp: { sec: 0.8, peak: 0.65, play: (v) => {
    v.tone({ type: saw, pitch: [[0, 120], [0.4, 70]], t: 0, dur: 0.5, vol: 0.8, attack: 0.03, lp: 420, q: 2, trem: [0.8, 38], vib: [60, 9], hold: 0.5 });
    v.noise({ color: 'brown', filter: 'lowpass', f0: 300, t: 0, dur: 0.4, vol: 0.2, attack: 0.03 });
  } },
  rustle: { sec: 0.9, peak: 0.5, play: (v) => {
    v.noise({ color: 'pink', filter: 'highpass', f0: 2500, q: 0.7, t: 0, dur: 0.7, vol: 0.5, attack: 0.1, trem: [0.8, 17], hold: 0.5 });
    v.noise({ color: 'white', filter: 'bandpass', f0: 5000, q: 1.5, t: 0.1, dur: 0.5, vol: 0.2, attack: 0.1, trem: [0.9, 23] });
  } },
  flap: { sec: 0.9, peak: 0.6, play: (v) => {
    [0, 0.17, 0.34].forEach((t, i) => {
      v.noise({ color: 'pink', filter: 'lowpass', f0: 500, f1: 1500, q: 0.7, t, dur: 0.14, vol: 0.6 - i * 0.1, attack: 0.04 });
      v.tone({ type: sine, pitch: [[0, 120], [0.1, 70]], t, dur: 0.12, vol: 0.5 - i * 0.1, attack: 0.01 });
    });
  } },
  sniff: { sec: 0.7, peak: 0.5, play: (v) => {
    v.noise({ color: 'pink', filter: 'bandpass', f0: 1200, f1: 2800, q: 1.2, t: 0, dur: 0.15, vol: 0.7, attack: 0.07 });
    v.noise({ color: 'pink', filter: 'bandpass', f0: 1400, f1: 3000, q: 1.2, t: 0.22, dur: 0.18, vol: 0.7, attack: 0.09 });
  } },
  giggle: { sec: 1.0, peak: 0.55, play: (v) => {
    [0, 1, 2, 3, 4, 5].forEach((i) => {
      const f = 520 + (i % 2 === 0 ? 0 : 90) + i * 15;
      v.tone({ type: tri, pitch: [[0, f], [0.06, f * 1.12]], t: i * 0.1, dur: 0.08, vol: 0.7, attack: 0.008, vib: [40, 14] });
    });
  } },
  wobble: { sec: 1.0, peak: 0.55, play: (v) => {
    v.tone({ type: sine, pitch: [[0, 330], [0.8, 220]], t: 0, dur: 0.85, vol: 0.8, attack: 0.03, vib: [450, 7], hold: 0.4 });
    v.tone({ type: tri, pitch: [[0, 660], [0.8, 440]], t: 0, dur: 0.8, vol: 0.15, attack: 0.03, vib: [450, 7], hold: 0.4 });
  } },

  // ---- crowd / feelings
  cheer: { sec: 1.8, peak: 0.6, play: (v) => {
    v.noise({ color: 'pink', filter: 'bandpass', f0: 1400, f1: 2200, q: 0.6, t: 0, dur: 1.3, vol: 0.5, attack: 0.15, trem: [0.4, 9], hold: 0.5 });
    [[72, 0], [76, 0.18], [79, 0.36]].forEach(([m, t]) =>
      v.tone({ type: tri, pitch: [[0, midiHz(m)]], t, dur: 0.5, vol: 0.4, attack: 0.03, vib: [30, 6], hold: 0.6 }));
    v.tone({ type: tri, pitch: [[0, midiHz(84)]], t: 0.54, dur: 0.7, vol: 0.4, attack: 0.03, vib: [30, 6], hold: 0.6 });
    chime(v, 0.54, 96, 0.8, 0.25);
  } },
  sad: { sec: 1.6, peak: 0.55, play: (v) => {
    // comic "awww": a gently sagging, wobbly triangle tone
    v.tone({ type: tri, pitch: [[0, 440], [0.3, 400], [0.7, 300], [1.2, 215]], t: 0, dur: 1.3, vol: 0.7, attack: 0.05, lp: 1800, vib: [60, 5.5], hold: 0.6 });
    v.tone({ type: sine, pitch: [[0, 880], [0.3, 800], [0.7, 600], [1.2, 430]], t: 0, dur: 1.2, vol: 0.12, attack: 0.05, vib: [60, 5.5], hold: 0.6 });
  } },
};

export const STING_RECIPES: Record<WsSting, Recipe> = {
  success: { sec: 3.2, peak: 0.7, play: (v) => {
    const brass = (t: number, m: number, d: number, vol = 0.45): void => {
      v.tone({ type: saw, pitch: [[0, midiHz(m)]], t, dur: d, vol, attack: 0.02, lp: 1400, lpEnd: 3000, q: 0.8, vib: [12, 5.5], hold: 0.85 });
      v.tone({ type: sq, pitch: [[0, midiHz(m)]], t, dur: d, vol: vol * 0.25, attack: 0.02, lp: 1100, hold: 0.85 });
    };
    // da-da-da-DAAA
    brass(0, 67, 0.17); brass(0.18, 67, 0.17); brass(0.36, 67, 0.17);
    [60, 64, 67, 72].forEach((m) => brass(0.56, m, 1.8, 0.3));
    [76, 79].forEach((m) => brass(0.56, m, 1.8, 0.18));
    v.noise({ filter: 'highpass', f0: 6000, t: 0.56, dur: 1.2, vol: 0.22, attack: 0.005 });
    [84, 88, 91, 96].forEach((m, i) => chime(v, 0.75 + i * 0.12, m, 0.9, 0.35));
  } },
  fail: { sec: 3.0, peak: 0.65, play: (v) => {
    // friendly "wah wah wah waaah" with a slide-whistle droop
    [[58, 0], [57, 0.4], [56, 0.8]].forEach(([m, t]) => {
      v.tone({ type: saw, pitch: [[0, midiHz(m)]], t, dur: 0.34, vol: 0.6, attack: 0.03, lp: 450, lpEnd: 1700, q: 3, vib: [15, 6], hold: 0.7 });
    });
    v.tone({ type: saw, pitch: [[0, midiHz(55)], [0.5, midiHz(55)], [1.2, midiHz(43)]], t: 1.25, dur: 1.4, vol: 0.6, attack: 0.04, lp: 500, lpEnd: 1800, q: 3, vib: [25, 6], trem: [0.4, 6], hold: 0.7 });
    v.tone({ type: sine, pitch: [[0, 1400], [0.35, 1700], [0.9, 500]], t: 1.3, dur: 0.9, vol: 0.1, attack: 0.04, vib: [50, 7] });
  } },
  unlock: { sec: 3.0, peak: 0.65, play: (v) => {
    [72, 76, 79, 84, 88, 91, 96, 100].forEach((m, i) => chime(v, i * 0.1, m, 0.8, 0.45));
    [72, 79, 84, 88].forEach((m) => {
      v.tone({ type: sine, pitch: [[0, midiHz(m)]], t: 0.8, dur: 1.9, vol: 0.2, attack: 0.15, vib: [8, 5] });
      v.tone({ type: sine, pitch: [[0, midiHz(m) * 1.004]], t: 0.8, dur: 1.9, vol: 0.15, attack: 0.15 });
    });
    v.noise({ color: 'pink', filter: 'highpass', f0: 5000, t: 0, dur: 0.9, vol: 0.08, attack: 0.3 });
    chime(v, 0.85, 103, 1.4, 0.3);
  } },
};
