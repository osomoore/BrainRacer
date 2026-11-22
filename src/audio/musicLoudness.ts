/** RMS target for a full song and sample-peak ceiling with headroom for Opus encoding. */
export const MUSIC_TARGET_DB = -17.5;
const PEAK_CEILING_DB = -1.5;

/** Use a fixed gain so the arrangement's dynamics survive normalization. */
export function musicNormalizationGain(channels: readonly Float32Array[]): number {
  let sumSquares = 0;
  let peak = 0;
  let samples = 0;
  for (const channel of channels) {
    samples += channel.length;
    for (const sample of channel) {
      sumSquares += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
    }
  }
  if (peak === 0) return 1;
  const rms = Math.sqrt(sumSquares / samples);
  return Math.min(10 ** (MUSIC_TARGET_DB / 20) / rms, 10 ** (PEAK_CEILING_DB / 20) / peak);
}

export function applyMusicGain(channels: readonly Float32Array[], gain: number): void {
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) channel[i] *= gain;
  }
}
