/** Browser-side render API driven by scripts/renderWorkshopAudio.ts (through the AudioRenderWorkshop dev scene). */
import * as Tone from 'tone';
import { WS_LOOP_SFX, WS_MUSIC_NAMES, WS_STING_NAMES, WS_SFX_NAMES, type WsAudioKind } from '../manifest';
import type { WsMusic, WsSfx, WsSting } from '../../core/runtime';
import { fadeEdges, foldTail, makeSeamlessLoop, normalizePeak, trimSilenceLength } from './dsp';
import { MUSIC_SR, renderScore } from './music';
import { SCORES, loopBeats, loopSeconds } from './scores';
import { SFX_RECIPES, SFX_SR, STING_RECIPES, type Recipe } from './sfxRecipes';
import { Voice } from './voice';

export interface RenderJob { kind: WsAudioKind; name: string }
export interface RenderResult {
  kind: WsAudioKind;
  name: string;
  sampleRate: number;
  length: number;
  channels: number;
  loop: boolean;
  seconds: number;
  bpm?: number;
  lengthBeats?: number;
}

const MUSIC_PEAK = 0.8;
const MUSIC_TAIL_SEC = 2.5;
const LOOP_XFADE_SEC = 0.06;
const rendered = new Map<string, Float32Array[]>();

async function renderRecipe(r: Recipe): Promise<Float32Array> {
  const total = r.loop ? r.sec + LOOP_XFADE_SEC + 0.05 : r.sec;
  const buf = await Tone.Offline(() => {
    const v = new Voice(Tone.getDestination(), 1);
    r.play(v);
  }, total, 1, SFX_SR);
  const ch = buf.getChannelData(0);
  if (r.loop) return makeSeamlessLoop(ch, Math.round(r.sec * SFX_SR), Math.round(LOOP_XFADE_SEC * SFX_SR));
  const keep = trimSilenceLength([ch], 0.0008, Math.round(0.03 * SFX_SR));
  if (keep >= ch.length) console.warn('[ws-audio] may be cut off:', r.sec);
  const out = ch.slice(0, keep);
  fadeEdges(out, 16, Math.min(out.length, Math.round(0.02 * SFX_SR)));
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export const api = {
  jobs(): RenderJob[] {
    return [
      ...WS_MUSIC_NAMES.map((name): RenderJob => ({ kind: 'music', name })),
      ...WS_STING_NAMES.map((name): RenderJob => ({ kind: 'sting', name })),
      ...WS_SFX_NAMES.map((name): RenderJob => ({ kind: 'sfx', name })),
    ];
  },
  async render(job: RenderJob): Promise<RenderResult> {
    const id = `${job.kind}:${job.name}`;
    if (job.kind === 'music') {
      const score = SCORES[job.name as WsMusic]();
      const sampleLen = Math.round(loopSeconds(score) * MUSIC_SR);
      const [l, r] = await renderScore(score, MUSIC_TAIL_SEC);
      const chans = [foldTail(l, sampleLen), foldTail(r, sampleLen)];
      normalizePeak(chans, MUSIC_PEAK);
      rendered.set(id, chans);
      return { kind: 'music', name: job.name, sampleRate: MUSIC_SR, length: sampleLen, channels: 2, loop: true,
        seconds: sampleLen / MUSIC_SR, bpm: score.bpm, lengthBeats: loopBeats(score) };
    }
    const recipe = job.kind === 'sting' ? STING_RECIPES[job.name as WsSting] : SFX_RECIPES[job.name as WsSfx];
    const ch = await renderRecipe(recipe);
    normalizePeak([ch], recipe.peak);
    rendered.set(id, [ch]);
    const loop = job.kind === 'sfx' && !!recipe.loop;
    return { kind: job.kind, name: job.name, sampleRate: SFX_SR, length: ch.length, channels: 1, loop, seconds: ch.length / SFX_SR };
  },
  chunk(id: string, channel: number, start: number, count: number): string {
    const chans = rendered.get(id);
    if (!chans) throw new Error(`not rendered: ${id}`);
    const part = chans[channel].slice(start, start + count);
    return toBase64(new Uint8Array(part.buffer, part.byteOffset, part.byteLength));
  },
  release(id: string): void { rendered.delete(id); },
  loopSfx: WS_LOOP_SFX as readonly string[],
};

export type WsRenderApi = typeof api;
