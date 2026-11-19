import { describe, expect, it } from 'vitest';
import { TEX } from '../core/assetKeys';
import { generateTextures } from './index';
import { allTextureKeys } from './keys';
import { roadPlan } from './roads';

/** Recursive no-op proxy standing in for CanvasRenderingContext2D. */
function fakeCtx(): unknown {
  const fn: unknown = new Proxy(function () { /* noop */ }, {
    get: (_t, p) => (p === 'addColorStop' ? () => undefined : fn),
    set: () => true,
    apply: () => fn,
  });
  return fn;
}

describe('art keys', () => {
  it('allTextureKeys covers TEX including all 16 roads and has no duplicates', () => {
    const keys = allTextureKeys();
    expect(new Set(keys).size).toBe(keys.length);
    for (let m = 0; m < 16; m++) expect(keys).toContain(`road_${m}`);
    expect(keys).toContain(TEX.carDino);
    expect(keys).toContain(TEX.roof[5]);
    expect(keys).toContain(TEX.farm.horse[1]);
    expect(keys).toContain(TEX.farm.pigTumble);
    expect(keys).not.toContain(TEX.roadPrefix);
  });

  it('generateTextures registers exactly the contract keys at the declared sizes', () => {
    const made = new Map<string, { w: number; h: number }>();
    const scene = {
      textures: {
        exists: (k: string) => made.has(k),
        remove: (k: string) => made.delete(k),
        createCanvas: (k: string, w: number, h: number) => {
          made.set(k, { w, h });
          return { getContext: () => fakeCtx(), refresh: () => undefined };
        },
      },
    };
    generateTextures(scene as never);
    expect([...made.keys()].sort()).toEqual(allTextureKeys().sort());
    expect(made.get(TEX.carDino)).toEqual({ w: 72, h: 40 });
    expect(made.get(TEX.carKart)).toEqual({ w: 60, h: 36 });
    expect(made.get('road_15')).toEqual({ w: 128, h: 128 });
    expect(made.get(TEX.goalRing)).toEqual({ w: 360, h: 360 });
    expect(made.get(TEX.signFrame)).toEqual({ w: 150, h: 150 });
    expect(made.get(TEX.farm.barn)).toEqual({ w: 384, h: 256 });
    expect(made.get(TEX.farm.cow[2])).toEqual({ w: 88, h: 52 });
    expect(made.get(TEX.farm.duckTumble)).toEqual({ w: 32, h: 26 });
    expect(made.get(TEX.farm.combine)).toEqual({ w: 150, h: 84 });
    expect(made.get(TEX.farm.campsite)).toEqual({ w: 256, h: 256 });
    expect(made.get(TEX.farm.leanTo)).toEqual({ w: 384, h: 128 });
    expect(made.get(TEX.farm.well)).toEqual({ w: 128, h: 128 });
  });

  it('roadPlan maps masks to shapes', () => {
    expect(roadPlan(0).shape).toBe('none');
    expect(roadPlan(5).shape).toBe('straight');
    expect(roadPlan(10)).toEqual({ shape: 'straight', rot: 1 });
    expect(roadPlan(3)).toEqual({ shape: 'corner', rot: 0 });
    expect(roadPlan(9)).toEqual({ shape: 'corner', rot: 3 });
    expect(roadPlan(11)).toEqual({ shape: 'tee', rot: 0 });
    expect(roadPlan(15).shape).toBe('cross');
    expect(roadPlan(8)).toEqual({ shape: 'dead', rot: 3 });
  });
});
