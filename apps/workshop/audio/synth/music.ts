/** Workshop instruments for offline renders. The game plays the baked files. */
import * as Tone from 'tone';
import { midiHz } from './voice';
import type { Cue, Inst, NoteEvent } from './scores';

export const MUSIC_SR = 48000;
/** Covers the longest voice release and the short room reflections. */
export const RING_OUT_SEC = 1.5;

type Player = (seconds: number, event: NoteEvent) => void;
type Pitched = Tone.Synth | Tone.FMSynth | Tone.PolySynth | Tone.PolySynth<Tone.FMSynth>;

function pitched(synth: Pitched, bus: Tone.InputNode, db: number, cutoff: number, pan = 0): Player {
  synth.volume.value = db;
  synth.chain(
    new Tone.Filter({ type: 'lowpass', frequency: cutoff, Q: 0.6 }),
    new Tone.Panner(pan),
    bus,
  );
  return (t, ev) => synth.triggerAttackRelease(midiHz(ev.p), ev.d, t, ev.v);
}

function noiseHit(bus: Tone.InputNode, color: 'white' | 'pink', filter: BiquadFilterType,
  hz: number, decay: number, db: number, pan: number): Player {
  const synth = new Tone.NoiseSynth({
    noise: { type: color },
    envelope: { attack: 0.004, decay, sustain: 0, release: 0.016 },
    volume: db,
  });
  synth.chain(new Tone.Filter({ type: filter, frequency: hz, Q: 0.85 }), new Tone.Panner(pan), bus);
  return (t, ev) => synth.triggerAttackRelease(decay, t, ev.v);
}

function buildInstruments(out: Tone.InputNode): Record<Inst, Player> {
  const ensemble = new Tone.Gain(1).connect(out);
  // Two quiet, damped early reflections give the pitched instruments a shared room.
  // The dry signal carries the tune in mono, and drums and bass stay clear of the delays.
  const reflection = new Tone.Filter({ frequency: 2700, Q: 0.65 });
  ensemble.connect(reflection);
  reflection.chain(new Tone.Delay(.047), new Tone.Panner(-.62), new Tone.Gain(.09), out);
  reflection.chain(new Tone.Delay(.071), new Tone.Panner(.57), new Tone.Gain(.07), out);

  const kick = new Tone.MembraneSynth({
    pitchDecay: .027, octaves: 3.5, volume: -9,
    envelope: { attack: .002, decay: .19, sustain: 0, release: .046 },
  }).connect(out);
  const tom = new Tone.MembraneSynth({
    pitchDecay: .024, octaves: 2.3, volume: -13,
    envelope: { attack: .003, decay: .155, sustain: 0, release: .06 },
  }).connect(out);
  const brush = noiseHit(out, 'pink', 'bandpass', 1710, .113, -10, .09);
  const rim = new Tone.Synth({
    oscillator: { type: 'custom', partials: [1, .32, .18, .14, .1] }, volume: -19,
    envelope: { attack: .003, decay: .048, sustain: 0, release: .015 },
  }).connect(out);
  const block = new Tone.FMSynth({
    harmonicity: 2.71, modulationIndex: .57,
    oscillator: { type: 'sine' }, modulation: { type: 'sine' },
    envelope: { attack: .002, decay: .076, sustain: 0, release: .044 },
    modulationEnvelope: { attack: .002, decay: .027, sustain: 0, release: .022 },
  });

  const bass = new Tone.Synth({
    oscillator: { type: 'custom', partials: [1, .42, .18, .11, .08] },
    envelope: { attack: .009, decay: .13, sustain: .48, release: .082 },
  });
  const pizz = new Tone.FMSynth({
    harmonicity: 2, modulationIndex: .83,
    oscillator: { type: 'sine' }, modulation: { type: 'sine' },
    envelope: { attack: .006, decay: .21, sustain: .18, release: .10 },
    modulationEnvelope: { attack: .003, decay: .085, sustain: .15, release: .055 },
  });
  const keys = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 1, modulationIndex: 1.58,
    oscillator: { type: 'sine' }, modulation: { type: 'sine' },
    envelope: { attack: .007, decay: .26, sustain: .55, release: .22 },
    modulationEnvelope: { attack: .003, decay: .09, sustain: .18, release: .14 },
  });
  const guitar = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'custom', partials: [1, .72, .5, .26, .33, .18, .11, .1] },
    envelope: { attack: .004, decay: .105, sustain: .1, release: .045 },
  });
  const reed = new Tone.FMSynth({
    harmonicity: 2, modulationIndex: .81,
    oscillator: { type: 'sine' }, modulation: { type: 'sine' },
    envelope: { attack: .018, decay: .09, sustain: .60, release: .097 },
    modulationEnvelope: { attack: .012, decay: .086, sustain: .42, release: .08 },
  });
  const drive = new Tone.Synth({
    oscillator: { type: 'custom', partials: [1, .25, .49, .17, .21, .09, .1] },
    envelope: { attack: .012, decay: .1, sustain: .63, release: .10 },
  });
  const mallet = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3.02, modulationIndex: 1.23,
    oscillator: { type: 'sine' }, modulation: { type: 'sine' },
    envelope: { attack: .004, decay: .24, sustain: .21, release: .19 },
    modulationEnvelope: { attack: .003, decay: .061, sustain: .05, release: .07 },
  });
  const glass = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 2.76, modulationIndex: .63,
    oscillator: { type: 'sine' }, modulation: { type: 'sine' },
    envelope: { attack: .006, decay: .37, sustain: .19, release: .38 },
    modulationEnvelope: { attack: .003, decay: .16, sustain: .035, release: .19 },
  });
  const strings = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fattriangle', count: 2, spread: 10 },
    envelope: { attack: .14, decay: .36, sustain: .72, release: .44 },
  });

  return {
    kick: (t, ev) => kick.triggerAttackRelease(52, .11, t, ev.v),
    tom: (t, ev) => tom.triggerAttackRelease(midiHz(ev.p), .10, t, ev.v),
    brush: (t, ev) => {
      brush(t, ev);
      rim.triggerAttackRelease(180, .051, t, ev.v * .5);
    },
    shaker: noiseHit(out, 'white', 'bandpass', 5150, .055, -21, -.27),
    block: pitched(block, ensemble, -16, 2700, .34),
    bass: pitched(bass, out, -10, 1120),
    pizz: pitched(pizz, out, -8, 1490, -.06),
    keys: pitched(keys, ensemble, -19, 3200, -.21),
    guitar: pitched(guitar, ensemble, -21, 2650, .31),
    reed: pitched(reed, ensemble, -10, 3950, .075),
    drive: pitched(drive, ensemble, -11, 3370, .06),
    mallet: pitched(mallet, ensemble, -11, 4100, .13),
    glass: pitched(glass, ensemble, -16, 4900, -.32),
    strings: pitched(strings, ensemble, -24, 1700, -.2),
  };
}

/** Renders one pass and its release tail. Schedule in onset order for the mono voices. */
export async function renderCue(cue: Cue, seconds: number): Promise<[Float32Array, Float32Array]> {
  const secondsPerBeat = 60 / cue.bpm;
  const events = [...cue.events].sort((a, b) => a.t - b.t);
  const buf = await Tone.Offline(() => {
    const players = buildInstruments(Tone.getDestination());
    for (const ev of events) players[ev.inst](ev.t * secondsPerBeat, { ...ev, d: ev.d * secondsPerBeat });
  }, seconds + RING_OUT_SEC, 2, MUSIC_SR);
  return [buf.getChannelData(0), buf.getChannelData(1)];
}
