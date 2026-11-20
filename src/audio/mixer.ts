import * as Tone from 'tone';

/** master -> compressor -> limiter -> destination; music and sfx buses feed master. */
export class Mixer {
  readonly master: Tone.Gain;
  readonly musicBus: Tone.Gain;
  readonly sfxBus: Tone.Gain;
  private readonly comp: Tone.Compressor;
  private readonly limiter: Tone.Limiter;
  private dynamicsOn = true;

  constructor() {
    this.limiter = new Tone.Limiter(-3).toDestination();
    this.comp = new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.01, release: 0.2 }).connect(this.limiter);
    this.master = new Tone.Gain(0.8).connect(this.comp);
    this.musicBus = new Tone.Gain(0.7).connect(this.master);
    this.sfxBus = new Tone.Gain(0.9).connect(this.master);
  }

  /** true: master -> comp -> limiter -> destination; false: master -> destination (cheaper). */
  setDynamics(on: boolean): void {
    if (on === this.dynamicsOn) return;
    this.dynamicsOn = on;
    this.master.disconnect();
    if (on) this.master.connect(this.comp);
    else this.master.toDestination();
  }

  setVolumes(music: number, sfx: number): void {
    const m = Math.min(1, Math.max(0, music));
    const s = Math.min(1, Math.max(0, sfx));
    this.musicBus.gain.rampTo(m * m * 0.8, 0.05);
    this.sfxBus.gain.rampTo(s * s * 1.0, 0.05);
  }
}
