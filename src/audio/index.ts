import * as Tone from 'tone';
import type { AudioLoopOptions, IAudio, IEngineSound, MusicMix } from '../core/services';
import type { MusicTrack, PlayerId, SfxName } from '../core/types';
import { getTuning, onTuningChange } from '../config/deviceTuning';
import { renderQueue } from './bufferUtils';
import { AudioFiles } from './audioFiles';
import { EngineSound, LiteEngineSound, SampleEngineSound, setEngineLoopFile } from './engineSound';
import { Mixer } from './mixer';
import { MusicPlayer } from './musicPlayer';
import { SFX_BUFFER_TOTAL, SfxEngine } from './sfx';

const NOOP_STOP = (): void => {};

/** Engine handle that stays valid before audio is unlocked; builds the real sound lazily. */
class LazyEngine implements IEngineSound {
  private real: IEngineSound | null = null;
  private stopped = false;
  private speed = 0;
  private boost = false;
  constructor(private readonly make: () => IEngineSound | null, private readonly onStop: () => void) {}

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
  /** Tuning changed (engine mode): drop the real engine and rebuild per the new mode. */
  reset(): void {
    if (this.stopped) return;
    try { this.real?.stop(); } catch { /* ignore */ }
    this.real = null;
    this.refresh();
  }
  /** Called after unlock so a pre-unlock set() takes effect. */
  refresh(): void {
    if (this.stopped) return;
    this.real ??= this.make();
    this.real?.set(this.speed, this.boost);
  }
}

export interface AudioDiagnostics {
  state: string;
  sampleRate: number;
  baseLatency: number;
  outputLatency: number;
  lookAhead: number;
  /** Audio-clock advance / wall-clock advance over the last ~1 s (1.00 healthy, lower = starving). */
  clockRatio: number;
  /** Count of 1 s windows with ratio < 0.5 while the page was visible. */
  stalls: number;
  activeSfx: number;
  engineMode: string;
  audioMode: string;
  /** Pre-rendered sfx buffers ready / total (one-shots + loops). */
  sfxReady: number;
  sfxTotal: number;
  /** Pre-rendered music tracks cached / total. */
  musicCached: number;
  musicTotal: number;
  /** An offline render job is queued or running. */
  rendering: boolean;
  /** 'files' mode: decoded sfx files / total and music files / total. */
  filesSfx: number;
  filesSfxTotal: number;
  filesMusic: number;
  filesMusicTotal: number;
}

let activeImpl: AudioImpl | null = null;

/** Safe to call at any time (before unlock returns idle values). */
export function audioDiagnostics(): AudioDiagnostics {
  return activeImpl?.diagnostics() ?? {
    state: 'locked', sampleRate: 0, baseLatency: 0, outputLatency: 0,
    lookAhead: getTuning().lookAheadSec, clockRatio: 1, stalls: 0, activeSfx: 0, engineMode: getTuning().engineSound,
    audioMode: getTuning().audioMode, sfxReady: 0, sfxTotal: SFX_BUFFER_TOTAL, musicCached: 0, musicTotal: MusicPlayer.TRACK_COUNT, rendering: false,
    filesSfx: 0, filesSfxTotal: 0, filesMusic: 0, filesMusicTotal: 0,
  };
}

class AudioImpl implements IAudio {
  unlocked = false;
  private mixer: Mixer | null = null;
  private sfxEngine: SfxEngine | null = null;
  private musicPlayer: MusicPlayer | null = null;
  private readonly engines = new Map<PlayerId, LazyEngine>();
  private volumes = { music: 0.7, sfx: 0.8 };
  private musicMix: MusicMix = 'normal';
  private pendingMusic: { track: MusicTrack | null; fade: number } | null = null;
  private unlocking: Promise<void> | null = null;

  private clockRatio = 1;
  private stalls = 0;
  private monitorStarted = false;

  constructor() {
    activeImpl = this;
    onTuningChange((t) => {
      try {
        this.mixer?.setDynamics(t.compressor);
        this.mixer?.setEngineLevel(t.engineLevel);
        if (this.unlocked) Tone.getContext().lookAhead = t.lookAheadSec;
      } catch { /* ignore */ }
      if (this.unlocked && t.audioMode !== this.audioMode) {
        this.audioMode = t.audioMode;
        this.applyAudioMode();
      }
      if (t.engineSound !== this.engineMode) {
        this.engineMode = t.engineSound;
        for (const e of this.engines.values()) e.reset();
      }
    });
    // iOS: play like media, so the ringer/silent switch doesn't mute Web Audio (Safari 16.4+; ignored elsewhere).
    try {
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session) session.type = 'playback';
    } catch { /* ignore */ }
    // Browsers only let audio start inside a "user activation" gesture. For touch that is pointerup /
    // touchend / click, NOT pointerdown (a touch pointerdown never qualifies), so listen to all of them.
    const retry = (): void => {
      if (this.unlocked) { this.tryResume(); return; }
      if (!this.unlocking) { void this.unlock(); return; }
      // An unlock started outside a valid gesture is still waiting on Tone.start(); resuming the
      // context now (inside a real gesture) lets that pending start complete.
      try {
        const raw = Tone.getContext().rawContext as AudioContext;
        if (raw.state !== 'running') void Promise.resolve(raw.resume()).catch(() => {});
      } catch { /* ignore */ }
    };
    try {
      document.addEventListener('visibilitychange', () => { if (!document.hidden && this.unlocked) retry(); });
      for (const ev of ['keydown', 'pointerdown', 'pointerup', 'touchend', 'click']) window.addEventListener(ev, retry, true);
    } catch { /* ignore */ }
  }

  private engineMode = getTuning().engineSound;
  private audioMode = getTuning().audioMode;

  /** Pre-rendered mode: title music first, then sfx, then the other tracks, one render at a time. Live: stop using buffers. */
  private applyAudioMode(): void {
    const mode = this.audioMode;
    try {
      if (mode === 'files') {
        const files = (this.files ??= new AudioFiles());
        setEngineLoopFile(() => files.loadEngine());
        this.musicPlayer?.setPrerendered(true, files);
        const sfx = this.sfxEngine;
        if (sfx) {
          sfx.setPrerendered(true, false);
          // no manifest (files not shipped / fetch failed): render the sfx offline instead
          void files.loadSfx(sfx).then((ok) => { if (!ok && this.audioMode === 'files') sfx.setPrerendered(true); });
        }
      } else {
        setEngineLoopFile(null);
        this.musicPlayer?.setPrerendered(mode === 'prerendered');
        this.sfxEngine?.setPrerendered(mode === 'prerendered');
      }
    } catch { /* never throw */ }
  }
  private files: AudioFiles | null = null;

  private raw(): AudioContext | null {
    try { return Tone.getContext().rawContext as unknown as AudioContext; } catch { return null; }
  }

  /** Resume a suspended/interrupted context. Never throws. */
  private tryResume(): void {
    if (!this.unlocked) return;
    try {
      const ctx = this.raw();
      if (ctx && ctx.state !== 'running' && !document.hidden) void Promise.resolve(ctx.resume()).catch(() => {});
    } catch { /* ignore */ }
  }

  private startMonitor(): void {
    if (this.monitorStarted) return;
    this.monitorStarted = true;
    const ctx = this.raw();
    if (!ctx) return;
    try { ctx.addEventListener('statechange', () => this.tryResume()); } catch { /* ignore */ }
    let lastAudio = ctx.currentTime;
    let lastWall = performance.now();
    window.setInterval(() => {
      const c = this.raw();
      if (!c) return;
      const a = c.currentTime, w = performance.now();
      const dw = (w - lastWall) / 1000, da = a - lastAudio;
      lastAudio = a; lastWall = w;
      if (document.hidden || dw <= 0) return;
      this.clockRatio = da / dw;
      if (this.clockRatio < 0.5) this.stalls++;
      if (c.state !== 'running') this.tryResume();
    }, 1000);
  }

  diagnostics(): AudioDiagnostics {
    const ctx = this.unlocked ? this.raw() : null;
    return {
      state: ctx ? ctx.state : 'locked',
      sampleRate: ctx?.sampleRate ?? 0,
      baseLatency: ctx?.baseLatency ?? 0,
      outputLatency: ctx?.outputLatency ?? 0,
      lookAhead: this.unlocked ? Tone.getContext().lookAhead : getTuning().lookAheadSec,
      clockRatio: this.clockRatio,
      stalls: this.stalls,
      activeSfx: this.sfxEngine?.activeVoices ?? 0,
      engineMode: this.engineMode,
      audioMode: getTuning().audioMode,
      sfxReady: this.sfxEngine?.readyCount ?? 0,
      sfxTotal: SFX_BUFFER_TOTAL,
      musicCached: this.musicPlayer?.cachedCount ?? 0,
      musicTotal: MusicPlayer.TRACK_COUNT,
      rendering: renderQueue.pending > 0,
      filesSfx: this.files?.progress.sfx ?? 0,
      filesSfxTotal: this.files?.progress.sfxTotal ?? 0,
      filesMusic: this.files?.progress.music ?? 0,
      filesMusicTotal: this.files?.progress.musicTotal ?? 0,
    };
  }

  unlock(): Promise<void> {
    if (this.unlocked) return Promise.resolve();
    this.unlocking ??= (async () => {
      try {
        const tuning = getTuning();
        if (tuning.audioLatency !== 'interactive') {
          Tone.setContext(new Tone.Context({ latencyHint: tuning.audioLatency, lookAhead: tuning.lookAheadSec }));
        } else {
          Tone.getContext().lookAhead = tuning.lookAheadSec;
        }
        await Tone.start();
        this.mixer = new Mixer(tuning.engineLevel);
        this.mixer.setDynamics(tuning.compressor);
        this.mixer.setVolumes(this.volumes.music, this.volumes.sfx);
        this.mixer.setMusicMix(this.musicMix);
        this.sfxEngine = new SfxEngine(this.mixer);
        this.musicPlayer = new MusicPlayer(this.mixer);
        this.unlocked = true;
        this.audioMode = tuning.audioMode;
        if (tuning.audioMode !== 'live') this.applyAudioMode();
        this.startMonitor();
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

  loop(name: SfxName, opts?: AudioLoopOptions): () => void {
    if (!this.unlocked) return NOOP_STOP;
    try { return this.sfxEngine?.loop(name, opts) ?? NOOP_STOP; } catch { return NOOP_STOP; }
  }

  engine(player: PlayerId): IEngineSound {
    const existing = this.engines.get(player);
    if (existing) return existing;
    const pan = player % 2 === 0 ? -0.4 : 0.4;
    const handle = new LazyEngine(
      () => {
        if (!this.unlocked || !this.mixer) return null;
        const mode = getTuning().engineSound;
        if (mode === 'off') return null;
        try {
          if (mode === 'sample') return new SampleEngineSound(this.mixer, pan, () => {});
          return mode === 'lite' ? new LiteEngineSound(this.mixer, pan, () => {}) : new EngineSound(this.mixer, pan, () => {});
        } catch { return null; }
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

  setMusicMix(mix: MusicMix): void {
    if (this.musicMix === mix) return;
    this.musicMix = mix;
    try { this.mixer?.setMusicMix(mix); } catch { /* ignore */ }
  }

  setVolumes(music: number, sfx: number): void {
    this.volumes = { music, sfx };
    try { this.mixer?.setVolumes(music, sfx); } catch { /* ignore */ }
  }
}

export function createAudio(): IAudio {
  return new AudioImpl();
}
