import { describe, expect, it, vi } from 'vitest';
import { allArtJobs, artSpec, PICKS } from '../paint/jobs';
import { headTop } from './drawTop';
import { HEAD } from './looks';
import { patternedPart, patternMarks, type PatternedPartSpec, skinSpec, stripeMarks } from './skin';

const torso = { x0: -140, y0: -70, x1: 140, y1: 70 };

describe('seeded dino patterns', () => {
  it.each(['camo', 'glow', 'spots', 'stripes'] as const)('%s placement repeats and supports four layouts', (kind) => {
    const marks = (seed: number) => kind === 'stripes'
      ? stripeMarks(torso, seed, 1)
      : patternMarks(kind, torso, seed, 1);
    expect(marks(42)).toEqual(marks(42));
    expect(new Set([42, 43, 44, 45].map((seed) => JSON.stringify(marks(seed)))).size).toBe(4);
  });

  it('keeps neighboring stripes separated without doubles or large gaps', () => {
    for (let seed = 1; seed <= 512; seed++) {
      for (const box of [torso, { x0: -10, y0: 0, x1: 30, y1: 150 }, { x0: -250, y0: -20, x1: 18, y1: 24 }]) {
        const stripes = stripeMarks(box, seed, 1);
        const pitch = (box.x1 - box.x0) / stripes.length;
        for (let i = 1; i < stripes.length; i++) {
          const a = stripes[i - 1], b = stripes[i];
          // All drawn points lie within the horizontal envelope of the curve control points.
          const right = a.x + a.width / 2 + Math.max(0, a.bend);
          const left = b.x - Math.max(b.width / 2, b.width * 0.7 - b.bend);
          expect(left - right).toBeGreaterThan(pitch * 0.06);
          expect(b.x - b.width / 2 - (a.x + a.width / 2)).toBeLessThan(pitch * 0.85);
        }
      }
    }
  });

  it('draws each overhead round-head stripe symmetrically with room between bands', () => {
    type Point = [number, number];
    type Segment = [Point, Point, Point?];
    const sk = skinSpec({ color: 'color.orange', extra: 'extra.stripes' });
    const head: PatternedPartSpec = headTop(HEAD['head.round'], sk, 'head.round', 'teeth.flat');
    const gradient = { addColorStop() {} };
    let start: Point, current: Point;
    let path: Segment[] = [], stripes: Segment[][] = [];
    const g = {
      fillStyle: '',
      beginPath() { path = []; },
      moveTo(x: number, y: number) { start = current = [x, y]; },
      lineTo(x: number, y: number) {
        path.push([current, [x, y]]);
        current = [x, y];
      },
      quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
        path.push([current, [x, y], [cx, cy]]);
        current = [x, y];
      },
      closePath() {
        if (current[0] !== start[0] || current[1] !== start[1]) path.push([current, start]);
      },
      fill() { if (this.fillStyle === sk.look.accent) stripes.push(path); },
      createLinearGradient: () => gradient,
      createRadialGradient: () => gradient,
      fillRect() {}, ellipse() {}, stroke() {}, clip() {}, save() {}, restore() {},
    };
    const segmentKeys = (segments: Segment[], ySign: number) => {
      const pointKey = ([x, y]: Point) => JSON.stringify([x, y * ySign]);
      return segments.map(([a, b, control]) =>
        JSON.stringify([[pointKey(a), pointKey(b)].sort(), control && pointKey(control)]),
      ).sort();
    };

    const layouts = new Set<boolean>();
    for (let seed = 1; seed <= 512; seed++) {
      stripes = [];
      head.withPatternSeed!(seed).draw(g as unknown as CanvasRenderingContext2D);
      expect(stripes.length).toBeGreaterThan(1);
      const pitch = (HEAD['head.round'].len + 16) / stripes.length;
      let lastRight = -Infinity;
      for (const stripe of stripes) {
        expect(segmentKeys(stripe, 1)).toEqual(segmentKeys(stripe, -1));
        const points = stripe.flatMap(([a, b, control]) => control ? [a, b, control] : [a, b]);
        layouts.add(points.some(([, y]) => y === 0));
        const xs = points.map(([x]) => x);
        const gap = Math.min(...xs) - lastRight;
        if (Number.isFinite(gap)) {
          expect(gap).toBeGreaterThan(pitch * 0.06);
          expect(gap).toBeLessThan(pitch * 0.85);
        }
        lastRight = Math.max(...xs);
      }
    }
    expect(layouts.size).toBe(2);
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
