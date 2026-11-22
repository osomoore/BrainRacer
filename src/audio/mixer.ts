import * as Tone from 'tone';
import { WORLD_MUSIC } from '../config/gameConfig';
import type { MusicMix } from '../core/services';

/** master -> compressor -> limiter -> destination; music and sfx buses feed master. */
export class Mixer {
  readonly master: Tone.Gain;
  readonly musicBus: Tone.Gain;
  readonly sfxBus: Tone.Gain;
  private readonly comp: Tone.Compressor;
  private readonly limiter: Tone.Limiter;
  private readonly musicDry: Tone.Gain;
  private readonly musicQuiet: Tone.Gain;
  private dynamicsOn = true;

  constructor() {
    this.limiter = new Tone.Limiter(-3).toDestination();
    this.comp = new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.01, release: 0.2 }).connect(this.limiter);
    this.master = new Tone.Gain(0.8).connect(this.comp);
    this.musicDry = new Tone.Gain(WORLD_MUSIC.mix.normal.gain).connect(this.master);
    this.musicQuiet = new Tone.Gain(0).connect(this.master);
    const lowpass = new Tone.BiquadFilter({ type: 'lowpass', frequency: WORLD_MUSIC.quietCutoffHz, Q: 0 })
      .connect(this.musicQuiet);
    this.musicBus = new Tone.Gain(0.7).connect(this.musicDry).connect(lowpass);
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

  setMusicMix(mix: MusicMix): void {
    const { lowpass, gain } = WORLD_MUSIC.mix[mix];
    this.musicDry.gain.rampTo(lowpass ? 0 : gain, WORLD_MUSIC.mixFadeSec);
    this.musicQuiet.gain.rampTo(lowpass ? gain : 0, WORLD_MUSIC.mixFadeSec);
  }
}
