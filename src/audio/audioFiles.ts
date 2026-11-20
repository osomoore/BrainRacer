import * as Tone from 'tone';
import type { MusicTrack, SfxName } from '../core/types';
import { copyOffset, sliceExact, type AudioFileEntry, type AudioManifest } from './audioManifest';
import type { MusicFileSource } from './musicPlayer';
import type { SfxEngine, SfxLoopKey } from './sfx';

export interface FilesProgress { sfx: number; sfxTotal: number; music: number; musicTotal: number }

const baseUrl = (): string => {
  try { return import.meta.env.BASE_URL || './'; } catch { return './'; }
};

/** Fetches and decodes the shipped Ogg Opus files (public/audio) into AudioBuffers for the buffer playback paths. */
export class AudioFiles implements MusicFileSource {
  private manifest: Promise<AudioManifest | null> | null = null;
  private readonly music = new Map<string, Promise<AudioBuffer | null>>();
  private sfxLoaded = 0;
  private sfxTotal = 0;
  private musicLoaded = 0;
  private musicTotal = 0;
  private engine: Promise<AudioBuffer | null> | null = null;
  private sfxDone: Promise<boolean> | null = null;
  /** ms from the first request until each group finished (diagnostics / console). */
  readonly timings: Record<string, number> = {};
  private t0 = 0;

  get progress(): FilesProgress {
    return { sfx: this.sfxLoaded, sfxTotal: this.sfxTotal, music: this.musicLoaded, musicTotal: this.musicTotal };
  }

  private getManifest(): Promise<AudioManifest | null> {
    this.manifest ??= (async () => {
      this.t0 = performance.now();
      try {
        const res = await fetch(`${baseUrl()}audio/manifest.json`);
        if (!res.ok) return null;
        const m = (await res.json()) as AudioManifest;
        if (m.version !== 1) return null;
        this.sfxTotal = Object.keys(m.sfx).length + Object.keys(m.loops).length;
        this.musicTotal = Object.keys(m.music).length;
        return m;
      } catch {
        return null;
      }
    })();
    return this.manifest;
  }

  /** Fetch + decode one file at its source rate, then trim/pad to the exact source length (Opus padding never reaches the loop points). */
  private async decode(entry: AudioFileEntry): Promise<AudioBuffer | null> {
    try {
      const res = await fetch(`${baseUrl()}audio/${entry.file}`);
      if (!res.ok) return null;
      const bytes = await res.arrayBuffer();
      const ctx = new OfflineAudioContext(entry.channels, 1, entry.sampleRate);
      const decoded = await ctx.decodeAudioData(bytes);
      const out = Tone.getContext().createBuffer(entry.channels, entry.length, entry.sampleRate) as AudioBuffer;
      const off = copyOffset(entry);
      for (let c = 0; c < entry.channels; c++) {
        const src = decoded.getChannelData(Math.min(c, decoded.numberOfChannels - 1));
        out.getChannelData(c).set(sliceExact(src, off, entry.length));
      }
      return out;
    } catch {
      return null;
    }
  }

  async loadMusic(name: MusicTrack): Promise<AudioBuffer | null> {
    const m = await this.getManifest();
    const entry = m?.music[name];
    if (!entry) return null;
    let p = this.music.get(name);
    if (!p) {
      p = this.decode(entry).then((b) => {
        if (b) {
          this.musicLoaded++;
          if (this.musicLoaded >= this.musicTotal) this.timings.music = Math.round(performance.now() - this.t0);
        }
        return b;
      });
      this.music.set(name, p);
    }
    const b = await p;
    if (!b) this.music.delete(name);
    return b;
  }

  loadEngine(): Promise<AudioBuffer | null> {
    this.engine ??= this.getManifest().then((m) => (m ? this.decode(m.engine) : null)).then((b) => {
      if (!b) this.engine = null;
      return b;
    });
    return this.engine;
  }

  /** Decodes every sfx and loop into the engine. Resolves false when the manifest is unavailable (caller falls back to rendering). */
  loadSfx(engine: SfxEngine): Promise<boolean> {
    this.sfxDone ??= (async () => {
      const m = await this.getManifest();
      if (!m) return false;
      for (const [key, entry] of Object.entries(m.loops)) {
        const b = await this.decode(entry);
        if (b) { engine.installLoop(key as SfxLoopKey, b); this.sfxLoaded++; }
      }
      for (const [name, entry] of Object.entries(m.sfx)) {
        const b = await this.decode(entry);
        if (b) { engine.installOneShot(name as SfxName, b); this.sfxLoaded++; }
      }
      this.timings.sfx = Math.round(performance.now() - this.t0);
      console.info(`[audio] sfx files decoded: ${this.sfxLoaded}/${this.sfxTotal} in ${this.timings.sfx} ms`);
      return true;
    })();
    return this.sfxDone;
  }
}
