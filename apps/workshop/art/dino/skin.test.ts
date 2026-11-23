import { describe, expect, it, vi } from 'vitest';
import { allArtJobs, artSpec, PICKS } from '../paint/jobs';
import { patternedPart, patternMarks, skinSpec, stripeMarks } from './skin';

const torso = { x0: -140, y0: -70, x1: 140, y1: 70 };

describe('seeded dino patterns', () => {
  it.each(['camo', 'glow', 'spots', 'stripes'] as const)('%s placement repeats and supports four layouts', (kind) => {
    const marks = (seed: number) => kind === 'stripes'
      ? stripeMarks(torso, seed, 1)
      : patternMarks(kind, torso, seed, 1);
    expect(marks(42)).toEqual(marks(42));
    expect(new Set([42, 43, 44, 45].map((seed) => JSON.stringify(marks(seed)))).size).toBe(4);
  });

  it('spreads glow over the torso and aims leaves backward within 15 degrees', () => {
    const glow = patternMarks('glow', torso, 42, 1);
    for (const xSign of [-1, 1]) {
      for (const ySign of [-1, 1]) {
        expect(glow.some(({ x, y }) => x * xSign > 50 && y * ySign > 20)).toBe(true);
      }
    }
    const camo = patternMarks('camo', torso, 42, 1);
    expect(camo.length).toBeGreaterThan(18);
    for (const leaf of camo) expect(Math.abs(leaf.angle - Math.PI)).toBeLessThanOrEqual(Math.PI / 12);
  });

  it('uses a fixed default per look and keeps candidate texture dimensions and origin', () => {
    const patternJobs = allArtJobs().filter((j) => j.part === 'head' && j.key.includes('head.round:color.orange:extra.glow'));
    expect(patternJobs).toHaveLength(2);
    expect(patternJobs[0].defaultPatternSeed).toBe(patternJobs[1].defaultPatternSeed);
    for (const job of patternJobs) {
      const base = artSpec(job.key)!;
      const candidateKey = job.key + ':pattern=42';
      expect(artSpec(candidateKey)).toMatchObject({ key: candidateKey, w: base.w, h: base.h, ox: base.ox, oy: base.oy });
    }
  });

  it('uses the voted layout in the rig and the same seed in the paint job', () => {
    const key = 'ws:d:head:head.round:color.orange:extra.glow:n';
    const vote = PICKS[key];
    const baseHash = allArtJobs().find((j) => j.key === key)!.specHash;
    try {
      PICKS[key] = { pick: 123, patternSeed: 42 };
      const job = allArtJobs().find((j) => j.key === key)!;
      expect(job).toMatchObject({ seed: 123, patternSeed: 42 });
      expect(job.specHash).not.toBe(baseHash);
      const draw = vi.fn();
      const canvas = {} as CanvasRenderingContext2D;
      const sk = skinSpec({ color: 'color.orange', extra: 'extra.glow' });
      const part = patternedPart(sk, { key, w: 10, h: 10, ox: 0, oy: 0, draw });
      part.draw(canvas);
      part.withPatternSeed!(43).draw(canvas);
      expect(draw.mock.calls).toEqual([[canvas, 42], [canvas, 43]]);
    } finally {
      PICKS[key] = vote;
      allArtJobs();
    }
  });
});
