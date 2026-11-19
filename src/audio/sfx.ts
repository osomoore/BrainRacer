import * as Tone from 'tone';
import type { SfxName } from '../core/types';
import type { Mixer } from './mixer';

type OscType = 'sine' | 'square' | 'triangle' | 'sawtooth';
const FLOOR = 0.0001;

interface OscSpec {
  type: OscType;
  f0: number;
  f1?: number;
  t: number;
  dur: number;
  vol: number;
  attack?: number;
}
interface NoiseSpec {
  type?: 'white' | 'pink' | 'brown';
  t: number;
  dur: number;
  vol: number;
  attack?: number;
  filter: BiquadFilterType;
  f0: number;
  f1?: number;
  q?: number;
}

/** One playing sound: a pan -> volume chain into the sfx bus plus every node to dispose afterwards. */
class Voice {
  readonly nodes: Tone.ToneAudioNode[] = [];
  readonly input: Tone.Gain;
  constructor(bus: Tone.Gain, pan: number, volume: number, readonly rate: number) {
    const panner = new Tone.Panner(Math.max(-1, Math.min(1, pan)));
    this.input = new Tone.Gain(volume);
    this.input.connect(panner);
    panner.connect(bus);
    this.nodes.push(this.input, panner);
  }
  add<T extends Tone.ToneAudioNode>(n: T): T {
    this.nodes.push(n);
    return n;
  }
  /** Pitch-scaled frequency. */
  f(hz: number): number {
    return hz * this.rate;
  }
  osc(s: OscSpec, dest: Tone.InputNode = this.input): Tone.Oscillator {
    const o = this.add(new Tone.Oscillator({ type: s.type, frequency: this.f(s.f0) }));
    const g = this.add(new Tone.Gain(FLOOR));
    o.connect(g);
    g.connect(dest);
    if (s.f1 !== undefined) {
      o.frequency.setValueAtTime(this.f(s.f0), s.t);
      o.frequency.exponentialRampToValueAtTime(this.f(s.f1), s.t + s.dur);
    }
    this.envelope(g, s.t, s.dur, s.vol, s.attack ?? 0.006);
    o.start(s.t);
    o.stop(s.t + s.dur + 0.03);
    return o;
  }
  noise(s: NoiseSpec, dest: Tone.InputNode = this.input): void {
    const n = this.add(new Tone.Noise(s.type ?? 'white'));
    const fl = this.add(new Tone.Filter({ type: s.filter, frequency: this.f(s.f0), Q: s.q ?? 1 }));
    const g = this.add(new Tone.Gain(FLOOR));
    n.connect(fl);
    fl.connect(g);
    g.connect(dest);
    if (s.f1 !== undefined) {
      fl.frequency.setValueAtTime(this.f(s.f0), s.t);
      fl.frequency.exponentialRampToValueAtTime(this.f(s.f1), s.t + s.dur);
    }
    this.envelope(g, s.t, s.dur, s.vol, s.attack ?? 0.008);
    n.start(s.t);
    n.stop(s.t + s.dur + 0.03);
  }
  envelope(g: Tone.Gain, t: number, dur: number, vol: number, attack: number): void {
    const a = Math.min(attack, dur * 0.5);
    g.gain.setValueAtTime(FLOOR, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(FLOOR, t + dur);
  }
  dispose(): void {
    for (const n of this.nodes) {
      try { n.dispose(); } catch { /* already disposed */ }
    }
    this.nodes.length = 0;
  }
}

/** A recipe schedules sounds starting at `t` and returns the total length in seconds. */
type Recipe = (v: Voice, t: number) => number;

const NOTE = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

function arpeggio(v: Voice, t: number, notes: number[], step: number, type: OscType, vol: number, len: number): void {
  notes.forEach((n, i) => {
    v.osc({ type, f0: NOTE(n), t: t + i * step, dur: len, vol });
  });
}

const RECIPES: Record<SfxName, Recipe> = {
  correct: (v, t) => {
    arpeggio(v, t, [84, 88, 91, 96], 0.07, 'triangle', 0.4, 0.25);
    arpeggio(v, t, [96, 100, 103, 108], 0.07, 'sine', 0.12, 0.2);
    return 0.6;
  },
  wrong: (v, t) => {
    // "wah wah wah waaah": one sawtooth through a wobbling lowpass.
    const o = v.add(new Tone.Oscillator({ type: 'sawtooth', frequency: v.f(392) }));
    const fl = v.add(new Tone.Filter({ type: 'lowpass', frequency: 700, Q: 4 }));
    const g = v.add(new Tone.Gain(FLOOR));
    o.connect(fl);
    fl.connect(g);
    g.connect(v.input);
    const notes: [number, number, number][] = [[392, 0, 0.22], [370, 0.25, 0.22], [349, 0.5, 0.22], [311, 0.75, 0.6]];
    for (const [f, off, d] of notes) {
      const s = t + off;
      o.frequency.setValueAtTime(v.f(f), s);
      g.gain.setValueAtTime(FLOOR, s);
      g.gain.linearRampToValueAtTime(0.3, s + 0.03);
      g.gain.linearRampToValueAtTime(0.22, s + d * 0.7);
      g.gain.linearRampToValueAtTime(FLOOR, s + d);
      fl.frequency.setValueAtTime(350, s);
      fl.frequency.exponentialRampToValueAtTime(1300, s + d * 0.5);
      fl.frequency.exponentialRampToValueAtTime(500, s + d);
    }
    o.frequency.exponentialRampToValueAtTime(v.f(262), t + 1.35);
    o.start(t);
    o.stop(t + 1.4);
    return 1.4;
  },
  timeout: (v, t) => {
    v.osc({ type: 'triangle', f0: 880, t, dur: 0.06, vol: 0.25 });
    return 0.1;
  },
  turbo: (v, t) => {
    // punchy launch thump + rising rocket whoosh (noise + saw sweep) + sparkly arcade tail
    v.osc({ type: 'sine', f0: 180, f1: 50, t, dur: 0.25, vol: 0.9, attack: 0.004 });
    v.noise({ type: 'white', t, dur: 0.12, vol: 0.5, filter: 'highpass', f0: 2000, attack: 0.003 });
    v.noise({ type: 'pink', t, dur: 0.95, vol: 1.0, filter: 'bandpass', f0: 250, f1: 4200, q: 1.8, attack: 0.08 });
    v.osc({ type: 'sawtooth', f0: 90, f1: 900, t, dur: 0.85, vol: 0.28, attack: 0.05 });
    v.osc({ type: 'square', f0: 180, f1: 1800, t: t + 0.05, dur: 0.7, vol: 0.08, attack: 0.1 });
    [88, 92, 95, 100, 104, 107].forEach((n, i) => {
      v.osc({ type: 'triangle', f0: NOTE(n), t: t + 0.35 + i * 0.09, dur: 0.3, vol: 0.32 });
      v.osc({ type: 'sine', f0: NOTE(n + 12), t: t + 0.35 + i * 0.09, dur: 0.22, vol: 0.1 });
    });
    return 1.2;
  },
  crash: (v, t) => {
    v.osc({ type: 'sine', f0: 140, f1: 45, t, dur: 0.28, vol: 0.8 });
    v.noise({ t, dur: 0.3, vol: 0.45, filter: 'lowpass', f0: 3500, f1: 400 });
    return 0.35;
  },
  crashBig: (v, t) => {
    v.osc({ type: 'sine', f0: 110, f1: 30, t, dur: 0.55, vol: 0.95 });
    v.osc({ type: 'triangle', f0: 70, f1: 35, t: t + 0.08, dur: 0.4, vol: 0.5 });
    v.noise({ t, dur: 0.65, vol: 0.6, filter: 'lowpass', f0: 4500, f1: 250 });
    v.noise({ t: t + 0.12, dur: 0.3, vol: 0.25, filter: 'bandpass', f0: 1500, f1: 600, q: 2 });
    return 0.75;
  },
  skid: (v, t) => {
    v.noise({ type: 'white', t, dur: 0.4, vol: 0.22, filter: 'bandpass', f0: 2600, f1: 1900, q: 3, attack: 0.05 });
    return 0.45;
  },
  siren: (v, t) => {
    for (let i = 0; i < 4; i++) {
      v.osc({ type: 'sine', f0: i % 2 === 0 ? 660 : 784, t: t + i * 0.35, dur: 0.35, vol: 0.1, attack: 0.08 });
    }
    return 1.45;
  },
  policeBump: (v, t) => {
    v.osc({ type: 'sine', f0: 170, f1: 520, t, dur: 0.1, vol: 0.5 });
    v.osc({ type: 'sine', f0: 520, f1: 150, t: t + 0.1, dur: 0.3, vol: 0.5 });
    v.osc({ type: 'triangle', f0: 340, f1: 100, t: t + 0.1, dur: 0.3, vol: 0.2 });
    return 0.5;
  },
  jump: (v, t) => {
    v.osc({ type: 'square', f0: 260, f1: 880, t, dur: 0.25, vol: 0.14 });
    v.osc({ type: 'triangle', f0: 260, f1: 880, t, dur: 0.25, vol: 0.3 });
    return 0.3;
  },
  land: (v, t) => {
    v.osc({ type: 'sine', f0: 150, f1: 50, t, dur: 0.2, vol: 0.8 });
    v.noise({ t, dur: 0.09, vol: 0.25, filter: 'lowpass', f0: 900 });
    return 0.25;
  },
  goal: (v, t) => {
    arpeggio(v, t, [72, 76, 79, 84], 0.15, 'square', 0.13, 0.22);
    arpeggio(v, t, [72, 76, 79, 84], 0.15, 'triangle', 0.3, 0.22);
    // held final chord
    const c = t + 0.6;
    for (const n of [84, 88, 91]) {
      v.osc({ type: 'square', f0: NOTE(n), t: c, dur: 0.9, vol: 0.1, attack: 0.01 });
      v.osc({ type: 'triangle', f0: NOTE(n), t: c, dur: 0.9, vol: 0.22, attack: 0.01 });
    }
    v.osc({ type: 'triangle', f0: NOTE(60), t: c, dur: 0.9, vol: 0.3, attack: 0.01 });
    return 1.6;
  },
  goalArrive: (v, t) => {
    for (const [i, f] of [1318, 1760].entries()) {
      const s = t + i * 0.18;
      v.osc({ type: 'sine', f0: f, t: s, dur: 0.35, vol: 0.35 });
      v.osc({ type: 'sine', f0: f * 2.7, t: s, dur: 0.2, vol: 0.08 });
    }
    return 0.7;
  },
  countdown: (v, t) => {
    v.osc({ type: 'square', f0: 440, t, dur: 0.2, vol: 0.22, attack: 0.01 });
    return 0.3;
  },
  go: (v, t) => {
    v.osc({ type: 'square', f0: 880, t, dur: 0.65, vol: 0.22, attack: 0.01 });
    v.osc({ type: 'triangle', f0: 1760, t, dur: 0.65, vol: 0.12, attack: 0.01 });
    return 0.75;
  },
  roar: (v, t) => {
    const dur = 2.2 / Math.pow(v.rate, 1.4); // higher rate = shorter yelp
    const pre = v.add(new Tone.Gain(1.6));
    // low growl: two slightly detuned saws dropping in pitch + brown noise
    for (const mul of [1, 1.012]) {
      const o = v.add(new Tone.Oscillator({ type: 'sawtooth', frequency: v.f(95 * mul) }));
      const g = v.add(new Tone.Gain(0.5));
      o.frequency.setValueAtTime(v.f(120 * mul), t);
      o.frequency.exponentialRampToValueAtTime(v.f(50 * mul), t + dur);
      o.connect(g);
      g.connect(pre);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
    // sub-bass body (sits under the distortion so it stays clean and round)
    const sub = v.add(new Tone.Oscillator({ type: 'sine', frequency: v.f(62) }));
    const sg = v.add(new Tone.Gain(FLOOR));
    sub.frequency.setValueAtTime(v.f(70), t);
    sub.frequency.exponentialRampToValueAtTime(v.f(34), t + dur);
    sg.gain.setValueAtTime(FLOOR, t);
    sg.gain.linearRampToValueAtTime(0.9, t + 0.15);
    sg.gain.linearRampToValueAtTime(0.6, t + dur * 0.55);
    sg.gain.exponentialRampToValueAtTime(FLOOR, t + dur);
    sub.connect(sg);
    sg.connect(v.input);
    sub.start(t);
    sub.stop(t + dur + 0.05);
    const nz = v.add(new Tone.Noise('brown'));
    const ng = v.add(new Tone.Gain(0.7));
    nz.connect(ng);
    ng.connect(pre);
    nz.start(t);
    nz.stop(t + dur + 0.05);
    // distortion -> lowpass that closes -> tremolo -> envelope
    const shaper = v.add(new Tone.WaveShaper((x: number) => Math.tanh(x * 3), 1024));
    const lp = v.add(new Tone.Filter({ type: 'lowpass', frequency: v.f(2600), Q: 2 }));
    lp.frequency.setValueAtTime(v.f(2600), t);
    lp.frequency.exponentialRampToValueAtTime(v.f(380), t + dur);
    const trem = v.add(new Tone.Gain(1));
    const lfo = v.add(new Tone.LFO({ frequency: 17, min: 0.35, max: 1, type: 'sine' }));
    lfo.frequency.setValueAtTime(17, t);
    lfo.frequency.linearRampToValueAtTime(8, t + dur);
    lfo.connect(trem.gain);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
    const env = v.add(new Tone.Gain(FLOOR));
    env.gain.setValueAtTime(FLOOR, t);
    env.gain.linearRampToValueAtTime(0.6, t + 0.12);
    env.gain.linearRampToValueAtTime(0.46, t + dur * 0.55);
    env.gain.exponentialRampToValueAtTime(FLOOR, t + dur);
    pre.connect(shaper);
    shaper.connect(lp);
    lp.connect(trem);
    trem.connect(env);
    env.connect(v.input);
    return dur + 0.1;
  },
  stomp: (v, t) => {
    v.osc({ type: 'sine', f0: 85, f1: 32, t, dur: 0.45, vol: 1.0 });
    v.noise({ type: 'brown', t, dur: 0.25, vol: 0.5, filter: 'lowpass', f0: 250 });
    return 0.5;
  },
  squash: (v, t) => {
    v.noise({ t, dur: 0.18, vol: 0.4, filter: 'lowpass', f0: 1800, f1: 300 });
    v.osc({ type: 'triangle', f0: 700, f1: 120, t, dur: 0.28, vol: 0.4 });
    v.osc({ type: 'sine', f0: 200, f1: 420, t: t + 0.2, dur: 0.12, vol: 0.3 });
    return 0.4;
  },
  shockwave: (v, t) => {
    v.osc({ type: 'sine', f0: 90, f1: 28, t, dur: 0.7, vol: 0.9, attack: 0.02 });
    v.noise({ type: 'pink', t, dur: 0.5, vol: 0.2, filter: 'lowpass', f0: 800, f1: 150 });
    const shim = v.add(new Tone.Gain(1));
    shim.connect(v.input);
    for (const [i, f] of [2400, 3100, 3900].entries()) {
      v.osc({ type: 'sine', f0: f, f1: f * 0.8, t: t + 0.05 + i * 0.04, dur: 0.7, vol: 0.05, attack: 0.1 }, shim);
    }
    return 0.9;
  },
  pop: (v, t) => {
    v.osc({ type: 'sine', f0: 700, f1: 220, t, dur: 0.08, vol: 0.5 });
    v.noise({ t, dur: 0.03, vol: 0.12, filter: 'highpass', f0: 3000 });
    return 0.15;
  },
  menuMove: (v, t) => {
    v.osc({ type: 'triangle', f0: 740, t, dur: 0.05, vol: 0.25 });
    return 0.1;
  },
  menuSelect: (v, t) => {
    v.osc({ type: 'square', f0: 660, t, dur: 0.07, vol: 0.14 });
    v.osc({ type: 'square', f0: 990, t: t + 0.07, dur: 0.14, vol: 0.14 });
    v.osc({ type: 'triangle', f0: 990, t: t + 0.07, dur: 0.14, vol: 0.2 });
    return 0.3;
  },
  join: (v, t) => {
    v.osc({ type: 'triangle', f0: NOTE(79), t, dur: 0.14, vol: 0.32 });
    v.osc({ type: 'triangle', f0: NOTE(86), t: t + 0.12, dur: 0.25, vol: 0.32 });
    v.osc({ type: 'square', f0: NOTE(86), t: t + 0.12, dur: 0.25, vol: 0.08 });
    return 0.45;
  },
};

/** Loudness trims per sound so the mix feels even. */
const TRIM: Partial<Record<SfxName, number>> = { crashBig: 0.9, roar: 0.5, turbo: 1.25, stomp: 0.9 };
/** Max simultaneous instances per sound, and minimum retrigger gap (seconds). */
const MAX_VOICES: Partial<Record<SfxName, number>> = { menuMove: 2, timeout: 2, pop: 3, skid: 2, roar: 2, goal: 1 };
const DEFAULT_MAX_VOICES = 4;
const GLOBAL_MAX_VOICES = 20;
const MIN_GAP: Partial<Record<SfxName, number>> = { menuMove: 0.04, timeout: 0.05, pop: 0.03, skid: 0.15, land: 0.06, correct: 0.05 };

const clampRate = (r: number | undefined): number => Math.min(4, Math.max(0.25, r ?? 1));

export interface PlayOpts { pan?: number; volume?: number; rate?: number }

export class SfxEngine {
  private readonly active = new Map<SfxName, number>();
  private readonly lastStart = new Map<SfxName, number>();
  private total = 0;

  constructor(private readonly mixer: Mixer) {}

  play(name: SfxName, opts: PlayOpts = {}): void {
    const recipe = RECIPES[name];
    if (!recipe) return;
    const now = Tone.now();
    const n = this.active.get(name) ?? 0;
    if (n >= (MAX_VOICES[name] ?? DEFAULT_MAX_VOICES) || this.total >= GLOBAL_MAX_VOICES) return;
    const gap = MIN_GAP[name] ?? 0.02;
    if (now - (this.lastStart.get(name) ?? -1) < gap) return;
    this.lastStart.set(name, now);
    this.active.set(name, n + 1);
    this.total++;
    let voice: Voice | null = null;
    let dur = 0.5;
    try {
      voice = new Voice(this.mixer.sfxBus, opts.pan ?? 0, Math.max(0, opts.volume ?? 1) * (TRIM[name] ?? 1), clampRate(opts.rate));
      dur = recipe(voice, now + 0.02);
    } catch {
      /* never let a sound break the game */
    }
    window.setTimeout(() => {
      voice?.dispose();
      this.active.set(name, Math.max(0, (this.active.get(name) ?? 1) - 1));
      this.total = Math.max(0, this.total - 1);
    }, (dur + 0.4) * 1000);
  }

  /** Start a continuous sound; returns a stop function (fades out, then disposes). */
  loop(name: SfxName, opts: { pan?: number; volume?: number } = {}): () => void {
    let stopped = false;
    let stopFn: () => void = () => { stopped = true; };
    try {
      if (name === 'siren' || name === 'skid') stopFn = this.continuous(name, opts);
      else {
        // generic: retrigger the one-shot recipe
        const id = window.setInterval(() => { if (!stopped) this.play(name, opts); }, 600);
        this.play(name, opts);
        stopFn = () => { stopped = true; window.clearInterval(id); };
      }
    } catch {
      /* ignore */
    }
    return () => {
      if (stopped && name !== 'siren' && name !== 'skid') return;
      stopped = true;
      try { stopFn(); } catch { /* ignore */ }
    };
  }

  private continuous(name: 'siren' | 'skid', opts: { pan?: number; volume?: number }): () => void {
    const v = new Voice(this.mixer.sfxBus, opts.pan ?? 0, Math.max(0, opts.volume ?? 1), 1);
    const out = v.add(new Tone.Gain(0));
    out.connect(v.input);
    const t = Tone.now() + 0.02;
    let timer = 0;
    if (name === 'siren') {
      // gentle two-tone: sine, rounded by a lowpass, ~0.7 s per tone, slow fade in
      const o = v.add(new Tone.Oscillator({ type: 'sine', frequency: 660 }));
      const lp = v.add(new Tone.Filter({ type: 'lowpass', frequency: 900, Q: 0.4 }));
      o.connect(lp);
      lp.connect(out);
      o.start(t);
      const TONE = 0.7;
      let next = t;
      let idx = 0;
      const schedule = (horizon: number): void => {
        while (next < Tone.now() + horizon) {
          o.frequency.setTargetAtTime(idx % 2 === 0 ? 660 : 784, next, 0.05);
          next += TONE;
          idx++;
        }
      };
      schedule(20);
      timer = window.setInterval(() => schedule(20), 8000);
      out.gain.setValueAtTime(0, t);
      out.gain.linearRampToValueAtTime(0.25, t + 1.2);
    } else {
      const nz = v.add(new Tone.Noise('white'));
      const bp = v.add(new Tone.Filter({ type: 'bandpass', frequency: 2300, Q: 3 }));
      const lfo = v.add(new Tone.LFO({ frequency: 7, min: 1800, max: 2700, type: 'triangle' }));
      lfo.connect(bp.frequency);
      nz.connect(bp);
      bp.connect(out);
      lfo.start(t);
      nz.start(t);
      out.gain.setValueAtTime(0, t);
      out.gain.linearRampToValueAtTime(0.2, t + 0.05);
    }
    let done = false;
    const fade = name === 'siren' ? 0.8 : 0.12;
    return () => {
      if (done) return;
      done = true;
      window.clearInterval(timer);
      const now = Tone.now();
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(out.gain.value, now);
      out.gain.linearRampToValueAtTime(0, now + fade);
      window.setTimeout(() => v.dispose(), (fade + 0.25) * 1000);
    };
  }
}
