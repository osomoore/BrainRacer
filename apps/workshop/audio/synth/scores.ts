/** Original Workshop cues. All note positions and gates are in beats, including the stings. */
import type { WsMusic, WsSting } from '../../core/runtime';

export type Inst = 'kick' | 'brush' | 'shaker' | 'block' | 'tom'
  | 'bass' | 'pizz' | 'keys' | 'guitar' | 'reed' | 'drive' | 'mallet' | 'glass' | 'strings';

export interface NoteEvent { inst: Inst; t: number; d: number; p: number; v: number }
export interface Cue { bpm: number; events: NoteEvent[] }
export interface Score extends Cue { name: WsMusic; bars: number }

/** [Beat within a measure, MIDI pitch, gate, optional accent multiplier]. */
type Note = readonly [number, number, number, number?];
/** Bass note and a close voicing above it. Slash chords specify the bass directly. */
type Harmony = readonly [number, ...number[]];
type Hit = readonly [number, number];

class Builder {
  readonly events: NoteEvent[] = [];

  note(inst: Inst, t: number, d: number, p: number, v: number): void {
    this.events.push({ inst, t, d, p, v });
  }

  phrase(inst: Inst, t: number, notes: readonly Note[], v: number): void {
    for (const [beat, pitch, gate, accent = 1] of notes) this.note(inst, t + beat, gate, pitch, v * accent);
  }

  chord(inst: Inst, t: number, pitches: readonly number[], d: number, v: number, spread = 0): void {
    pitches.forEach((p, i) => this.note(inst, t + i * spread, d, p, v));
  }

  drums(inst: Inst, t: number, hits: readonly Hit[], pitch = 48): void {
    for (const [beat, velocity] of hits) this.note(inst, t + beat, 0.12, pitch, velocity);
  }

  score(name: WsMusic, bpm: number, bars: number): Score {
    return { name, bpm, bars, events: this.events };
  }
}

// Open for Business. The same dotted pickup gets three different answers. The middle
// eight beats hand the tune to the lower register before the little mallet reprise.
const TITLE_HARMONY: readonly Harmony[] = [
  [43, 59, 62, 66, 69], [42, 57, 62, 64, 69], [40, 55, 59, 62, 66], [48, 55, 59, 64, 67],
  [43, 57, 59, 62, 67], [47, 57, 62, 65, 67], [48, 55, 59, 64, 67], [48, 56, 60, 63, 67],
  [45, 55, 60, 64, 69], [47, 57, 63, 66], [40, 55, 59, 62, 66], [50, 57, 60, 64, 66],
  [43, 59, 62, 66, 69], [42, 57, 62, 64, 69], [48, 55, 59, 64, 67], [50, 57, 60, 64, 66],
];
const TITLE_CALL: readonly Note[] = [[0, 67, .44], [.75, 71, .2, .86], [1, 69, .9], [2.56, 74, .4], [3.12, 71, .62]];
const TITLE_TUNE: readonly Note[][] = [
  [...TITLE_CALL], [[.56, 69, .32], [1.12, 66, .75], [2.56, 64, .42], [3.12, 66, .52]],
  [[0, 67, .5], [.75, 71, .2, .86], [1, 76, 1.15], [2.56, 74, .38], [3.12, 71, .65]],
  [[0, 72, 1.4], [2, 67, .82]],
  [...TITLE_CALL], [[0, 77, .9], [1.56, 74, .37], [2.12, 71, .75], [3.56, 74, .32, .8]],
  [[0, 76, .72], [1, 79, .52], [2, 76, .76]], [[.56, 75, .42], [1.12, 72, 1.46], [3.12, 67, .6]],
  [[0, 69, .5], [.75, 72, .2], [1, 76, 1.25], [3, 72, .65]], [[0, 75, .92], [1.56, 71, .4], [2.12, 69, 1]],
  [[0, 67, .75], [1, 71, .75], [2.56, 66, .8]], [[0, 64, .78], [1.56, 66, .42], [2.12, 69, 1.4]],
  [...TITLE_CALL], [[.56, 69, .38], [1.12, 74, .75], [2.56, 76, .38], [3.12, 78, .61]],
  [[0, 79, .85], [1.56, 76, .42], [2.12, 74, 1.12]], [[0, 72, .74], [1, 69, 1.15], [3.12, 66, .54]],
];

function title(): Score {
  const b = new Builder();
  TITLE_HARMONY.forEach(([root, ...voicing], i) => {
    const t = i * 4;
    const bridge = i >= 8 && i < 12;
    b.phrase(bridge ? 'mallet' : 'reed', t, TITLE_TUNE[i], bridge ? .76 : .84);
    b.phrase('bass', t, [[0, root, 1.36], [2, root + 12, .62, .76], [3.56, root, .32, .68]], .73);
    b.chord('keys', t + .04, voicing, 1.22, .60, .012);
    b.chord('keys', t + (bridge ? 2 : 2.56), voicing, .64, .46, .012);
    if (!bridge) {
      b.drums('kick', t, [[0, .58], [2.5, .32]]);
      b.drums('brush', t, [[1.02, .42], [3.02, .51]]);
    }
    b.drums('shaker', t, [[.56, .34], [1.56, .24], [2.56, .43], [3.56, .26]]);
    if (i === 3 || i === 7 || i === 15) b.note('glass', t + 2.56, .7, voicing[1] + 24, .32);
    if (i >= 12) b.phrase('mallet', t, TITLE_TUNE[i].slice(0, 2), .36);
  });
  return b.score('title', 106, TITLE_HARMONY.length);
}

// Socket Shuffle. The bass and damped offbeats carry a garage funk pocket while the
// short lead calls and chord replies trade space. G minor and C natural give it color.
const SHOP_HARMONY: readonly Harmony[] = [
  [38, 60, 64, 66, 69], [38, 60, 64, 66, 69], [43, 59, 62, 64, 69], [45, 55, 59, 61, 66],
  [38, 60, 64, 66, 69], [36, 58, 62, 64, 67], [43, 58, 62, 64, 67], [45, 55, 59, 61, 66],
  [47, 57, 61, 62, 66], [42, 57, 61, 64, 66], [43, 57, 59, 62, 66], [45, 55, 62, 64, 69],
  [38, 60, 64, 66, 69], [38, 60, 64, 66, 69], [43, 58, 62, 64, 67], [45, 55, 61, 64, 66],
];
const SHOP_CALL: readonly Note[] = [[.25, 66, .22], [.75, 69, .2], [1, 72, .62], [2.25, 69, .24, .8], [2.75, 76, .65]];
const SHOP_TUNE: readonly (readonly Note[])[] = [
  SHOP_CALL, [[0, 74, .48], [1.25, 72, .22], [1.75, 69, .75]],
  [[.25, 71, .22], [.75, 74, .2], [1, 76, .6], [2.75, 69, .64]], [[.5, 71, .23], [1, 73, .72], [2.5, 66, .6]],
  SHOP_CALL, [[.25, 72, .2], [.75, 70, .2], [1, 67, .58], [2.75, 76, .64]],
  [[0, 74, .55], [1, 70, .55], [2.75, 67, .72]], [[1.25, 69, .32], [1.75, 71, .21], [2, 73, 1.22]],
  [[0, 74, 1.12], [1.75, 73, .68], [3, 69, .55]], [[.5, 68, .45], [1.5, 69, .47], [2.75, 73, .66]],
  [[0, 71, .44], [.75, 74, .2], [1, 78, 1.02], [2.75, 76, .66]], [[0, 74, .52], [1.25, 71, .23], [1.75, 69, .84]],
  SHOP_CALL, [[0, 78, .42], [.75, 76, .24], [1.25, 74, .34], [2, 72, .88]],
  [[.25, 70, .2], [.75, 74, .2], [1, 79, .88], [2.75, 76, .78]], [[0, 73, .7], [1.25, 71, .24], [1.75, 69, .93]],
];

function raceShop(): Score {
  const b = new Builder();
  SHOP_HARMONY.forEach(([root, ...voicing], i) => {
    const t = i * 4;
    const bridge = i >= 8 && i < 12;
    b.phrase(bridge ? 'keys' : 'reed', t, SHOP_TUNE[i], bridge ? .84 : .74);
    b.phrase('bass', t, [
      [0, root, .63], [.75, root + 12, .21, .7], [1.5, root + 7, .35, .86],
      [2.25, root, .53], [3.25, root + (i < 12 ? 12 : 7), .28, .74],
    ], .88);
    const chops = bridge ? [1.5, 3.5] : [.5, 1.75, 2.5, 3.5];
    chops.forEach((beat, j) => b.chord('guitar', t + beat, voicing, .15, j % 2 ? .47 : .60, .012));
    b.drums('kick', t, [[0, .74], [2.25, .61]]);
    b.drums('brush', t, [[1.025, .62], [3.025, .72]]);
    b.drums('shaker', t, [[.5, .37], [1.5, .25], [2.5, .41], [3.5, .28]]);
    if (i % 4 === 3) b.phrase('keys', t, [[3, voicing[1], .28], [3.5, voicing[2], .3]], .54);
  });
  return b.score('raceShop', 112, SHOP_HARMONY.length);
}

// Hatchery Hours. Triplet subdivisions give the mallets a lilting, slow exploration
// pulse. A raised fourth peeks out in the reply, and the last F minor turns back to C.
const LAB_HARMONY: readonly Harmony[] = [
  [48, 55, 59, 64, 67], [43, 57, 59, 62, 67], [45, 55, 59, 60, 64], [42, 57, 60, 62, 66],
  [41, 57, 60, 64, 67], [40, 55, 59, 64, 67], [38, 53, 57, 60, 64], [43, 53, 57, 60, 64],
  [48, 55, 59, 64, 67], [47, 55, 59, 62, 67], [46, 55, 60, 64, 67], [45, 54, 60, 62, 66],
  [41, 57, 60, 64, 67], [40, 55, 59, 64, 67], [38, 53, 57, 60, 64], [41, 56, 60, 62, 67],
];
const LILT = 2 / 3;
const LAB_CALL: readonly Note[] = [[0, 72, .44], [LILT, 76, .24], [1, 79, .85], [2 + LILT, 76, .24], [3, 74, .7]];
const LAB_TUNE: readonly (readonly Note[])[] = [
  LAB_CALL, [[0, 71, .64], [1 + LILT, 74, .26], [2, 67, 1.18]],
  [[0, 72, .44], [LILT, 76, .24], [1, 81, .9], [2 + LILT, 79, .25], [3, 76, .62]],
  [[0, 78, .68], [1, 74, .6], [2 + LILT, 72, .26], [3, 69, .64]],
  [[0, 72, .58], [1, 76, 1.16], [3 + LILT, 77, .24]], [[0, 79, .82], [1 + LILT, 76, .23], [2, 71, 1.22]],
  [[0, 69, .55], [1, 72, .6], [2, 77, .72], [3, 76, .6]], [[0, 74, .58], [1 + LILT, 72, .26], [2, 69, 1.15]],
  [[0, 76, 1.22], [2, 79, .52], [3, 83, .68]], [[0, 81, .57], [1 + LILT, 79, .25], [2, 74, 1.26]],
  [[0, 76, .52], [LILT, 79, .24], [1, 84, 1.2], [3, 79, .58]],
  [[0, 78, .72], [1 + LILT, 76, .24], [2, 74, .58], [3, 72, .6]],
  LAB_CALL, [[0, 71, .68], [1 + LILT, 74, .24], [2, 76, 1.3]],
  [[0, 77, .58], [1, 81, .61], [2 + LILT, 79, .24], [3, 77, .58]],
  [[0, 75, .71], [1 + LILT, 72, .23], [2, 69, .8], [3 + LILT, 67, .25]],
];

function dinoLab(): Score {
  const b = new Builder();
  LAB_HARMONY.forEach(([root, ...voicing], i) => {
    const t = i * 4;
    const bridge = i >= 8 && i < 12;
    b.phrase(bridge ? 'reed' : 'mallet', t, LAB_TUNE[i], bridge ? .63 : .83);
    b.phrase('pizz', t, [[0, root, .73], [2, root + 12, .55, .77], [3 + LILT, root + 7, .26, .52]], .74);
    b.chord('keys', t + LILT, voicing, 1.1, .47, .019);
    b.chord('keys', t + 2 + LILT, voicing.slice(1), .67, .36, .019);
    b.drums('brush', t, [[1.03, .33], [3.03, .39]]);
    if (i % 2 === 0) b.drums('block', t, [[1 + LILT, .35], [3 + LILT, .25]], 77);
    if (i % 4 === 1 || i === 15) b.note('glass', t + 3, .82, voicing[2] + 24, .31);
    if (bridge) b.chord('strings', t, voicing.slice(0, 3), 3.2, .42);
  });
  return b.score('dinoLab', 96, LAB_HARMONY.length);
}

// Green Flag. A clipped three-note pickup lands on a longer note. It survives a
// chord change and a halftime break; the full groove only plays under the refrains.
const RACE_HARMONY: readonly Harmony[] = [
  [40, 59, 64, 68, 71], [40, 59, 63, 66, 71], [45, 57, 61, 64, 68], [47, 57, 61, 63, 66],
  [40, 59, 64, 68, 71], [44, 59, 63, 66, 71], [45, 57, 61, 64, 68], [47, 57, 61, 63, 66],
  [49, 56, 59, 64, 68], [47, 56, 59, 64, 68], [45, 57, 61, 64, 68], [42, 57, 61, 64, 69],
  [45, 59, 61, 64, 68], [44, 59, 64, 68], [42, 57, 61, 64, 69], [47, 57, 61, 63, 66],
  [40, 59, 64, 68, 71], [40, 59, 63, 66, 71], [45, 57, 61, 64, 68], [47, 57, 61, 63, 66],
];
const RACE_CALL: readonly Note[] = [[.5, 71, .2], [.75, 73, .2], [1, 76, .84], [2.25, 68, .24], [2.75, 71, .82]];
const RACE_TUNE: readonly (readonly Note[])[] = [
  RACE_CALL, [[0, 78, .67], [1, 75, .42], [2, 71, 1.08]],
  [[.5, 73, .2], [.75, 76, .2], [1, 81, .8], [2.25, 80, .24], [2.75, 76, .86]],
  [[0, 75, .45], [.75, 73, .23], [1.25, 71, .95], [3.5, 66, .33]],
  RACE_CALL, [[0, 78, .7], [1, 80, .37], [2, 83, 1.12]],
  [[.5, 81, .22], [.75, 80, .2], [1, 76, .8], [2.25, 73, .24], [2.75, 71, .9]], [[1, 75, .5], [2, 73, .58], [3, 66, .65]],
  [[0, 73, 1.42], [2, 76, .63], [3, 80, .66]], [[.5, 78, .36], [1.25, 76, 1.18], [3, 71, .55]],
  [[0, 73, .66], [1, 69, .54], [2, 76, 1.52]], [[.5, 78, .58], [1.5, 76, .6], [2.5, 73, .99]],
  [[0, 76, .44], [.75, 80, .22], [1, 83, 1.3]], [[.5, 80, .48], [1.5, 76, 1.03]],
  [[0, 73, .52], [1, 76, .56], [2, 69, 1.25]], [[0, 71, .55], [1, 73, .55], [2, 75, .6], [3, 78, .55]],
  RACE_CALL, [[0, 78, .54], [.75, 80, .23], [1.25, 83, 1.4]],
  [[.5, 81, .2], [.75, 80, .2], [1, 76, .85], [2.25, 80, .23], [2.75, 81, .82]],
  [[0, 78, .53], [1, 75, .57], [2, 73, .53], [2.75, 71, .78]],
];

function raceRun(): Score {
  const b = new Builder();
  RACE_HARMONY.forEach(([root, ...voicing], i) => {
    const t = i * 4;
    const bridge = i >= 8 && i < 16;
    const breakdown = i >= 12 && i < 16;
    b.phrase(breakdown ? 'keys' : 'drive', t, RACE_TUNE[i], breakdown ? .82 : .86);
    b.phrase('bass', t, breakdown
      ? [[0, root, 1.38], [2.5, root + 12, .62, .76]]
      : [[0, root, .62], [.75, root + 12, .22, .78], [1.5, root, .68], [2.5, root + 7, .36, .85], [3.5, root + 12, .37, .74]], .92);
    if (bridge) b.chord('strings', t, voicing, 3.3, .50);
    if (!breakdown) {
      for (const beat of [0, 1.5, 3]) b.chord('guitar', t + beat, voicing, beat === 0 ? .51 : .22, .64, .008);
      b.drums('shaker', t, [[.5, .49], [1.5, .33], [2.5, .48], [3.5, .34]]);
    }
    b.drums('kick', t, breakdown ? [[0, .73], [2.75, .52]] : [[0, .92], [1.75, .58], [2.5, .83]]);
    b.drums('brush', t, breakdown ? [[2.03, .78]] : [[1.02, .81], [3.02, .88]]);
    if ((i + 1) % 4 === 0) b.drums('tom', t, [[3.5, .45], [3.75, .52]], 45);
  });
  return b.score('raceRun', 144, RACE_HARMONY.length);
}

// Big Little Footsteps. The riff leans on the 3+3+2 stride and a bluesy flat seventh.
// The middle opens into softer wood and a descending bass, then the stomp returns.
const DINO_HARMONY: readonly Harmony[] = [
  [46, 56, 60, 62, 65], [46, 56, 60, 62, 65], [44, 55, 60, 63, 67], [41, 57, 60, 63, 65],
  [46, 56, 60, 62, 65], [46, 56, 60, 62, 65], [39, 55, 58, 62, 65], [41, 57, 60, 63, 65],
  [43, 55, 58, 62, 65], [41, 55, 58, 62, 65], [40, 55, 58, 60, 64], [39, 55, 58, 62, 65],
  [46, 56, 60, 62, 65], [44, 55, 60, 63, 67], [39, 55, 58, 62, 65], [41, 57, 60, 63, 65],
];
const STOMP_CALL: readonly Note[] = [[0, 70, .42], [.5, 74, .3], [1.5, 77, .75], [3, 75, .42], [3.5, 72, .32]];
const DINO_TUNE: readonly (readonly Note[])[] = [
  STOMP_CALL, [[0, 74, .74], [1.5, 70, .7], [3, 68, .52]],
  [[0, 72, .42], [.5, 75, .3], [1.5, 79, .76], [3, 75, .67]], [[0, 77, .52], [1.5, 72, .66], [3, 69, .75]],
  STOMP_CALL, [[0, 74, .52], [1.5, 77, .8], [3, 80, .62]],
  [[0, 79, .72], [1.5, 75, .45], [2, 74, .58], [3, 70, .78]], [[.5, 72, .32], [1, 75, .42], [1.5, 77, 1.12]],
  [[0, 79, 1.15], [1.5, 77, .42], [2, 74, 1.4]], [[0, 70, .81], [1.5, 74, .51], [2.5, 72, 1.08]],
  [[0, 76, .82], [1.5, 79, .73], [3, 82, .64]], [[0, 81, .42], [.5, 79, .68], [1.5, 75, 1.33]],
  STOMP_CALL, [[0, 75, .42], [.5, 79, .3], [1.5, 84, .81], [3, 82, .62]],
  [[0, 79, .73], [1.5, 77, .42], [2, 75, .65], [3, 70, .74]],
  [[0, 72, .48], [.5, 75, .26], [1.5, 77, .69], [3, 69, .64]],
];

function dinoRun(): Score {
  const b = new Builder();
  DINO_HARMONY.forEach(([root, ...voicing], i) => {
    const t = i * 4;
    const bridge = i >= 8 && i < 12;
    b.phrase(bridge ? 'mallet' : 'reed', t, DINO_TUNE[i], bridge ? .84 : .79);
    b.phrase('pizz', t, [[0, root, .68], [1.5, root + 12, .54, .84], [3, root, .57]], .89);
    b.chord('keys', t + .5, voicing, .68, .53, .017);
    b.chord('keys', t + 2, voicing.slice(1), .81, .47, .017);
    b.drums('tom', t, bridge ? [[0, .47]] : [[0, .78], [1.5, .53], [3, .65]], 43);
    b.drums('block', t, [[.75, .33], [2.5, .49], [3.75, .30]], 74 + i % 2 * 3);
    b.drums('brush', t, [[2.02, .45]]);
    if (i % 4 === 3) b.phrase('mallet', t, [[3, voicing[1], .26], [3.5, voicing[2], .34]], .51);
    if (bridge) b.chord('strings', t, voicing, 3.2, .4);
  });
  return b.score('dinoRun', 112, DINO_HARMONY.length);
}

/** Musical feedback, using the same timbres as the rooms. Each cue has a separate ring-out. */
export const STINGS: Record<WsSting, Cue> = {
  success: (() => {
    const b = new Builder();
    b.phrase('mallet', 0, [[0, 69, .37], [.5, 73, .36], [1, 78, .81]], .96);
    b.chord('keys', 0, [54, 61, 69], .72, .46, .025);
    b.chord('keys', 1, [50, 61, 66, 69, 76], .94, .58, .022);
    b.note('glass', 1.08, .74, 81, .41);
    return { bpm: 112, events: b.events };
  })(),
  fail: (() => {
    const b = new Builder();
    b.phrase('mallet', 0, [[0, 71, .58], [.75, 67, .72], [1.5, 69, .97]], .74);
    b.chord('keys', 0, [55, 62, 67], .66, .38);
    b.chord('keys', 1.5, [57, 60, 64, 67], .97, .38, .024);
    return { bpm: 120, events: b.events };
  })(),
  unlock: (() => {
    const b = new Builder();
    b.phrase('glass', 0, [[0, 72, .53], [.33, 76, .44], [.67, 79, .46], [1, 83, .58], [1.5, 84, .88]], .66);
    b.phrase('mallet', 0, [[0, 60, .53], [1, 67, .36], [1.5, 72, .95]], .84);
    b.chord('keys', 1.5, [48, 55, 62, 64, 69], 1.05, .57, .026);
    return { bpm: 120, events: b.events };
  })(),
};

export const SCORES: Record<WsMusic, () => Score> = { title, raceShop, dinoLab, raceRun, dinoRun };

export const loopBeats = (s: Score): number => s.bars * 4;
export const loopSeconds = (s: Score): number => (loopBeats(s) * 60) / s.bpm;
