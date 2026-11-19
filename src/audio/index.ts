import * as Tone from 'tone';
import type { IAudio, IEngineSound } from '../core/services';
import type { MusicTrack, PlayerId, SfxName } from '../core/types';
import { EngineSound } from './engineSound';
import { Mixer } from './mixer';
import { MusicPlayer } from './musicPlayer';
import { SfxEngine } from './sfx';

const NOOP_STOP = (): void => {};

/** Engine handle that stays valid before audio is unlocked; builds the real sound lazily. */
class LazyEngine implements IEngineSound {
  private real: EngineSound | null = null;
  private stopped = false;
  private speed = 0;
  private boost = false;
  constructor(private readonly make: () => EngineSound | null, private readonly onStop: () => void) {}

  set(speed: number, boost: boolean): void {
    if (this.stopped) return;
    this.speed = speed;
    this.boost = boost;
    this.real ??= this.make();
    this.real?.set(speed, boost);
  }
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.onStop();
    this.real?.stop();
    this.real = null;
  }
  /** Called after unlock so a pre-unlock set() takes effect. */
  refresh(): void {
    if (this.stopped) return;
    this.real ??= this.make();
    this.real?.set(this.speed, this.boost);
  }
}

class AudioImpl implements IAudio {
  unlocked = false;
  private mixer: Mixer | null = null;
  private sfxEngine: SfxEngine | null = null;
  private musicPlayer: MusicPlayer | null = null;
  private readonly engines = new Map<PlayerId, LazyEngine>();
  private volumes = { music: 0.7, sfx: 0.8 };
  private pendingMusic: { track: MusicTrack | null; fade: number } | null = null;
  private unlocking: Promise<void> | null = null;

  unlock(): Promise<void> {
    if (this.unlocked) return Promise.resolve();
    this.unlocking ??= (async () => {
      try {
        await Tone.start();
        this.mixer = new Mixer();
        this.mixer.setVolumes(this.volumes.music, this.volumes.sfx);
        this.sfxEngine = new SfxEngine(this.mixer);
        this.musicPlayer = new MusicPlayer(this.mixer);
        this.unlocked = true;
        for (const e of this.engines.values()) e.refresh();
        if (this.pendingMusic) {
          this.musicPlayer.play(this.pendingMusic.track, this.pendingMusic.fade);
          this.pendingMusic = null;
        }
      } catch {
        this.unlocking = null; // allow a retry on the next gesture
      }
    })();
    return this.unlocking;
  }

  sfx(name: SfxName, opts?: { pan?: number; volume?: number; rate?: number }): void {
    if (!this.unlocked) return;
    try { this.sfxEngine?.play(name, opts); } catch { /* never throw */ }
  }

  loop(name: SfxName, opts?: { pan?: number; volume?: number }): () => void {
    if (!this.unlocked) return NOOP_STOP;
    try { return this.sfxEngine?.loop(name, opts) ?? NOOP_STOP; } catch { return NOOP_STOP; }
  }

  engine(player: PlayerId): IEngineSound {
    const existing = this.engines.get(player);
    if (existing) return existing;
    const pan = player === 0 ? -0.4 : 0.4;
    const handle = new LazyEngine(
      () => {
        if (!this.unlocked || !this.mixer) return null;
        try { return new EngineSound(this.mixer, pan, () => {}); } catch { return null; }
      },
      () => { if (this.engines.get(player) === handle) this.engines.delete(player); },
    );
    this.engines.set(player, handle);
    return handle;
  }

  music(track: MusicTrack | null, crossfadeSec = 1): void {
    if (!this.unlocked) {
      this.pendingMusic = { track, fade: crossfadeSec };
      return;
    }
    try { this.musicPlayer?.play(track, crossfadeSec); } catch { /* never throw */ }
  }

  setVolumes(music: number, sfx: number): void {
    this.volumes = { music, sfx };
    try { this.mixer?.setVolumes(music, sfx); } catch { /* ignore */ }
  }
}

export function createAudio(): IAudio {
  return new AudioImpl();
}
