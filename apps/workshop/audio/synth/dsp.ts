/** Pure buffer helpers for the offline renders (no Tone, no DOM). Adapted from Brain Racer's bufferUtils. */

/** Number of samples to keep so trailing near-silence is dropped. */
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

/** Seamless loop for continuous sounds: the first `xfade` samples blend (equal power) with the continuation past the end. */
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

/** Peak across all channels. */
export function peakOf(channels: readonly Float32Array[]): number {
  let p = 0;
  for (const c of channels) for (let i = 0; i < c.length; i++) { const a = Math.abs(c[i]); if (a > p) p = a; }
  return p;
}

/** Scales every channel by the same factor so the peak equals `target` (linear). Returns the factor. */
export function normalizePeak(channels: readonly Float32Array[], target: number): number {
  const p = peakOf(channels);
  if (p < 1e-6) return 1;
  const g = target / p;
  for (const c of channels) for (let i = 0; i < c.length; i++) c[i] *= g;
  return g;
}

/** Short fade in/out (samples) to avoid clicks on one-shots. */
export function fadeEdges(ch: Float32Array, inSamples: number, outSamples: number): void {
  for (let i = 0; i < inSamples && i < ch.length; i++) ch[i] *= i / inSamples;
  for (let i = 0; i < outSamples && i < ch.length; i++) ch[ch.length - 1 - i] *= i / outSamples;
}
