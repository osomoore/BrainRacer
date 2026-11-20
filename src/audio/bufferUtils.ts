/** Pure (Tone-free, Phaser-free) helpers for the pre-rendered audio mode: buffer shaping, loop math, render queue. */
import { beatsToSeconds } from './musicTheory';

/** Number of samples to keep so trailing near-silence is dropped (max |x| over all channels >= threshold). */
export function trimSilenceLength(channels: readonly Float32Array[], threshold = 0.0005, padSamples = 0): number {
  const len = channels.reduce((m, c) => Math.max(m, c.length), 0);
  let end = len;
  while (end > 0 && channels.every((c) => end > c.length || Math.abs(c[end - 1]) < threshold)) end--;
  return Math.min(len, end + Math.max(0, padSamples));
}

/** Loop-length buffer where everything rendered past `loopLen` (the tail) is mixed back onto the start. */
export function foldTail(src: Float32Array, loopLen: number): Float32Array {
  const out = new Float32Array(loopLen);
  const n = Math.min(src.length, loopLen);
  out.set(src.subarray(0, n));
  for (let i = loopLen; i < src.length; i++) out[(i - loopLen) % loopLen] += src[i];
  return out;
}

/**
 * Seamless loop for continuous (non-periodic-safe) sounds: `src` holds at least loopLen + xfade samples.
 * The first `xfade` samples are an equal-power blend of the start and the continuation past the loop end,
 * so the jump from the last sample back to the first is continuous.
 */
export function makeSeamlessLoop(src: Float32Array, loopLen: number, xfade: number): Float32Array {
  const out = new Float32Array(loopLen);
  out.set(src.subarray(0, loopLen));
  const x = Math.min(xfade, Math.max(0, src.length - loopLen), loopLen);
  for (let i = 0; i < x; i++) {
    const w = (i / x) * Math.PI / 2;
    out[i] = src[i] * Math.sin(w) + src[loopLen + i] * Math.cos(w);
  }
  return out;
}

/** Offset in seconds into a looping buffer for a phase expressed in beats. */
export function loopOffsetSec(phaseBeats: number, bpm: number, lengthBeats: number): number {
  const p = ((phaseBeats % lengthBeats) + lengthBeats) % lengthBeats;
  return beatsToSeconds(p, bpm);
}

interface Task { pri: number; seq: number; run: () => Promise<unknown>; resolve: (v: unknown) => void; reject: (e: unknown) => void }

/** Runs async render jobs one at a time (lower priority number first, FIFO within), yielding between jobs. */
export class RenderQueue {
  private readonly q: Task[] = [];
  private running = false;
  private seq = 0;

  get pending(): number { return this.q.length + (this.running ? 1 : 0); }

  add<T>(priority: number, run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.q.push({ pri: priority, seq: this.seq++, run, resolve: resolve as (v: unknown) => void, reject });
      void this.pump();
    });
  }

  private async pump(): Promise<void> {
    if (this.running) return;
    this.running = true;
    while (this.q.length > 0) {
      this.q.sort((a, b) => a.pri - b.pri || a.seq - b.seq);
      const t = this.q.shift()!;
      try { t.resolve(await t.run()); } catch (e) { t.reject(e); }
      if (this.q.length > 0) await new Promise<void>((r) => setTimeout(r, 0));
    }
    this.running = false;
  }
}

export const renderQueue = new RenderQueue();

export interface RenderChunk {
  /** First output sample this chunk contributes. */
  start: number;
  /** One past the last output sample. */
  end: number;
  /** First sample actually rendered (earlier than `start` by up to the lead, so notes already ringing are included). */
  winStart: number;
}

/**
 * Splits a long offline render into chunks. Rendering a whole track in one OfflineAudioContext keeps every
 * scheduled note in the graph for the entire render, which costs O(notes x length); small windows are much cheaper.
 */
export function planChunks(totalSamples: number, chunkSamples: number, leadSamples: number): RenderChunk[] {
  const out: RenderChunk[] = [];
  for (let start = 0; start < totalSamples; start += chunkSamples) {
    out.push({ start, end: Math.min(totalSamples, start + chunkSamples), winStart: Math.max(0, start - leadSamples) });
  }
  return out;
}
