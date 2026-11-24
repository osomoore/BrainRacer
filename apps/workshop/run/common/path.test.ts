import { describe, expect, it } from 'vitest';
import { RoundedPath, trackVerts } from './path';

describe('RoundedPath', () => {
  const p = new RoundedPath([{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }], 100);
  it('starts and ends on the vertices', () => {
    const s = p.at(0), e = p.at(p.length);
    expect(s.x).toBeCloseTo(0); expect(s.y).toBeCloseTo(0);
    expect(e.x).toBeCloseTo(400); expect(e.y).toBeCloseTo(300);
  });
  it('turns right by 90 degrees through one corner', () => {
    expect(p.corners).toHaveLength(1);
    expect(p.corners[0].turn).toBe(1);
    expect(p.at(10).a).toBeCloseTo(0);
    expect(p.at(p.length - 10).a).toBeCloseTo(Math.PI / 2);
  });
  it('arc is shorter than the sharp corner path', () => {
    expect(p.length).toBeLessThan(700);
    expect(p.length).toBeGreaterThan(650);
  });
  it('left turns report turn -1', () => {
    const q = new RoundedPath([{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: -300 }], 100);
    expect(q.corners[0].turn).toBe(-1);
    expect(q.at(q.length - 5).a).toBeCloseTo(-Math.PI / 2, 1);
  });
});

describe('trackVerts', () => {
  for (const [w, h] of [[1920, 1080], [960, 1080]] as const) {
    it(`levels 1-3 are axis aligned with 1/4/6 corners (${w}x${h})`, () => {
      const counts = [1, 2, 3].map((lv) => {
        const v = trackVerts(w, h, lv);
        for (let i = 1; i < v.length; i++) expect(v[i].x === v[i - 1].x || v[i].y === v[i - 1].y).toBe(true);
        return new RoundedPath(v, 100).corners.length;
      });
      expect(counts).toEqual([1, 4, 6]);
    });
  }
});
