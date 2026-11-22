/**
 * Pure (Tone-free) compositions for the three music loops. Each builder returns note events in beats;
 * `music.ts` turns them into sound. All tracks are 4/4, whole bars, and loop seamlessly (the last chord leads back to the first).
 */
import type { WsMusic } from '../../core/runtime';

export type Inst =
  | 'kick' | 'snare' | 'hat' | 'openHat' | 'clap' | 'rim' | 'shaker'
  | 'bass' | 'subBass' | 'pizz' | 'guitar' | 'pluck' | 'lead' | 'whistle' | 'marimba' | 'bubble' | 'bell' | 'pad';

export interface NoteEvent { inst: Inst; t: number; d: number; p: number; v: number }
export interface Score { name: WsMusic; bpm: number; bars: number; events: NoteEvent[] }

interface Chord { r: number; q: 'maj' | 'min' }
/** Melody note: [beat within the section, midi, duration in beats]. */
type Mel = readonly [number, number, number];

const C = (r: number, q: 'maj' | 'min' = 'maj'): Chord => ({ r, q });
const tones = (c: Chord, oct = 0): number[] => [c.r + oct, c.r + (c.q === 'maj' ? 4 : 3) + oct, c.r + 7 + oct];

interface Section { chords: Chord[]; lead?: readonly Mel[] }

class Builder {
  readonly events: NoteEvent[] = [];
  add(inst: Inst, t: number, d: number, p: number, v: number): void {
    this.events.push({ inst, t, d, p, v });
  }
}

/** Walks every bar of every section: cb(builder, chord, barStartBeat, barIndexInSection, sectionIndex). */
function eachBar(sections: Section[], cb: (c: Chord, t0: number, b: number, s: number) => void): void {
  sections.forEach((sec, s) => sec.chords.forEach((c, b) => cb(c, (s * 4 + b) * 4, b, s)));
}

function addLead(b: Builder, sections: Section[], inst: Inst, vel: number, fromSection: number): void {
  sections.forEach((sec, s) => {
    if (!sec.lead || s < fromSection) return;
    for (const [t, p, d] of sec.lead) b.add(inst, s * 16 + t, d * 0.9, p, vel);
  });
}

// ---------------------------------------------------------------------------------------------- Race Shop

const RS_A_LEAD: Mel[] = [
  [0, 76, 0.75], [1, 79, 0.5], [1.5, 76, 0.5], [2, 72, 0.75], [3, 74, 0.5], [3.5, 76, 0.5],
  [4, 74, 0.75], [5, 71, 0.5], [5.5, 74, 0.5], [6, 79, 1], [7, 74, 1],
  [8, 72, 0.75], [9, 76, 0.5], [9.5, 81, 0.5], [10, 79, 0.75], [11, 76, 0.5], [11.5, 72, 0.5],
  [12, 77, 0.75], [13, 76, 0.5], [13.5, 74, 0.5], [14, 72, 1.5],
];
const RS_B_LEAD: Mel[] = [
  [0, 81, 0.75], [1, 79, 0.5], [1.5, 77, 0.5], [2, 81, 1], [3, 79, 1],
  [4, 79, 0.75], [5, 77, 0.5], [5.5, 74, 0.5], [6, 79, 1], [7, 83, 1],
  [8, 84, 0.75], [9, 79, 0.5], [9.5, 76, 0.5], [10, 79, 0.75], [11, 76, 0.5], [11.5, 72, 0.5],
  [12, 76, 0.75], [13, 74, 0.5], [13.5, 72, 0.5], [14, 69, 1.75],
];
const RS_B2_LEAD: Mel[] = [
  ...RS_B_LEAD.slice(0, 10),
  [8, 81, 0.75], [9, 79, 0.5], [9.5, 76, 0.5], [10, 72, 1.5],
  [12, 74, 0.5], [12.5, 74, 0.5], [13, 79, 0.5], [13.5, 77, 0.5], [14, 74, 1.75],
];

function raceShop(): Score {
  const A = [C(48), C(55), C(57, 'min'), C(53)];
  const sections: Section[] = [
    { chords: A },
    { chords: A, lead: RS_A_LEAD },
    { chords: [C(53), C(55), C(48), C(57, 'min')], lead: RS_B_LEAD },
    { chords: A, lead: RS_A_LEAD },
    { chords: [C(53), C(55), C(57, 'min'), C(55)], lead: RS_B2_LEAD },
  ];
  const b = new Builder();
  eachBar(sections, (c, t0, bar, s) => {
    const last = bar === 3;
    for (const st of [0, 4, 8, 12]) b.add('kick', t0 + st / 4, 0.2, 40, 0.9);
    if (last && s % 2 === 1) b.add('kick', t0 + 10 / 4, 0.2, 40, 0.7);
    for (let st = 0; st < 16; st += 2) b.add('hat', t0 + st / 4, 0.1, 80, st % 4 === 0 ? 0.5 : 0.32);
    b.add('openHat', t0 + 14 / 4, 0.2, 80, 0.4);
    if (s >= 1) for (const st of [4, 12]) b.add('clap', t0 + st / 4, 0.15, 70, 0.8);
    if (last && s >= 1) for (let i = 0; i < 4; i++) b.add('snare', t0 + (12 + i) / 4, 0.1, 70, 0.5 + i * 0.12);
    for (let i = 0; i < 8; i++) b.add('bass', t0 + i * 0.5, 0.4, c.r - 12 + (i % 4 === 3 ? 12 : 0), 0.85);
    if (s === 0) tones(c, 12).forEach((p) => b.add('pad', t0, 3.8, p, 0.35));
    else for (const st of [2, 6, 10, 14]) tones(c, 12).forEach((p) => b.add('guitar', t0 + st / 4, 0.2, p, 0.42));
  });
  addLead(b, sections, 'lead', 0.7, 1);
  return { name: 'raceShop', bpm: 128, bars: 20, events: b.events };
}

// ---------------------------------------------------------------------------------------------- Dino Lab

const DL_A_LEAD: Mel[] = [
  [0, 81, 0.5], [1, 84, 0.5], [1.5, 88, 0.5], [2, 84, 0.5], [3, 81, 0.5], [3.5, 76, 0.5],
  [4, 77, 0.5], [5, 81, 0.5], [5.5, 84, 0.5], [6, 81, 0.5], [7, 77, 0.5], [7.5, 72, 0.5],
  [8, 79, 0.5], [9, 84, 0.5], [9.5, 88, 0.5], [10, 84, 0.5], [11, 79, 0.5], [11.5, 76, 0.5],
  [12, 80, 0.5], [13, 83, 0.5], [13.5, 88, 0.5], [14, 86, 0.5], [14.5, 83, 0.5], [15, 80, 0.5],
];
const DL_B_LEAD: Mel[] = [
  [0, 84, 0.75], [1, 81, 0.5], [1.5, 84, 0.5], [2, 89, 1], [3, 88, 0.5], [3.5, 84, 0.5],
  [4, 88, 0.75], [5, 84, 0.5], [5.5, 79, 0.5], [6, 84, 1.5],
  [8, 83, 0.75], [9, 79, 0.5], [9.5, 83, 0.5], [10, 86, 1], [11, 83, 0.5], [11.5, 79, 0.5],
  [12, 81, 0.5], [12.5, 84, 0.5], [13, 88, 0.5], [14, 81, 2],
];

function dinoLab(): Score {
  const A = [C(57, 'min'), C(53), C(48), C(52)];
  const sections: Section[] = [
    { chords: A },
    { chords: A, lead: DL_A_LEAD },
    { chords: [C(53), C(48), C(55), C(57, 'min')], lead: DL_B_LEAD },
    { chords: A, lead: DL_A_LEAD },
  ];
  const b = new Builder();
  eachBar(sections, (c, t0, bar, s) => {
    for (const st of [0, 8]) b.add('kick', t0 + st / 4, 0.2, 40, 0.7);
    for (const st of [4, 12]) b.add('rim', t0 + st / 4, 0.1, 80, s === 0 ? 0.35 : 0.5);
    for (const st of [2, 6, 10, 14]) b.add('shaker', t0 + st / 4, 0.08, 80, 0.4);
    if (s >= 2 && bar % 2 === 1) b.add('clap', t0 + 3.5, 0.15, 70, 0.5);
    for (const [st, off] of [[0, 0], [6, 7], [8, 0], [14, 12]] as const) b.add('pizz', t0 + st / 4, 0.3, c.r - 12 + off, 0.85);
    const tn = tones(c, 12);
    const arp = [0, 1, 2, 1, 0, 1, 2, 1];
    arp.forEach((idx, i) => b.add('marimba', t0 + i * 0.5, 0.3, idx === 3 ? tn[0] + 12 : tn[idx], 0.5));
    tones(c, 0).forEach((p) => b.add('pad', t0, 3.8, p, 0.28));
    if (s >= 1) {
      const hi = tones(c, 24);
      [3, 7, 10, 15].forEach((st, i) => b.add('bubble', t0 + st / 4, 0.15, hi[(bar + i) % 3] + (i === 3 ? 12 : 0), 0.4));
    }
  });
  addLead(b, sections, 'lead', 0.55, 1);
  return { name: 'dinoLab', bpm: 108, bars: 16, events: b.events };
}

// ---------------------------------------------------------------------------------------------- Title

const TI_A_LEAD: Mel[] = [
  [0, 79, 1], [1, 83, 0.5], [1.5, 86, 0.5], [2, 83, 1], [3, 79, 1],
  [4, 78, 1], [5, 81, 0.5], [5.5, 86, 0.5], [6, 81, 1.5],
  [8, 79, 0.75], [9, 83, 0.5], [9.5, 86, 0.5], [10, 88, 1], [11, 86, 1],
  [12, 84, 1], [13, 79, 0.5], [13.5, 84, 0.5], [14, 83, 1.75],
];
const TI_B_LEAD: Mel[] = [
  [0, 88, 1], [1, 86, 0.5], [1.5, 84, 0.5], [2, 86, 1], [3, 84, 1],
  [4, 81, 1], [5, 86, 0.5], [5.5, 90, 0.5], [6, 88, 1], [7, 86, 1],
  [8, 88, 0.75], [9, 86, 0.5], [9.5, 83, 0.5], [10, 79, 1.5],
  [12, 81, 0.5], [12.5, 83, 0.5], [13, 86, 1], [14, 83, 1.75],
];

function title(): Score {
  const A = [C(55), C(50), C(52, 'min'), C(48)];
  const sections: Section[] = [
    { chords: A, lead: TI_A_LEAD },
    { chords: A, lead: TI_A_LEAD },
    { chords: [C(48), C(50), C(52, 'min'), C(50)], lead: TI_B_LEAD },
    { chords: A, lead: TI_A_LEAD },
  ];
  const b = new Builder();
  eachBar(sections, (c, t0, bar, s) => {
    if (s >= 1) for (const st of [0, 8]) b.add('kick', t0 + st / 4, 0.2, 40, 0.5);
    if (s >= 2) for (const st of [4, 12]) b.add('clap', t0 + st / 4, 0.15, 70, 0.45);
    for (const st of [2, 6, 10, 14]) b.add('shaker', t0 + st / 4, 0.08, 80, s >= 1 ? 0.4 : 0.25);
    for (const [st, off] of [[0, 0], [6, 0], [8, 7], [12, 0]] as const) b.add('subBass', t0 + st / 4, 0.6, c.r - 12 + off, 0.9);
    const tn = tones(c, 12);
    [0, 1, 2, 1, 0, 1, 2, 1].forEach((idx, i) => b.add('pluck', t0 + i * 0.5, 0.4, tn[idx], 0.5));
    tones(c, 0).forEach((p) => b.add('pad', t0, 3.9, p, 0.3));
    if (s >= 2) {
      b.add('bell', t0, 1.5, tn[2] + 12, 0.35);
      b.add('bell', t0 + 2.5, 1.2, tn[1] + 24 - (bar % 2) * 12, 0.3);
    }
  });
  addLead(b, sections, 'whistle', 0.6, 0);
  return { name: 'title', bpm: 100, bars: 16, events: b.events };
}

export const SCORES: Record<WsMusic, () => Score> = { raceShop, dinoLab, title };

export const loopBeats = (s: Score): number => s.bars * 4;
export const loopSeconds = (s: Score): number => (loopBeats(s) * 60) / s.bpm;
