import * as Tone from 'tone';
import type { IEngineSound } from '../core/services';
import type { Mixer } from './mixer';
import { makeSeamlessLoop, renderQueue } from './bufferUtils';

const IDLE_HZ = 55;
const TOP_HZ = 170;

/** Persistent per-player engine: saw + square -> lowpass, brighter layer while boosting. */
export class EngineSound implements IEngineSound {
  private nodes: Tone.ToneAudioNode[] = [];
  private oscs: Tone.Oscillator[] = [];
  private saw!: Tone.Oscillator;
  private sq!: Tone.Oscillator;
  private bright!: Tone.Oscillator;
  private brightGain!: Tone.Gain;
  private filter!: Tone.Filter;
  private wobble!: Tone.LFO;
  private out!: Tone.Gain;
  private stopped = false;
  private built = false;
  private lastSpeed = 0;
  private lastBoost = false;

  constructor(private readonly mixer: Mixer, private readonly pan: number, private readonly onStop: () => void) {
    this.build();
  }

  private build(): void {
    const panner = new Tone.Panner(this.pan);
    this.out = new Tone.Gain(0);
    this.filter = new Tone.Filter({ type: 'lowpass', frequency: 300, Q: 1.2 });
    this.saw = new Tone.Oscillator({ type: 'sawtooth', frequency: IDLE_HZ });
    this.sq = new Tone.Oscillator({ type: 'square', frequency: IDLE_HZ * 0.5 });
    const sqGain = new Tone.Gain(0.5);
    this.bright = new Tone.Oscillator({ type: 'sawtooth', frequency: IDLE_HZ * 2 });
    this.brightGain = new Tone.Gain(0);
    const brightFilter = new Tone.Filter({ type: 'bandpass', frequency: 900, Q: 0.8 });
    this.wobble = new Tone.LFO({ frequency: 6.5, min: -35, max: 35, type: 'sine' });
    this.wobble.connect(this.saw.detune);
    this.wobble.connect(this.sq.detune);

    this.saw.connect(this.filter);
    this.sq.connect(sqGain);
    sqGain.connect(this.filter);
    this.bright.connect(brightFilter);
    brightFilter.connect(this.brightGain);
    this.brightGain.connect(this.out);
    this.filter.connect(this.out);
    this.out.connect(panner);
    panner.connect(this.mixer.sfxBus);

    this.oscs = [this.saw, this.sq, this.bright];
    this.nodes = [panner, this.out, this.filter, this.saw, this.sq, sqGain, this.bright, this.brightGain, brightFilter, this.wobble];
    const t = Tone.now() + 0.02;
    for (const o of this.oscs) o.start(t);
    this.wobble.start(t);
    this.out.gain.setValueAtTime(0, t);
    this.out.gain.linearRampToValueAtTime(0.07, t + 0.15);
    this.built = true;
  }

  set(speed: number, boost: boolean): void {
    if (this.stopped || !this.built) return;
    const s = Math.min(1, Math.max(0, Number.isFinite(speed) ? speed : 0));
    this.lastSpeed = s;
    this.lastBoost = boost;
    const hz = IDLE_HZ + (TOP_HZ - IDLE_HZ) * s;
    const ramp = 0.08;
    this.saw.frequency.rampTo(hz, ramp);
    this.sq.frequency.rampTo(hz * 0.5, ramp);
    this.bright.frequency.rampTo(hz * (boost ? 2.02 : 2), ramp);
    this.filter.frequency.rampTo(280 + s * 900 + (boost ? 1100 : 0), ramp);
    this.brightGain.gain.rampTo(boost ? 1.4 : 0, 0.1);
    this.wobble.amplitude.rampTo(1 - s * 0.85, 0.2);
    this.wobble.frequency.rampTo(6 + s * 8, 0.2);
    this.out.gain.rampTo(0.06 + s * 0.05 + (boost ? 0.04 : 0), 0.1);
  }

  get state(): { speed: number; boost: boolean } {
    return { speed: this.lastSpeed, boost: this.lastBoost };
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.onStop();
    try {
      const now = Tone.now();
      this.out.gain.cancelScheduledValues(now);
      this.out.gain.setValueAtTime(this.out.gain.value, now);
      this.out.gain.linearRampToValueAtTime(0, now + 0.2);
      for (const o of this.oscs) o.stop(now + 0.25);
      this.wobble.stop(now + 0.25);
    } catch { /* ignore */ }
    window.setTimeout(() => {
      for (const n of this.nodes) {
        try { n.dispose(); } catch { /* ignore */ }
      }
      this.nodes = [];
    }, 500);
  }
}

/** Cheap engine: one sawtooth -> lowpass -> gain -> panner. No LFO, bright layer or square sub. */
export class LiteEngineSound implements IEngineSound {
  private nodes: Tone.ToneAudioNode[] = [];
  private readonly osc: Tone.Oscillator;
  private readonly filter: Tone.Filter;
  private readonly out: Tone.Gain;
  private stopped = false;

  constructor(mixer: Mixer, pan: number, private readonly onStop: () => void) {
    const panner = new Tone.Panner(pan);
    this.out = new Tone.Gain(0);
    this.filter = new Tone.Filter({ type: 'lowpass', frequency: 300, Q: 1 });
    this.osc = new Tone.Oscillator({ type: 'sawtooth', frequency: IDLE_HZ });
    this.osc.connect(this.filter);
    this.filter.connect(this.out);
    this.out.connect(panner);
    panner.connect(mixer.sfxBus);
    this.nodes = [panner, this.out, this.filter, this.osc];
    const t = Tone.now() + 0.02;
    this.osc.start(t);
    this.out.gain.setValueAtTime(0, t);
    this.out.gain.linearRampToValueAtTime(0.07, t + 0.15);
  }

  set(speed: number, boost: boolean): void {
    if (this.stopped) return;
    const s = Math.min(1, Math.max(0, Number.isFinite(speed) ? speed : 0));
    const hz = IDLE_HZ + (TOP_HZ - IDLE_HZ) * s;
    this.osc.frequency.rampTo(hz * (boost ? 1.1 : 1), 0.1);
    this.filter.frequency.rampTo(280 + s * 900 + (boost ? 900 : 0), 0.1);
    this.out.gain.rampTo(0.06 + s * 0.05 + (boost ? 0.04 : 0), 0.12);
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.onStop();
    try {
      const now = Tone.now();
      this.out.gain.cancelScheduledValues(now);
      this.out.gain.setValueAtTime(this.out.gain.value, now);
      this.out.gain.linearRampToValueAtTime(0, now + 0.15);
      this.osc.stop(now + 0.2);
    } catch { /* ignore */ }
    window.setTimeout(() => {
      for (const n of this.nodes) {
        try { n.dispose(); } catch { /* ignore */ }
      }
      this.nodes = [];
    }, 400);
  }
}

// ───────────────────────── pre-rendered ("sample") engine ─────────────────────────
const ENGINE_SR = 44100;
/** 2 s = 110 saw cycles and 55 square cycles at idle pitch, so the loop is periodic. */
const ENGINE_LOOP_SEC = 2;
const ENGINE_XFADE_SEC = 0.1;

let engineLoop: Promise<AudioBuffer | null> | null = null;
let engineFile: (() => Promise<AudioBuffer | null>) | null = null;

/** 'files' mode: supply the engine loop from the shipped audio file (null = render it as in 'prerendered' mode). */
export function setEngineLoopFile(provider: (() => Promise<AudioBuffer | null>) | null): void {
  engineFile = provider;
}

/** Looped-buffer length and rate of the engine loop (shared with the offline file renderer). */
export const ENGINE_LOOP = { sampleRate: ENGINE_SR, seconds: ENGINE_LOOP_SEC };

/** Idle-pitch engine tone (saw + half-pitch square -> lowpass, as in EngineSound), rendered once. */
export function getEngineLoop(): Promise<AudioBuffer | null> {
  if (engineFile) {
    const fromFile = engineFile;
    return fromFile().then((b) => b ?? renderEngineLoop());
  }
  return renderEngineLoop();
}

/** Renders the loop (cached). */
export function renderEngineLoop(): Promise<AudioBuffer | null> {
  engineLoop ??= renderQueue.add(0, async () => {
    const total = ENGINE_LOOP_SEC + ENGINE_XFADE_SEC + 0.05;
    const rendered = await Tone.Offline(() => {
      const out = new Tone.Gain(1).toDestination();
      const filter = new Tone.Filter({ type: 'lowpass', frequency: 280, Q: 1.2 }).connect(out);
      const saw = new Tone.Oscillator({ type: 'sawtooth', frequency: IDLE_HZ }).connect(filter);
      const sq = new Tone.Oscillator({ type: 'square', frequency: IDLE_HZ * 0.5 });
      sq.connect(new Tone.Gain(0.5).connect(filter));
      saw.start(0);
      sq.start(0);
    }, total, 1, ENGINE_SR);
    const loop = makeSeamlessLoop(rendered.getChannelData(0), Math.round(ENGINE_LOOP_SEC * ENGINE_SR), Math.round(ENGINE_XFADE_SEC * ENGINE_SR));
    const buf = Tone.getContext().createBuffer(1, loop.length, ENGINE_SR);
    buf.getChannelData(0).set(loop);
    return buf as AudioBuffer;
  }).catch(() => null).then((b) => {
    if (!b) engineLoop = null; // allow a retry
    return b;
  });
  return engineLoop;
}

/** Engine as a looping AudioBufferSourceNode: playbackRate follows speed, gain follows the same curve as EngineSound. */
export class SampleEngineSound implements IEngineSound {
  private readonly ctx = Tone.getContext();
  private readonly out: GainNode;
  private readonly panner: StereoPannerNode;
  private src: AudioBufferSourceNode | null = null;
  private stopped = false;
  private speed = 0;
  private boost = false;
  private applied = -1;
  private appliedBoost = false;

  constructor(mixer: Mixer, pan: number, private readonly onStop: () => void) {
    this.out = this.ctx.createGain() as unknown as GainNode;
    this.out.gain.value = 0;
    this.panner = this.ctx.createStereoPanner() as unknown as StereoPannerNode;
    this.panner.pan.value = pan;
    this.out.connect(this.panner);
    Tone.connect(this.panner as never, mixer.sfxBus);
    void getEngineLoop().then((buf) => {
      if (!buf || this.stopped) return;
      try {
        const s = this.ctx.createBufferSource() as unknown as AudioBufferSourceNode;
        s.buffer = buf;
        s.loop = true;
        s.connect(this.out);
        s.start();
        this.src = s;
        this.apply(0.15);
      } catch { /* stay silent */ }
    });
  }

  private targets(): { rate: number; gain: number } {
    const s = this.speed;
    const hz = IDLE_HZ + (TOP_HZ - IDLE_HZ) * s;
    return {
      rate: (hz * (this.boost ? 1.05 : 1)) / IDLE_HZ,
      gain: 0.06 + s * 0.05 + (this.boost ? 0.04 : 0),
    };
  }

  private apply(rampSec: number): void {
    if (!this.src) return;
    const { rate, gain } = this.targets();
    const now = this.ctx.currentTime;
    const ramp = (p: AudioParam, v: number, sec: number): void => {
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
      p.linearRampToValueAtTime(v, now + sec);
    };
    ramp(this.src.playbackRate, rate, 0.08);
    ramp(this.out.gain, gain, rampSec);
    this.applied = this.speed;
    this.appliedBoost = this.boost;
  }

  set(speed: number, boost: boolean): void {
    if (this.stopped) return;
    this.speed = Math.min(1, Math.max(0, Number.isFinite(speed) ? speed : 0));
    this.boost = boost;
    if (Math.abs(this.speed - this.applied) < 0.004 && boost === this.appliedBoost) return;
    this.apply(0.1);
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.onStop();
    try {
      const now = this.ctx.currentTime;
      this.out.gain.cancelScheduledValues(now);
      this.out.gain.setValueAtTime(this.out.gain.value, now);
      this.out.gain.linearRampToValueAtTime(0, now + 0.2);
      this.src?.stop(now + 0.25);
    } catch { /* ignore */ }
    window.setTimeout(() => {
      for (const n of [this.src, this.out, this.panner]) {
        try { n?.disconnect(); } catch { /* ignore */ }
      }
      this.src = null;
    }, 500);
  }
}
