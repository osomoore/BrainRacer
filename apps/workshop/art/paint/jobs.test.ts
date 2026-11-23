import { describe, expect, it } from 'vitest';
import { Q } from '../bake';
import { allArtJobs, artFile, artSpec, jobSpecHash } from './jobs';

describe('art jobs', () => {
  const jobs = allArtJobs();
  it('enumerates shape and prompt jobs with unique keys and files', () => {
    expect(jobs.filter((j) => j.kind === 'shape').length).toBeGreaterThan(100);
    expect(jobs.filter((j) => j.kind === 'prompt').length).toBeGreaterThanOrEqual(3);
    expect(new Set(jobs.map((j) => j.key)).size).toBe(jobs.length);
    expect(new Set(jobs.map((j) => j.file)).size).toBe(jobs.length);
  });
  it('covers both workshops and both views', () => {
    for (const w of ['race', 'dino']) for (const v of ['side', 'top']) expect(jobs.some((j) => j.workshop === w && j.view === v), `${w} ${v}`).toBe(true);
  });
  it('shape jobs match their PartSpec and have a deterministic spec hash', () => {
    for (const j of jobs.filter((q) => q.kind === 'shape')) {
      const s = artSpec(j.key)!;
      expect(s, j.key).toBeDefined();
      expect(j.w).toBe(Math.ceil(s.w * Q));
      expect(j.h).toBe(Math.ceil(s.h * Q));
      expect(j.specHash).toBe(jobSpecHash(j));
      expect(j.file).toBe(artFile(j.key));
    }
  });
  it('is stable between runs', () => {
    expect(allArtJobs().map((j) => j.specHash)).toEqual(jobs.map((j) => j.specHash));
  });
});
