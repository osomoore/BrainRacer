import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Q } from '../bake';
import { allArtJobs, artSpec, FACE_NEGATIVE, PAINT_TUNE } from './jobs';

const PREFIX = 'ws:dino-run:';
const FACE_PARTS = new Set(['beetle', 'frog', 'lizard', 'lizardTop', 'bird', 'fish', 'bigHead', 'friend', 'friend2']);
const backlog = readFileSync(new URL('../../../../docs/WORKSHOP_PAINT_BACKLOG.md', import.meta.url), 'utf8');
const dinoBacklog = /^## Dino Lab run scenes[^\n]*\n([\s\S]*?)(?=^## )/m.exec(backlog)![1];
const namesWithStatus = (status: string): string[] => dinoBacklog.split('\n')
  .filter((line) => line.includes(`| ${status} |`))
  .flatMap((line) => [...line.matchAll(/`([^`]+)`/g)].map((match) => match[1]));
const jobs = allArtJobs().filter((job) => job.key.startsWith(PREFIX));

// Keep the exclusions explicit. A status change in the doc alone should not silently drop an export.
const SKIPPED = [
  'p:leaf', 'p:dust', 'p:drop', 'p:snow', 'p:spark', 'p:star', 'p:heart', 'p:puff', 'p:feather',
  'p:bubble', 'p:sweat', 'p:ring', 'p:twig', 'p:snore', 'p:question', 'p:exclaim', 'px',
  'sky:*', 'edge:*', 'cap:*', 'ramp:*',
];

describe('Dino Lab scenery paint jobs', () => {
  it('covers the paint backlog and leaves the explicit skips in code', () => {
    expect(namesWithStatus('stays code').sort()).toEqual([...SKIPPED].sort());
    expect(jobs.map((job) => job.key).sort()).toEqual(namesWithStatus('job added').map((name) => PREFIX + name).sort());
    expect(new Set(jobs.map((job) => job.file)).size).toBe(jobs.length);
    for (const skip of SKIPPED) {
      const skipped = skip.endsWith('*') ? skip.slice(0, -1) : skip;
      expect(jobs.some(({ key }) => skip.endsWith('*') ? key.startsWith(PREFIX + skipped) : key === PREFIX + skipped)).toBe(false);
    }
  });

  it('uses the shape export size and protects every critter face', () => {
    for (const job of jobs) {
      const spec = artSpec(job.key)!;
      expect(spec.key).toBe(job.key);
      expect(job).toMatchObject({ kind: 'shape', w: Math.ceil(spec.w * Q), h: Math.ceil(spec.h * Q) });
      if (FACE_PARTS.has(job.part)) {
        expect(job.negative).toContain(FACE_NEGATIVE);
        expect(job).toMatchObject({
          protect: 'features', denoise: PAINT_TUNE.faceDenoise, control: PAINT_TUNE.faceControl, sticker: PAINT_TUNE.faceSticker,
        });
      } else {
        expect(job.protect).toBeUndefined();
      }
    }
  });
});
