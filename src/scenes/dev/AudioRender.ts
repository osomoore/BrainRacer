import Phaser from 'phaser';
import { ENGINE_LOOP, renderEngineLoop } from '../../audio/engineSound';
import { beatsToSeconds } from '../../audio/musicTheory';
import { MUSIC_SR, MUSIC_TRACKS, renderTrackBuffer, resolveTrack } from '../../audio/musicPlayer';
import { SFX_LOOP_KEYS, SFX_NAMES, SFX_SR, renderLoop, renderOneShot, type SfxLoopKey } from '../../audio/sfx';
import type { MusicTrack, SfxName } from '../../core/types';

/**
 * Driven by scripts/renderAudio.ts (`npm run audio:render`): renders every sound with the same offline code the
 * 'prerendered' audio mode uses, and hands the PCM to Node in base64 chunks. Not meant for people.
 */
export interface RenderJob {
  id: string;
  kind: 'sfx' | 'loop' | 'engine' | 'music';
}
export interface RenderResult {
  id: string;
  kind: RenderJob['kind'];
  sampleRate: number;
  length: number;
  channels: number;
  loop: boolean;
  bpm?: number;
  lengthBeats?: number;
  loopSeconds?: number;
}

const rendered = new Map<string, AudioBuffer>();

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const api = {
  jobs(): RenderJob[] {
    return [
      ...SFX_LOOP_KEYS.map((id): RenderJob => ({ id, kind: 'loop' })),
      { id: 'engine', kind: 'engine' },
      ...SFX_NAMES.map((id): RenderJob => ({ id, kind: 'sfx' })),
      ...MUSIC_TRACKS.map((id): RenderJob => ({ id, kind: 'music' })),
    ];
  },
  async render(job: RenderJob): Promise<RenderResult> {
    let buf: AudioBuffer | null;
    const extra: Partial<RenderResult> = {};
    let loop = false;
    switch (job.kind) {
      case 'sfx': buf = await renderOneShot(job.id as SfxName); break;
      case 'loop': buf = await renderLoop(job.id as SfxLoopKey); loop = true; break;
      case 'engine': buf = await renderEngineLoop(); loop = true; break;
      case 'music': {
        const name = job.id as MusicTrack;
        const data = await resolveTrack(name);
        buf = await renderTrackBuffer(data);
        loop = data.loop;
        Object.assign(extra, { bpm: data.bpm, lengthBeats: data.lengthBeats, loopSeconds: beatsToSeconds(data.lengthBeats, data.bpm) });
        break;
      }
    }
    if (!buf) throw new Error(`render failed: ${job.id}`);
    rendered.set(job.id, buf);
    return { id: job.id, kind: job.kind, sampleRate: buf.sampleRate, length: buf.length, channels: buf.numberOfChannels, loop, ...extra };
  },
  /** Raw little-endian float32 bytes of `count` samples of one channel, base64. */
  chunk(id: string, channel: number, start: number, count: number): string {
    const buf = rendered.get(id);
    if (!buf) throw new Error(`not rendered: ${id}`);
    const part = buf.getChannelData(channel).slice(start, start + count);
    return toBase64(new Uint8Array(part.buffer, part.byteOffset, part.byteLength));
  },
  release(id: string): void { rendered.delete(id); },
  constants: { SFX_SR, MUSIC_SR, ENGINE_SR: ENGINE_LOOP.sampleRate },
};

export type AudioRenderApi = typeof api;

export default class AudioRender extends Phaser.Scene {
  constructor() { super('AudioRender'); }
  create(): void {
    (window as unknown as { __audioRender: AudioRenderApi }).__audioRender = api;
    this.add.text(40, 40, 'audio render host', { fontFamily: 'Arial', fontSize: '48px', color: '#ffffff' });
  }
}
