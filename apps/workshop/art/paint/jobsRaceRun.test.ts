import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { P, T } from '../../run/common/props';
import { Q } from '../bake';
import { allArtJobs, artSpec, FACE_NEGATIVE, PAINT_TUNE } from './jobs';
import { SIDE_SCENERY, TOP_SCENERY } from './jobsRaceRun';

const sideSkips = [
  'arch', 'bubble', 'card', 'dust', 'exclaim', 'fuel', 'ground', 'hash', 'heart', 'hills', 'leaf', 'marshalCard',
  'note', 'ramp', 'rope', 'sky', 'star', 'stars', 'zzz',
] satisfies (keyof typeof P)[];
const topSkips = ['wall'] satisfies (keyof typeof T)[];
const sideFaces = [
  'band', 'crab', 'duck', 'fish', 'frog', 'grandpa', 'gull', 'person',
  'pigeon', 'puppy', 'sheep', 'snowman', 'squirrel', 'turtle',
] satisfies (keyof typeof SIDE_SCENERY)[];
const topFaces = ['duckTop', 'squirrelTop'] satisfies (keyof typeof TOP_SCENERY)[];

describe('Race Shop run paint jobs', () => {
  const jobs = allArtJobs().filter((job) => job.key.startsWith('wsr:'));
  const byKey = new Map(jobs.map((job) => [job.key, job]));

  it('accounts for every prop drawer and every Race Shop backlog entry', () => {
    const side = [...Object.keys(SIDE_SCENERY), ...sideSkips].sort();
    const top = [...Object.keys(TOP_SCENERY), ...topSkips].sort();
    expect(side).toEqual(Object.keys(P).sort());
    expect(top).toEqual(Object.keys(T).sort());

    const doc = readFileSync(new URL('../../../../docs/WORKSHOP_PAINT_BACKLOG.md', import.meta.url), 'utf8');
    const section = doc.split('## Race Shop run scenes')[1].split('## Screens')[0];
    const entries = new Set(Array.from(section.matchAll(/`(T\.)?(\w+)`/g), ([, prefix, name]) => prefix ? `T.${name}` : name));
    expect([...entries].sort()).toEqual([...side, ...top.map((name) => `T.${name}`)].sort());
  });

  it('exports a shape job for each listed variant with its original texture key and dimensions', () => {
    const shapes = [...Object.values(SIDE_SCENERY).flat(), ...Object.values(TOP_SCENERY).flat()];
    expect(jobs).toHaveLength(shapes.length);
    for (const [spec] of shapes) {
      const job = byKey.get(spec.key);
      expect(job, spec.key).toMatchObject({
        kind: 'shape', workshop: 'race', aspect: 'run', w: Math.ceil(spec.w * Q), h: Math.ceil(spec.h * Q),
      });
      expect(artSpec(spec.key)).toBe(spec);
    }
  });

  it('uses feature protection and the gentler face recipe for people and animals', () => {
    const faceKeys = [
      ...sideFaces.flatMap((name) => SIDE_SCENERY[name].map(([spec]) => spec.key)),
      ...topFaces.flatMap((name) => TOP_SCENERY[name].map(([spec]) => spec.key)),
    ];
    expect(jobs.filter((job) => job.protect).map((job) => job.key).sort()).toEqual(faceKeys.sort());
    for (const key of faceKeys) {
      const job = byKey.get(key)!;
      expect(job).toMatchObject({
        protect: 'features', denoise: PAINT_TUNE.faceDenoise, control: PAINT_TUNE.faceControl, sticker: PAINT_TUNE.faceSticker,
      });
      expect(job.negative).toContain(FACE_NEGATIVE);
    }
  });
});
