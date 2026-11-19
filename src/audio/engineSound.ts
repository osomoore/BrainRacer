import * as Tone from 'tone';
import type { IEngineSound } from '../core/services';
import type { Mixer } from './mixer';

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
    this.filter.frequency.rampTo(280 + s * 900 + (boost ? 700 : 0), ramp);
    this.brightGain.gain.rampTo(boost ? 0.55 : 0, 0.1);
    this.wobble.amplitude.rampTo(1 - s * 0.85, 0.2);
    this.wobble.frequency.rampTo(6 + s * 8, 0.2);
    this.out.gain.rampTo(0.06 + s * 0.05, 0.1);
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
