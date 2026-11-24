/**
 * Adventure Workshop audio runtime: plays the pre-rendered Ogg Opus files in public/audio/workshop (no live synthesis,
 * so weak TV boxes cope). `preloadWorkshopAudio` queues the manifest and files through Phaser's loader (as raw binary,
 * so Phaser's own codec sniffing never blocks Opus); `createWorkshopAudio` decodes them with the game's WebAudio
 * context and returns the `WorkshopAudio` the panes use. Everything degrades to silence when audio is locked or missing.
 */
import type Phaser from 'phaser';
import { WS_AUDIO } from '../config';
import type { WorkshopAudio, WsMusic, WsSfx } from '../core/runtime';
import {
  WS_MUSIC_NAMES, WS_SFX_NAMES, WS_STING_NAMES, copyStartSec, wsAudioKey,
  type WsAudioEntry, type WsAudioKind, type WsAudioManifest,
} from './manifest';

const BASE = 'audio/workshop/';
const MANIFEST_KEY = 'ws-audio-manifest';
const binKey = (kind: WsAudioKind, name: string): string => `ws-audio-${kind}-${name}`;

export function preloadWorkshopAudio(scene: Phaser.Scene): void {
  const load = scene.load;
  const prev = load.path;
  load.setPath('');
  load.json(MANIFEST_KEY, `${BASE}manifest.json`);
  const files: [WsAudioKind, readonly string[]][] = [['music', WS_MUSIC_NAMES], ['sting', WS_STING_NAMES], ['sfx', WS_SFX_NAMES]];
  for (const [kind, names] of files) for (const n of names) load.binary(binKey(kind, n), `${BASE}${kind}/${n}.ogg`);
  load.setPath(prev);
}

const silent: WorkshopAudio = { music() {}, sfx() {}, sting() {}, loop: () => () => {} };

interface Clip { buffer: AudioBuffer; entry: WsAudioEntry }

interface Playing { src: AudioBufferSourceNode; gain: GainNode }

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export function createWorkshopAudio(game: Phaser.Game): WorkshopAudio {
  const sm = game.sound as unknown as { context?: AudioContext; masterVolumeNode?: GainNode };
  const ctx = sm.context;
  if (!ctx || typeof ctx.createGain !== 'function') return silent;

  const manifest = game.cache.json.get(MANIFEST_KEY) as WsAudioManifest | undefined;
  if (!manifest || manifest.version !== 1) return silent;

  const out = ctx.createGain();
  out.connect(sm.masterVolumeNode ?? ctx.destination);
  const musicBus = ctx.createGain();
  musicBus.gain.value = WS_AUDIO.musicVolume;
  musicBus.connect(out);
  const sfxBus = ctx.createGain();
  sfxBus.gain.value = WS_AUDIO.sfxVolume;
  sfxBus.connect(out);

  // ---- unlock on the first gesture (mobile browsers keep the context suspended until then)
  const events = ['pointerup', 'touchend', 'keydown', 'mouseup'] as const;
  const tryResume = (): void => {
    if (ctx.state === 'running') { detach(); return; }
    void ctx.resume().then(() => { if (ctx.state === 'running') detach(); }).catch(() => {});
  };
  const detach = (): void => { for (const e of events) window.removeEventListener(e, tryResume, true); };
  for (const e of events) window.addEventListener(e, tryResume, true);

  // ---- decode every file in the background; playback requests for files not ready yet are simply dropped (music is remembered)
  const clips = new Map<string, Clip>();
  let wantedMusic: WsMusic | null = null;
  const decodeAll = async (): Promise<void> => {
    for (const [key, entry] of Object.entries(manifest.files)) {
      const raw = game.cache.binary.get(binKey(entry.kind, key.slice(key.indexOf(':') + 1))) as ArrayBuffer | undefined;
      if (!raw) continue;
      try {
        const buffer = await ctx.decodeAudioData(raw.slice(0));
        clips.set(key, { buffer, entry });
        if (entry.kind === 'music' && key === wsAudioKey('music', wantedMusic ?? '')) startMusic(wantedMusic!);
      } catch { /* unsupported codec: that sound stays silent */ }
    }
  };
  void decodeAll();

  const now = (): number => ctx.currentTime;

  function play(clip: Clip, dest: AudioNode, opts: { volume?: number; rate?: number; pan?: number; loop?: boolean; fadeIn?: number }): Playing {
    const src = ctx!.createBufferSource();
    src.buffer = clip.buffer;
    src.playbackRate.value = clamp(opts.rate ?? 1, 0.25, 4);
    const start = copyStartSec(clip.entry);
    const secs = clip.entry.seconds;
    if (opts.loop) {
      src.loop = true;
      src.loopStart = start;
      src.loopEnd = start + secs;
    }
    const gain = ctx!.createGain();
    const vol = clamp(opts.volume ?? 1, 0, 2);
    if (opts.fadeIn) {
      gain.gain.setValueAtTime(0, now());
      gain.gain.linearRampToValueAtTime(vol, now() + opts.fadeIn);
    } else gain.gain.value = vol;
    src.connect(gain);
    let tail: AudioNode = gain;
    if (opts.pan && typeof ctx!.createStereoPanner === 'function') {
      const p = ctx!.createStereoPanner();
      p.pan.value = clamp(opts.pan, -1, 1);
      gain.connect(p);
      tail = p;
    }
    tail.connect(dest);
    if (opts.loop) src.start(0, start);
    else src.start(0, start, secs);
    src.onended = () => { try { src.disconnect(); gain.disconnect(); tail.disconnect(); } catch { /* gone */ } };
    return { src, gain };
  }

  // ---- music
  let currentMusic: WsMusic | null = null;
  let musicNow: Playing | null = null;

  function fadeOutAndStop(p: Playing, sec: number): void {
    const t = now();
    try {
      p.gain.gain.cancelScheduledValues(t);
      p.gain.gain.setValueAtTime(p.gain.gain.value, t);
      p.gain.gain.linearRampToValueAtTime(0, t + sec);
      p.src.stop(t + sec + 0.05);
    } catch { /* already stopped */ }
  }

  function startMusic(track: WsMusic): void {
    const clip = clips.get(wsAudioKey('music', track));
    if (!clip) return;
    if (musicNow) fadeOutAndStop(musicNow, WS_AUDIO.musicFadeSec);
    currentMusic = track;
    musicNow = play(clip, musicBus, { loop: true, fadeIn: WS_AUDIO.musicFadeSec });
  }

  // ---- sfx voices
  const active = new Map<string, number>();
  const lastStart = new Map<string, number>();
  let activeTotal = 0;

  function playSfx(name: WsSfx, opts: { volume?: number; rate?: number; pan?: number; loop?: boolean }): Playing | null {
    const clip = clips.get(wsAudioKey('sfx', name));
    if (!clip) return null;
    const t = now();
    if (!opts.loop) {
      if (t - (lastStart.get(name) ?? -1) < WS_AUDIO.minReplayGapSec) return null;
      if ((active.get(name) ?? 0) >= WS_AUDIO.maxVoicesPerSfx || activeTotal >= WS_AUDIO.maxVoicesTotal) return null;
    }
    lastStart.set(name, t);
    const p = play(clip, sfxBus, opts);
    active.set(name, (active.get(name) ?? 0) + 1);
    activeTotal++;
    const prevEnd = p.src.onended;
    p.src.onended = (ev) => {
      active.set(name, Math.max(0, (active.get(name) ?? 1) - 1));
      activeTotal = Math.max(0, activeTotal - 1);
      prevEnd?.call(p.src, ev);
    };
    return p;
  }

  // ---- sting ducking
  function duck(seconds: number): void {
    const t = now();
    const g = musicBus.gain;
    const full = WS_AUDIO.musicVolume;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(full * WS_AUDIO.duckLevel, t + WS_AUDIO.duckAttackSec);
    g.setValueAtTime(full * WS_AUDIO.duckLevel, t + seconds);
    g.linearRampToValueAtTime(full, t + seconds + WS_AUDIO.duckReleaseSec);
  }

  return {
    music(track) {
      if (track === currentMusic && (track === null || musicNow)) { wantedMusic = track; return; }
      wantedMusic = track;
      if (track === null) {
        if (musicNow) fadeOutAndStop(musicNow, WS_AUDIO.musicFadeSec);
        musicNow = null;
        currentMusic = null;
        return;
      }
      if (clips.has(wsAudioKey('music', track))) startMusic(track);
      else { currentMusic = null; if (musicNow) { fadeOutAndStop(musicNow, WS_AUDIO.musicFadeSec); musicNow = null; } }
    },
    sfx(name, opts) {
      playSfx(name, opts ?? {});
    },
    sting(name) {
      const clip = clips.get(wsAudioKey('sting', name));
      if (!clip) return;
      duck(clip.entry.seconds);
      play(clip, sfxBus, { volume: 1 });
    },
    loop(name, opts) {
      const p = playSfx(name, { ...opts, loop: true });
      if (!p) return () => {};
      let stopped = false;
      return () => {
        if (stopped) return;
        stopped = true;
        fadeOutAndStop(p, 0.06);
      };
    },
  };
}
