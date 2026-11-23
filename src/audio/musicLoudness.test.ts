import { expect, it } from 'vitest';
import { applyMusicGain, MUSIC_TARGET_DB, musicNormalizationGain } from './musicLoudness';

it('normalizes a quiet track with a brief peak without clipping or turning down the whole track', () => {
  const channel = new Float32Array(1_000).fill(0.08);
  channel[0] = -1;
  const gain = musicNormalizationGain([channel]);
  applyMusicGain([channel], gain);

  const meanDb = 10 * Math.log10(channel.reduce((sum, sample) => sum + sample * sample, 0) / channel.length);
  expect(meanDb).toBeGreaterThan(MUSIC_TARGET_DB - 1.5);
  expect(20 * Math.log10(Math.abs(channel[0]))).toBeLessThanOrEqual(-2.5);
  expect(channel[0]).toBeLessThan(0);
  expect(channel[1]).toBeCloseTo(0.08 * gain);
});
