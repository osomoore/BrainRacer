import { describe, expect, it } from 'vitest';
import { DINO_VARIANTS } from '../content/dino/variants';
import { RACE_VARIANTS } from '../content/race/variants';
import type { Model } from '../core/types';
import { extentAt, insetPoly, mix, topAt } from './geom';
import * as D from './dino/looks';
import { dinoLooks, hingePos, skeleton } from './dino/skeleton';
import { raceGeom, raceLooks, topHalfWidth } from './race/geometry';
import * as R from './race/looks';

const RACE_TABLES: Record<string, Record<string, unknown>> = {
  wheels: R.WHEEL, engine: R.ENGINE, gears: R.GEAR, springs: R.SPRING, bumpers: R.BUMPER, paint: R.PAINT,
  body: R.BODY, shape: R.SHAPE, size: R.SIZE_SCALE, extra: R.EXTRA,
};
const DINO_TABLES: Record<string, Record<string, unknown>> = {
  color: D.SKIN, head: D.HEAD, teeth: D.TEETH, claws: D.CLAWS, legs: D.LEGS, move: D.MOVE_POSE,
  tail: D.TAIL, body: D.BODY, size: D.SIZE_SCALE, extra: D.EXTRA,
};

describe('look tables', () => {
  it('every race variant has a look', () => {
    for (const v of RACE_VARIANTS) expect(RACE_TABLES[v.aspect]?.[v.id], v.id).toBeDefined();
  });
  it('every dino variant has a look', () => {
    for (const v of DINO_VARIANTS) expect(DINO_TABLES[v.aspect]?.[v.id], v.id).toBeDefined();
  });
  it('look tables have no stray keys', () => {
    const ids = new Set([...RACE_VARIANTS, ...DINO_VARIANTS].map((v) => v.id));
    for (const t of [...Object.values(RACE_TABLES), ...Object.values(DINO_TABLES)]) for (const k of Object.keys(t)) expect(ids.has(k), k).toBe(true);
  });
});

describe('geometry helpers', () => {
  const sq = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
  it('topAt / extentAt', () => {
    expect(topAt(sq, 5)).toBe(0);
    expect(topAt(sq, 20)).toBeNull();
    expect(extentAt(sq, 5)).toEqual({ min: 0, max: 10 });
  });
  it('insetPoly shrinks toward the centroid', () => {
    const p = insetPoly(sq, 0.5, 0.5);
    expect(p[0]).toEqual({ x: 2.5, y: 2.5 });
  });
  it('mix', () => { expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080'); });
});

describe('race geometry', () => {
  const base = (over: Model = {}): Model => ({ wheels: 'wheels.road', springs: 'springs.soft', body: 'body.car', shape: 'shape.boxy', size: 'size.medium', ...over });
  it('every body x shape x wheel x springs combination is well formed', () => {
    for (const b of Object.keys(R.BODY)) for (const s of Object.keys(R.SHAPE)) for (const w of Object.keys(R.WHEEL)) for (const sp of Object.keys(R.SPRING)) {
      const g = raceGeom(raceLooks(base({ body: b, shape: s, wheels: w, springs: sp })));
      expect(g.roofTop).toBeLessThan(g.bottom);
      expect(g.bottom).toBeLessThan(0);
      expect(g.hubY).toBe(-R.WHEEL[w].r);
      expect(g.chassisTop(0)).toBeLessThan(g.bottom);
    }
  });
  it('lifted springs raise the body, monster wheels raise it more', () => {
    const lo = raceGeom(raceLooks(base())).bottom;
    expect(raceGeom(raceLooks(base({ springs: 'springs.lifted' }))).bottom).toBeLessThan(lo);
    expect(raceGeom(raceLooks(base({ wheels: 'wheels.monster' }))).bottom).toBeLessThan(lo);
  });
  it('size scale is monotonic', () => {
    expect(R.SIZE_SCALE['size.tiny']).toBeLessThan(R.SIZE_SCALE['size.small']);
    expect(R.SIZE_SCALE['size.small']).toBeLessThan(R.SIZE_SCALE['size.medium']);
    expect(R.SIZE_SCALE['size.medium']).toBeLessThan(R.SIZE_SCALE['size.big']);
  });
  it('top half width tapers to zero at the ends', () => {
    for (const s of Object.values(R.SHAPE)) {
      expect(topHalfWidth(60, s, 0)).toBeCloseTo(0, 5);
      expect(topHalfWidth(60, s, 0.5)).toBeGreaterThan(30);
    }
  });
});

describe('dino skeleton', () => {
  const base = (over: Model = {}): Model => ({ head: 'head.round', legs: 'legs.short', move: 'move.crawl', tail: 'tail.short', body: 'body.round', size: 'size.medium', ...over });
  it('feet reach the ground and the body stays above it, for every legs x move x body', () => {
    for (const lg of Object.keys(D.LEGS)) for (const mv of ['move.crawl', 'move.stand']) for (const b of Object.keys(D.BODY)) {
      const l = dinoLooks(base({ legs: lg, move: mv, body: b }));
      const k = skeleton(l, 40);
      for (const leg of k.legs) expect(leg.y + leg.len).toBeCloseTo(0, 5);
      expect(k.torso.y).toBeLessThan(0);
    }
  });
  it('flyers and swimmers hover above the ground', () => {
    expect(skeleton(dinoLooks(base({ move: 'move.fly' })), 40).torso.y).toBeLessThan(-100);
    expect(skeleton(dinoLooks(base({ move: 'move.swim' })), 40).torso.y).toBeLessThan(0);
  });
  it('the head sits in front of the chest, higher with a long neck', () => {
    const a = dinoLooks(base());
    const b = dinoLooks(base({ head: 'head.longNeck' }));
    const ha = hingePos(skeleton(a, 40), a.head), hb = hingePos(skeleton(b, 40), b.head);
    expect(hb.y).toBeLessThan(ha.y);
  });
});
