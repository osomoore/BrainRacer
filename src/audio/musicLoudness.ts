/** RMS target for a full song and sample-peak ceiling with headroom for Opus encoding. */
export const MUSIC_TARGET_DB = -17.5;
const PEAK_CEILING_DB = -2.5;
const PEAK_CEILING = 10 ** (PEAK_CEILING_DB / 20);
const LIMITER_KNEE = 0.63;
const LIMITER_HEADROOM = PEAK_CEILING - LIMITER_KNEE;

/** Use a fixed gain for the full track, with only the highest peaks shaped separately. */
export function musicNormalizationGain(channels: readonly Float32Array[]): number {
  let sumSquares = 0;
  let samples = 0;
  for (const channel of channels) {
    samples += channel.length;
    for (const sample of channel) {
      sumSquares += sample * sample;
    }
  }
  if (sumSquares === 0) return 1;
  const rms = Math.sqrt(sumSquares / samples);
  return 10 ** (MUSIC_TARGET_DB / 20) / rms;
}

/** Smoothly keep peaks below the ceiling, using the Web Audio waveshaper's input range. */
export function limitMusicPeak(sample: number): number {
  const magnitude = Math.min(1, Math.abs(sample));
  if (magnitude <= LIMITER_KNEE) return sample;
  const limited = LIMITER_KNEE + LIMITER_HEADROOM * Math.tanh((magnitude - LIMITER_KNEE) / LIMITER_HEADROOM);
  return Math.sign(sample) * limited;
}

export function applyMusicGain(channels: readonly Float32Array[], gain: number): void {
  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) channel[i] = limitMusicPeak(channel[i] * gain);
  }
}
