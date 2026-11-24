/** Small offline-synthesis toolkit on top of Tone.js (render time only: never imported by the runtime player). */
import * as Tone from 'tone';

export type OscType = 'sine' | 'square' | 'triangle' | 'sawtooth';
const FLOOR = 0.0001;

export interface ToneSpec {
  type: OscType;
  /** Pitch keyframes [offset seconds from t, Hz]; the first one is the start pitch. */
  pitch: [number, number][];
  t: number;
  dur: number;
  vol: number;
  attack?: number;
  /** Lowpass cutoff (and optional end cutoff, swept exponentially over dur). */
  lp?: number;
  lpEnd?: number;
  q?: number;
  /** Vibrato [depth in cents, rate Hz]. */
  vib?: [number, number];
  /** Tremolo [depth 0..1, rate Hz]. */
  trem?: [number, number];
  /** Hold the peak for this fraction of dur before decaying (default: pure decay). */
  hold?: number;
}

export interface NoiseSpec {
  color?: 'white' | 'pink' | 'brown';
  t: number;
  dur: number;
  vol: number;
  attack?: number;
  filter: BiquadFilterType;
  f0: number;
  f1?: number;
  q?: number;
  trem?: [number, number];
  hold?: number;
}

export class Voice {
  readonly nodes: Tone.ToneAudioNode[] = [];
  readonly out: Tone.Gain;
  constructor(bus: Tone.InputNode, volume = 1) {
    this.out = new Tone.Gain(volume);
    this.out.connect(bus);
    this.nodes.push(this.out);
  }
  add<T extends Tone.ToneAudioNode>(n: T): T {
    this.nodes.push(n);
    return n;
  }
  private envelope(g: Tone.Gain, t: number, dur: number, vol: number, attack: number, hold = 0): void {
    const a = Math.min(attack, dur * 0.5);
    g.gain.setValueAtTime(FLOOR, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    if (hold > 0) g.gain.setValueAtTime(vol, t + Math.min(dur * 0.9, a + dur * hold));
    g.gain.exponentialRampToValueAtTime(FLOOR, t + dur);
  }
  private tremolo(node: Tone.Gain, t: number, tr: [number, number] | undefined): Tone.Gain {
    if (!tr) return node;
    const g = this.add(new Tone.Gain(0));
    const lfo = this.add(new Tone.LFO({ frequency: tr[1], min: 1 - tr[0], max: 1, type: 'sine' }));
    lfo.connect(g.gain);
    lfo.start(t);
    node.connect(g);
    return g;
  }
  tone(s: ToneSpec, dest: Tone.InputNode = this.out): void {
    const o = this.add(new Tone.Oscillator({ type: s.type, frequency: s.pitch[0][1] }));
    o.frequency.setValueAtTime(s.pitch[0][1], s.t);
    for (let i = 1; i < s.pitch.length; i++) o.frequency.exponentialRampToValueAtTime(s.pitch[i][1], s.t + s.pitch[i][0]);
    if (s.vib) {
      const lfo = this.add(new Tone.LFO({ frequency: s.vib[1], min: -s.vib[0], max: s.vib[0] }));
      lfo.connect(o.detune);
      lfo.start(s.t);
    }
    let node: Tone.ToneAudioNode = o;
    if (s.lp) {
      const f = this.add(new Tone.Filter({ type: 'lowpass', frequency: s.lp, Q: s.q ?? 1 }));
      f.frequency.setValueAtTime(s.lp, s.t);
      if (s.lpEnd) f.frequency.exponentialRampToValueAtTime(s.lpEnd, s.t + s.dur);
      o.connect(f);
      node = f;
    }
    const env = this.add(new Tone.Gain(FLOOR));
    node.connect(env);
    this.tremolo(env, s.t, s.trem).connect(dest);
    this.envelope(env, s.t, s.dur, s.vol, s.attack ?? 0.008, s.hold);
    o.start(s.t);
    o.stop(s.t + s.dur + 0.03);
  }
  noise(s: NoiseSpec, dest: Tone.InputNode = this.out): void {
    const n = this.add(new Tone.Noise(s.color ?? 'white'));
    const f = this.add(new Tone.Filter({ type: s.filter, frequency: s.f0, Q: s.q ?? 1 }));
    const env = this.add(new Tone.Gain(FLOOR));
    n.connect(f);
    f.connect(env);
    f.frequency.setValueAtTime(s.f0, s.t);
    if (s.f1) f.frequency.exponentialRampToValueAtTime(s.f1, s.t + s.dur);
    this.tremolo(env, s.t, s.trem).connect(dest);
    this.envelope(env, s.t, s.dur, s.vol, s.attack ?? 0.01, s.hold);
    n.start(s.t);
    n.stop(s.t + s.dur + 0.03);
  }
  dispose(): void {
    for (const n of this.nodes) {
      try { n.dispose(); } catch { /* already disposed */ }
    }
    this.nodes.length = 0;
  }
}

export const midiHz = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

/** Soft bell: a sine plus an inharmonic partial, quick decay. */
export function chime(v: Voice, t: number, midi: number, dur: number, vol: number): void {
  v.tone({ type: 'sine', pitch: [[0, midiHz(midi)]], t, dur, vol, attack: 0.004 });
  v.tone({ type: 'sine', pitch: [[0, midiHz(midi) * 2.76]], t, dur: dur * 0.5, vol: vol * 0.35, attack: 0.003 });
  v.tone({ type: 'triangle', pitch: [[0, midiHz(midi) * 2]], t, dur: dur * 0.7, vol: vol * 0.3, attack: 0.003 });
}
