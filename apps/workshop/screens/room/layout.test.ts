import { describe, expect, it } from 'vitest';
import { WS_UI } from '../../config';
import { RACE_ASPECTS } from '../../content/race/variants';
import { DINO_ASPECTS } from '../../content/dino/variants';
import { rectsOverlap, roomLayout, standOf, stepToward, walkSeconds, type LayoutKind } from './layout';

const kinds: LayoutKind[] = ['wide', 'tall'];

describe('roomLayout', () => {
  for (const kind of kinds) for (const [name, aspects] of [['race', RACE_ASPECTS], ['dino', DINO_ASPECTS]] as const) {
    const ids = aspects.map((a) => a.id);
    const L = roomLayout(kind, ids);
    it(`${kind}/${name}: ten stations, all inside the pane and tappable`, () => {
      expect(L.stations).toHaveLength(10);
      for (const s of L.stations) {
        expect(s.x - s.w / 2).toBeGreaterThanOrEqual(0);
        expect(s.x + s.w / 2).toBeLessThanOrEqual(L.size.w);
        expect(s.y - s.h / 2).toBeGreaterThanOrEqual(0);
        expect(s.y + s.h / 2).toBeLessThanOrEqual(L.size.h);
        expect(Math.min(s.w, s.h)).toBeGreaterThanOrEqual(WS_UI.tapMin);
        expect(s.stand.x).toBeGreaterThan(0); expect(s.stand.x).toBeLessThan(L.size.w);
        expect(s.stand.y).toBeGreaterThan(0); expect(s.stand.y).toBeLessThan(L.size.h);
      }
    });
    it(`${kind}/${name}: signs, board and model area never overlap`, () => {
      const rects = [...L.stations, L.board];
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(rectsOverlap(rects[i], rects[j])).toBe(false);
      const m = { x: L.model.x, y: L.model.groundY - L.model.maxH / 2, w: L.model.maxW, h: L.model.maxH };
      for (const r of rects) expect(rectsOverlap(m, r)).toBe(false);
      expect(L.board.y + L.board.h / 2).toBeLessThanOrEqual(L.size.h);
    });
  }

  it('standOf: station stand point, else the board', () => {
    const L = roomLayout('wide', RACE_ASPECTS.map((a) => a.id));
    expect(standOf(L, 'wheels')).toEqual(L.stations[0].stand);
    expect(standOf(L, 'center')).toEqual(L.board.stand);
    expect(standOf(L, undefined)).toEqual(L.board.stand);
  });

  it('walking: duration and stepping reach the target', () => {
    expect(walkSeconds({ x: 0, y: 0 }, { x: 520, y: 0 }, 520)).toBeCloseTo(1);
    let p = { x: 0, y: 0 };
    let n = 0;
    for (;;) { const r = stepToward(p, { x: 300, y: 400 }, 40); p = r.p; n++; if (r.arrived) break; }
    expect(p).toEqual({ x: 300, y: 400 });
    expect(n).toBe(13);
  });
});
