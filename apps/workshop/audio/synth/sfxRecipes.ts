/** Offline, mono recipes. Peaks are calibrated against decoded short-window loudness. */
import type { WsSting } from '../../core/runtime';
import type { WsAudioSfx } from '../manifest';
import { chime, midiHz, type Voice } from './voice';
import { bubble, glint, impact, mallet, syllable } from './sfxVoices';

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
  // Tactile controls and short musical rewards.
  click: { sec: 0.17, peak: 0.36, play: (v) => {
    mallet(v, 0, 550, 0.088, 0.75);
    v.noise({ filter: 'bandpass', f0: 1850, t: 0, dur: 0.019, vol: 0.33, attack: 0.001 });
  } },
  select: { sec: 0.32, peak: 0.32, play: (v) => {
    mallet(v, 0, midiHz(74), 0.11, 0.63);
    mallet(v, 0.058, midiHz(81), 0.22, 0.78);
  } },
  back: { sec: 0.29, peak: 0.29, play: (v) => {
    mallet(v, 0, midiHz(76), 0.095, 0.58);
    mallet(v, 0.064, midiHz(71), 0.17, 0.72);
  } },
  equip: { sec: 0.41, peak: 0.33, play: (v) => {
    mallet(v, 0, 340, 0.08, 0.67);
    mallet(v, 0.032, 630, 0.075, 0.4);
    glint(v, 0.079, 79, 0.24, 0.54);
    glint(v, 0.135, 83, 0.23, 0.36);
  } },
  buy: { sec: 0.49, peak: 0.315, play: (v) => {
    glint(v, 0, 76, 0.19, 0.78);
    glint(v, 0.077, 81, 0.25, 0.72);
    glint(v, 0.145, 88, 0.29, 0.45);
    mallet(v, 0.15, midiHz(69), 0.20, 0.25);
  } },
  notEnough: { sec: 0.31, peak: 0.345, play: (v) => {
    mallet(v, 0, midiHz(69), 0.13, 0.52);
    mallet(v, 0.092, midiHz(66), 0.16, 0.67);
    v.tone({ type: sine, pitch: [[0, 330], [0.095, 272]], t: 0.088, dur: 0.17, vol: 0.26, attack: 0.012 });
  } },
  payout: { sec: 0.68, peak: 0.39, play: (v) => {
    glint(v, 0, 74, 0.11, 0.63);
    glint(v, 0.096, 78, 0.11, 0.54);
    glint(v, 0.176, 81, 0.15, 0.65);
    glint(v, 0.30, 86, 0.30, 0.56);
    glint(v, 0.32, 90, 0.25, 0.27);
  } },
  sparkle: { sec: 0.7, peak: 0.32, play: (v) => {
    [81, 85, 88, 93].forEach((m, i) => glint(v, i * 0.049, m, 0.38 - i * 0.018, 0.64 - i * 0.075));
    glint(v, 0.24, 88, 0.33, 0.24);
  } },

  // Shared movement, contact and materials.
  step: { sec: 0.16, peak: 0.355, play: (v) => {
    impact(v, 0, 225, 1250, 0.105, 0.71);
    v.noise({ filter: 'bandpass', f0: 2050, t: 0.016, dur: 0.041, vol: 0.15, attack: 0.004 });
  } },
  whoosh: { sec: 0.42, peak: 0.37, play: (v) => {
    v.noise({ color: 'pink', filter: 'bandpass', f0: 780, f1: 3900, q: 0.75, t: 0, dur: 0.29, vol: 0.77, attack: 0.063, hold: 0.16 });
    v.noise({ filter: 'bandpass', f0: 2200, f1: 650, q: 1.1, t: 0.087, dur: 0.26, vol: 0.42, attack: 0.018 });
    v.tone({ type: sine, pitch: [[0, 290], [0.066, 980], [0.2, 530]], t: 0.039, dur: 0.23, vol: 0.11, attack: 0.04, hold: 0.14 });
  } },
  pop: { sec: 0.19, peak: 0.38, play: (v) => {
    bubble(v, 0, 730, 0.105, 0.77);
    mallet(v, 0.022, 460, 0.085, 0.34);
  } },
  land: { sec: 0.25, peak: 0.42, play: (v) => {
    impact(v, 0, 170, 1450, 0.15, 0.78);
    impact(v, 0.048, 265, 1100, 0.11, 0.36);
  } },
  thud: { sec: 0.23, peak: 0.43, play: (v) => {
    impact(v, 0, 150, 810, 0.16, 0.84);
    mallet(v, 0.012, 290, 0.11, 0.26);
  } },
  splat: { sec: 0.43, peak: 0.37, play: (v) => {
    impact(v, 0, 190, 830, 0.23, 0.67);
    v.noise({ color: 'pink', filter: 'bandpass', f0: 2200, f1: 590, q: 0.8, t: 0.01, dur: 0.23, vol: 0.61, attack: 0.012, hold: 0.14 });
    bubble(v, 0.075, 350, 0.17, 0.54);
    bubble(v, 0.229, 490, 0.13, 0.23);
  } },
  splash: { sec: 0.61, peak: 0.47, play: (v) => {
    impact(v, 0, 265, 2500, 0.13, 0.45);
    v.noise({ filter: 'bandpass', f0: 3250, f1: 1150, q: 0.56, t: 0.006, dur: 0.41, vol: 0.93, attack: 0.021, hold: 0.25 });
    v.noise({ color: 'pink', filter: 'bandpass', f0: 1050, f1: 460, q: 0.78, t: 0.058, dur: 0.30, vol: 0.54, attack: 0.032 });
    bubble(v, 0.112, 570, 0.135, 0.32);
    bubble(v, 0.192, 800, 0.091, 0.22);
    bubble(v, 0.271, 480, 0.14, 0.22);
    bubble(v, 0.392, 990, 0.088, 0.14);
  } },
  boing: { sec: 0.54, peak: 0.3, play: (v) => {
    impact(v, 0, 210, 960, 0.092, 0.46);
    v.tone({ type: tri, pitch: [[0, 230], [0.032, 600], [0.095, 346], [0.15, 487], [0.28, 325], [0.43, 309]],
      t: 0.012, dur: 0.46, vol: 0.74, attack: 0.012, hold: 0.26, vib: [87, 19] });
    v.tone({ type: sine, pitch: [[0, 720], [0.043, 1260], [0.16, 680]], t: 0.013, dur: 0.23, vol: 0.29, attack: 0.008 });
  } },

  // Toy-car motor, tire and prop sounds.
  engine: { sec: 1, peak: 0.25, loop: true, play: (v) => {
    // Integer cycles in one second keep the motor in phase across the seam.
    v.tone({ type: saw, pitch: [[0, 88]], t: 0, dur: 1.4, vol: 0.58, attack: 0.001, lp: 610, q: 0.8, trem: [0.39, 22], hold: 1 });
    v.tone({ type: sine, pitch: [[0, 132]], t: 0, dur: 1.4, vol: 0.29, attack: 0.001, trem: [0.24, 11], hold: 1 });
    v.tone({ type: tri, pitch: [[0, 352]], t: 0, dur: 1.4, vol: 0.17, attack: 0.001, trem: [0.43, 44], hold: 1 });
  } },
  engineRev: { sec: 1.0, peak: 0.385, play: (v) => {
    v.tone({ type: saw, pitch: [[0, 91], [0.1, 102], [0.33, 240], [0.41, 182], [0.63, 279], [0.91, 117]],
      t: 0, dur: 0.92, vol: 0.67, attack: 0.018, lp: 510, lpEnd: 1230, q: 0.7, trem: [0.24, 29], hold: 0.62 });
    v.tone({ type: tri, pitch: [[0, 183], [0.31, 510], [0.43, 362], [0.63, 533], [0.87, 245]],
      t: 0.017, dur: 0.87, vol: 0.27, attack: 0.054, hold: 0.55 });
    v.noise({ color: 'pink', filter: 'bandpass', f0: 480, f1: 1130, q: 0.65, t: 0, dur: 0.83, vol: 0.53, attack: 0.036, hold: 0.57 });
  } },
  skid: { sec: 0.59, peak: 0.42, play: (v) => {
    v.noise({ filter: 'bandpass', f0: 2600, f1: 1070, q: 0.82, t: 0, dur: 0.49, vol: 0.85, attack: 0.027, hold: 0.27 });
    v.tone({ type: tri, pitch: [[0, 1390], [0.11, 1020], [0.23, 1360], [0.39, 660]],
      t: 0.02, dur: 0.40, vol: 0.29, attack: 0.025, vib: [37, 21], trem: [0.45, 16], hold: 0.37 });
    impact(v, 0.33, 176, 1510, 0.12, 0.24);
  } },
  spin: { sec: 0.5, peak: 0.23, loop: true, play: (v) => {
    v.noise({ filter: 'bandpass', f0: 1700, q: 0.84, t: 0, dur: 0.8, vol: 0.62, attack: 0.001, trem: [0.64, 18], hold: 1 });
    v.tone({ type: tri, pitch: [[0, 238]], t: 0, dur: 0.8, vol: 0.42, attack: 0.001, trem: [0.43, 18], hold: 1 });
    v.tone({ type: sine, pitch: [[0, 478]], t: 0, dur: 0.8, vol: 0.17, attack: 0.001, trem: [0.45, 26], hold: 1 });
  } },
  honk: { sec: 0.44, peak: 0.29, play: (v) => {
    syllable(v, { t: 0, dur: 0.12, pitch: [[0, 330], [0.026, 370], [0.10, 351]], mouth: [[580, 680], [1150, 1240]], vol: 0.64, attack: 0.012, roughness: 0.08 });
    syllable(v, { t: 0.149, dur: 0.24, pitch: [[0, 425], [0.031, 466], [0.14, 456], [0.21, 393]], mouth: [[740, 560], [1240, 1080]], vol: 0.78, attack: 0.013, roughness: 0.08 });
  } },
  crash: { sec: 0.39, peak: 0.50, play: (v) => {
    impact(v, 0, 198, 1760, 0.19, 0.85);
    mallet(v, 0.007, 362, 0.12, 0.57);
    mallet(v, 0.064, 486, 0.095, 0.28);
    bubble(v, 0.125, 605, 0.18, 0.39);
    mallet(v, 0.231, 300, 0.083, 0.21);
  } },
  quack: { sec: 0.53, peak: 0.37, play: (v) => {
    syllable(v, { t: 0, dur: 0.19, pitch: [[0, 370], [0.025, 499], [0.078, 400], [0.16, 265]],
      mouth: [[1040, 670], [2040, 1420]], vol: 0.74, attack: 0.011, roughness: 0.31 });
    syllable(v, { t: 0.212, dur: 0.25, pitch: [[0, 388], [0.028, 466], [0.10, 350], [0.205, 246]],
      mouth: [[985, 540], [1920, 1230]], vol: 0.66, attack: 0.012, roughness: 0.32 });
  } },

  // Character voices and foley. Gesture and vowel changes carry the joke.
  stomp: { sec: 0.41, peak: 0.44, play: (v) => {
    impact(v, 0, 138, 840, 0.24, 0.88);
    impact(v, 0.023, 189, 1560, 0.14, 0.48);
    v.noise({ color: 'pink', filter: 'bandpass', f0: 1030, f1: 430, q: 0.8, t: 0.057, dur: 0.23, vol: 0.25, attack: 0.016, trem: [0.42, 22] });
  } },
  roar: { sec: 0.95, peak: 0.39, play: (v) => {
    syllable(v, { t: 0, dur: 0.60, pitch: [[0, 175], [0.075, 245], [0.17, 326], [0.28, 284], [0.51, 206]],
      mouth: [[480, 720], [960, 1330]], vol: 0.87, attack: 0.039, roughness: 0.22 });
    syllable(v, { t: 0.52, dur: 0.34, pitch: [[0, 233], [0.06, 415], [0.10, 490], [0.27, 348]],
      mouth: [[640, 454], [1440, 1810]], vol: 0.63, attack: 0.023 });
  } },
  chomp: { sec: 0.31, peak: 0.52, play: (v) => {
    impact(v, 0, 215, 2360, 0.10, 0.73);
    v.noise({ filter: 'bandpass', f0: 2700, f1: 1080, q: 0.96, t: 0.009, dur: 0.08, vol: 0.86, attack: 0.004 });
    mallet(v, 0.072, 432, 0.09, 0.28);
    impact(v, 0.123, 267, 1800, 0.105, 0.49);
  } },
  gulp: { sec: 0.40, peak: 0.37, play: (v) => {
    syllable(v, { t: 0, dur: 0.22, pitch: [[0, 250], [0.033, 392], [0.085, 181], [0.18, 133]],
      mouth: [[830, 351], [1550, 820]], vol: 0.72, attack: 0.013 });
    bubble(v, 0.09, 420, 0.16, 0.46);
    bubble(v, 0.203, 294, 0.13, 0.30);
  } },
  burp: { sec: 0.56, peak: 0.44, play: (v) => {
    syllable(v, { t: 0, dur: 0.42, pitch: [[0, 167], [0.046, 244], [0.104, 208], [0.244, 146], [0.38, 103]],
      mouth: [[910, 420], [1650, 1050]], vol: 0.83, attack: 0.023, roughness: 0.54 });
    bubble(v, 0.32, 410, 0.15, 0.18);
  } },
  rustle: { sec: 0.40, peak: 0.49, play: (v) => {
    [0, 0.065, 0.147, 0.227].forEach((t, i) => {
      v.noise({ filter: 'bandpass', f0: [2250, 1740, 2650, 1510][i], f1: 1020, q: 0.75,
        t, dur: 0.11, vol: 0.7 - i * 0.1, attack: 0.009, hold: 0.12 });
    });
    v.noise({ color: 'pink', filter: 'bandpass', f0: 1100, f1: 570, q: 0.9, t: 0, dur: 0.28, vol: 0.44, attack: 0.015, trem: [0.54, 24], hold: 0.35 });
  } },
  flap: { sec: 0.33, peak: 0.39, play: (v) => {
    for (const [t, vol] of [[0, 0.80], [0.117, 0.63]]) {
      v.noise({ color: 'pink', filter: 'bandpass', f0: 840, f1: 2350, q: 0.65,
        t, dur: 0.15, vol, attack: 0.02, hold: 0.16 });
      v.tone({ type: sine, pitch: [[0, 260], [0.075, 117]], t, dur: 0.105, vol: vol * 0.25, attack: 0.016 });
    }
  } },
  sniff: { sec: 0.40, peak: 0.42, play: (v) => {
    v.noise({ filter: 'bandpass', f0: 1150, f1: 2550, q: 1.2, t: 0, dur: 0.099, vol: 0.75, attack: 0.021, hold: 0.21 });
    v.noise({ filter: 'bandpass', f0: 1430, f1: 3200, q: 1.15, t: 0.134, dur: 0.128, vol: 0.89, attack: 0.033, hold: 0.27 });
    v.tone({ type: sine, pitch: [[0, 320], [0.092, 530]], t: 0.15, dur: 0.13, vol: 0.13, attack: 0.025 });
  } },
  giggle: { sec: 0.64, peak: 0.27, play: (v) => {
    [459, 564, 510, 370].forEach((hz, i) => {
      syllable(v, { t: i * 0.104, dur: i === 3 ? 0.23 : 0.14,
        pitch: [[0, hz * 0.82], [0.033, hz], [0.10, hz * 0.83]],
        mouth: [[699, 530], [1750, 2060]], vol: 0.72 - i * 0.085, attack: 0.015, roughness: 0.14 });
    });
  } },
  wobble: { sec: 0.58, peak: 0.25, play: (v) => {
    v.tone({ type: tri, pitch: [[0, 436], [0.058, 315], [0.12, 513], [0.18, 278], [0.25, 399], [0.36, 247], [0.49, 278]],
      t: 0, dur: 0.51, vol: 0.77, attack: 0.014, vib: [95, 12], hold: 0.32 });
    v.tone({ type: sine, pitch: [[0, 680], [0.12, 1030], [0.32, 530]],
      t: 0.014, dur: 0.38, vol: 0.21, attack: 0.018, trem: [0.55, 13], hold: 0.24 });
    bubble(v, 0.36, 380, 0.14, 0.22);
  } },
  cheer: { sec: 0.90, peak: 0.33, play: (v) => {
    syllable(v, { t: 0, dur: 0.51, pitch: [[0, 375], [0.061, 552], [0.20, 640], [0.43, 555]],
      mouth: [[750, 451], [1400, 2290]], vol: 0.71, attack: 0.037 });
    syllable(v, { t: 0.10, dur: 0.59, pitch: [[0, 293], [0.09, 390], [0.22, 465], [0.54, 397]],
      mouth: [[670, 320], [1160, 973]], vol: 0.60, attack: 0.027 });
    [0.041, 0.19, 0.349, 0.46].forEach((t, i) =>
      v.noise({ filter: 'bandpass', f0: 1500 + i * 240, q: 0.8, t, dur: 0.081, vol: 0.32, attack: 0.003 }));
    glint(v, 0.46, 88, 0.29, 0.28);
  } },
  sad: { sec: 0.70, peak: 0.28, play: (v) => {
    syllable(v, { t: 0, dur: 0.57, pitch: [[0, 356], [0.092, 369], [0.227, 306], [0.48, 221]],
      mouth: [[750, 330], [1390, 810]], vol: 0.80, attack: 0.052, roughness: 0.08 });
    v.tone({ type: sine, pitch: [[0, 489], [0.09, 371], [0.25, 293]],
      t: 0.26, dur: 0.29, vol: 0.14, attack: 0.035, vib: [51, 7] });
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
