/** Turns a Score into stereo audio with Tone.js instruments (render time only). */
import * as Tone from 'tone';
import { midiHz } from './voice';
import type { Inst, NoteEvent, Score } from './scores';

export const MUSIC_SR = 44100;

type Player = (t: number, ev: NoteEvent) => void;

function noiseHit(color: 'white' | 'pink', filter: BiquadFilterType, freq: number, decay: number, vol: number, bus: Tone.InputNode): Player {
  const f = new Tone.Filter({ type: filter, frequency: freq, Q: 0.8 });
  const n = new Tone.NoiseSynth({ noise: { type: color }, envelope: { attack: 0.002, decay, sustain: 0, release: 0.01 } });
  n.volume.value = vol;
  n.connect(f);
  f.connect(bus);
  return (t, ev) => n.triggerAttackRelease(decay, t, ev.v);
}

function synthPlayer(synth: Tone.Synth | Tone.FMSynth | Tone.MonoSynth, dest: Tone.InputNode, vol: number, pan = 0): Player {
  const p = new Tone.Panner(pan);
  synth.volume.value = vol;
  synth.connect(p);
  p.connect(dest);
  return (t, ev) => synth.triggerAttackRelease(midiHz(ev.p), Math.max(0.03, ev.d), t, ev.v);
}

function polyPlayer(poly: Tone.PolySynth, dest: Tone.InputNode, vol: number, lp: number, pan = 0): Player {
  const f = new Tone.Filter({ type: 'lowpass', frequency: lp, Q: 0.5 });
  const p = new Tone.Panner(pan);
  poly.volume.value = vol;
  poly.connect(f);
  f.connect(p);
  p.connect(dest);
  return (t, ev) => poly.triggerAttackRelease(midiHz(ev.p), Math.max(0.03, ev.d), t, ev.v);
}

/** Builds every instrument inside the current (offline) context and returns a player per instrument name. */
function buildInstruments(out: Tone.InputNode): Record<Inst, Player> {
  const bus = new Tone.Gain(0.9);
  const comp = new Tone.Compressor({ threshold: -16, ratio: 3, attack: 0.01, release: 0.15 });
  bus.connect(comp);
  comp.connect(out);

  const kickS = new Tone.MembraneSynth({ pitchDecay: 0.04, octaves: 6, envelope: { attack: 0.001, decay: 0.28, sustain: 0, release: 0.05 } });
  kickS.volume.value = -2;
  kickS.connect(bus);
  const snareTone = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 2, envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.02 } });
  snareTone.volume.value = -14;
  snareTone.connect(bus);
  const snareNoise = noiseHit('white', 'highpass', 1500, 0.12, -10, bus);
  const hat = noiseHit('white', 'highpass', 7000, 0.04, -18, bus);
  const openHat = noiseHit('white', 'highpass', 6500, 0.22, -20, bus);
  const clapN = noiseHit('pink', 'bandpass', 1600, 0.09, -11, bus);
  const shaker = noiseHit('white', 'highpass', 5500, 0.05, -22, bus);
  const rimS = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 } });
  rimS.volume.value = -12;
  rimS.connect(bus);

  const bassS = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' }, filter: { type: 'lowpass', Q: 1.5, rolloff: -24 },
    envelope: { attack: 0.005, decay: 0.15, sustain: 0.5, release: 0.08 },
    filterEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.1, baseFrequency: 140, octaves: 2.6 },
  });
  const subS = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.2 } });
  const pizzS = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.002, decay: 0.18, sustain: 0, release: 0.05 } });
  const pluckS = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.1 } });
  const lead = new Tone.Synth({ oscillator: { type: 'fatsawtooth', count: 2, spread: 18 }, envelope: { attack: 0.012, decay: 0.1, sustain: 0.6, release: 0.12 } });
  const leadF = new Tone.Filter({ type: 'lowpass', frequency: 3400, Q: 0.6 });
  const leadV = new Tone.Vibrato({ frequency: 5.5, depth: 0.12 });
  lead.volume.value = -7;
  lead.chain(leadF, leadV, bus);
  const leadSynth = lead;
  const whistleS = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.03, decay: 0.1, sustain: 0.7, release: 0.18 } });
  const whistleV = new Tone.Vibrato({ frequency: 5.5, depth: 0.15 });
  whistleS.volume.value = -6;
  whistleS.chain(whistleV, bus);
  const marimbaS = new Tone.FMSynth({ harmonicity: 4, modulationIndex: 1.5, oscillator: { type: 'sine' }, modulation: { type: 'sine' },
    envelope: { attack: 0.002, decay: 0.28, sustain: 0, release: 0.1 }, modulationEnvelope: { attack: 0.002, decay: 0.12, sustain: 0, release: 0.05 } });
  const bubbleS = new Tone.FMSynth({ harmonicity: 1, modulationIndex: 3, oscillator: { type: 'sine' }, modulation: { type: 'sine' },
    envelope: { attack: 0.002, decay: 0.15, sustain: 0, release: 0.05 }, modulationEnvelope: { attack: 0.002, decay: 0.1, sustain: 0, release: 0.05 } });
  const bellS = new Tone.FMSynth({ harmonicity: 3.5, modulationIndex: 5, oscillator: { type: 'sine' }, modulation: { type: 'sine' },
    envelope: { attack: 0.002, decay: 1.0, sustain: 0, release: 0.4 }, modulationEnvelope: { attack: 0.002, decay: 0.5, sustain: 0, release: 0.2 } });
  const guitarP = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.004, decay: 0.16, sustain: 0.08, release: 0.06 } });
  const padP = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle' }, envelope: { attack: 0.35, decay: 0.3, sustain: 0.8, release: 0.6 } });

  const kick: Player = (t, ev) => kickS.triggerAttackRelease(50, 0.2, t, ev.v);
  return {
    kick,
    snare: (t, ev) => { snareNoise(t, ev); snareTone.triggerAttackRelease(190, 0.08, t, ev.v); },
    hat, openHat, shaker,
    clap: (t, ev) => { for (let i = 0; i < 3; i++) clapN(t + i * 0.011, ev); },
    rim: (t, ev) => rimS.triggerAttackRelease(1100, 0.04, t, ev.v),
    bass: synthPlayer(bassS, bus, -6),
    subBass: synthPlayer(subS, bus, -4),
    pizz: synthPlayer(pizzS, bus, -4),
    pluck: synthPlayer(pluckS, bus, -9, -0.25),
    lead: (t, ev) => leadSynth.triggerAttackRelease(midiHz(ev.p), Math.max(0.03, ev.d), t, ev.v),
    whistle: (t, ev) => whistleS.triggerAttackRelease(midiHz(ev.p), Math.max(0.03, ev.d), t, ev.v),
    marimba: synthPlayer(marimbaS, bus, -6, 0.25),
    bubble: synthPlayer(bubbleS, bus, -12, -0.4),
    bell: synthPlayer(bellS, bus, -12, 0.35),
    guitar: polyPlayer(guitarP, bus, -17, 3000, 0.2),
    pad: polyPlayer(padP, bus, -17, 1400, 0),
  };
}

/** Renders one loop (plus ring-out tail folded by the caller) as stereo channels. */
export async function renderScore(score: Score, tailSec: number): Promise<[Float32Array, Float32Array]> {
  const spb = 60 / score.bpm;
  const sec = score.bars * 4 * spb;
  const buf = await Tone.Offline(() => {
    const players = buildInstruments(Tone.getDestination());
    for (const ev of score.events) {
      try { players[ev.inst](ev.t * spb, ev); } catch { /* skip a bad note */ }
    }
  }, sec + tailSec, 2, MUSIC_SR);
  return [buf.getChannelData(0), buf.getChannelData(1)];
}
