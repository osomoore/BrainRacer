import { describe, expect, it } from 'vitest';
import { WS_UI } from '../../config';
import { cameraTarget, clampIndex, modelKey, stationLayout, stripContentW, stripOffset, swatchLeft, withVariant } from './layout';

describe('stationLayout', () => {
  for (const kind of ['wide', 'tall'] as const) {
    const L = stationLayout(kind);
    it(`${kind}: swatches and buttons fit inside the pane and are tappable`, () => {
      if (L.strip.inset) expect(L.strip.inset).toBeGreaterThanOrEqual(L.strip.arrowW);
      expect(L.strip.arrowY + L.strip.arrowH / 2).toBeLessThanOrEqual(L.size.h);
      expect(L.strip.swatch).toBeGreaterThanOrEqual(WS_UI.tapMin);
      expect(L.strip.y + L.strip.swatch / 2).toBeLessThanOrEqual(L.size.h);
      expect(L.strip.y - L.strip.swatch / 2).toBeGreaterThanOrEqual(L.strip.bandY);
      for (const b of [L.back, L.use]) {
        expect(b.h).toBeGreaterThanOrEqual(WS_UI.tapMin);
        expect(b.x - b.w / 2).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w / 2).toBeLessThanOrEqual(L.size.w);
        expect(b.y + b.h / 2).toBeLessThanOrEqual(L.size.h);
      }
      expect(L.stage.cy).toBeGreaterThan(L.topBandH);
      expect(L.stage.cy).toBeLessThan(L.strip.bandY);
    });
  }
});

describe('strip scroll', () => {
  const g = { count: 10, swatch: 200, gap: 20, windowW: 700, peek: 0.5 };
  it('stays put while the selection and its peek are visible', () => {
    expect(stripOffset(g, 0, 0)).toBe(0);
    expect(stripOffset(g, 1, 0)).toBe(0);
  });
  it('scrolls minimally so a half neighbour shows beyond the selection', () => {
    // swatch 2 spans 460..660; right neighbour peek ends at 660 + 20 + 100 = 780
    expect(stripOffset(g, 2, 0)).toBe(80);
    // going back left: swatch 1 left 240 - 120 = 120 < 80? no, stays
    expect(stripOffset(g, 1, 80)).toBe(80);
    expect(stripOffset(g, 0, 80)).toBe(0);
    const o = stripOffset(g, 3, 0);
    expect(swatchLeft(g, 3) + g.swatch + 120 - o).toBeCloseTo(g.windowW);
  });
  it('shows no peek past the first or last swatch', () => {
    const last = stripOffset(g, 9, 0);
    expect(last).toBe(stripContentW(g) - g.windowW);
    expect(stripOffset(g, 0, last)).toBe(0);
  });
  it('keeps any selected swatch fully inside the window, from any previous offset', () => {
    for (const count of [1, 3, 5, 8, 20]) for (const windowW of [700, 960, 1660]) {
      const geo = { ...g, count, windowW };
      for (let i = 0; i < count; i++) for (const cur of [0, 100, 400, 5000]) {
        const o = stripOffset(geo, i, cur);
        const left = swatchLeft(geo, i) - o;
        if (stripContentW(geo) > windowW) {
          expect(left).toBeGreaterThanOrEqual(0);
          expect(left + geo.swatch).toBeLessThanOrEqual(windowW);
        } else {
          expect(left).toBeGreaterThanOrEqual(0);
          expect(left + geo.swatch).toBeLessThanOrEqual(windowW);
        }
      }
    }
  });
  it('centers a row that fits', () => {
    expect(stripOffset({ ...g, count: 2 }, 1, 0)).toBe(-(700 - (40 + 420)) / 2);
  });
  it('clampIndex', () => {
    expect(clampIndex(-1, 4)).toBe(0);
    expect(clampIndex(9, 4)).toBe(3);
    expect(clampIndex(0, 0)).toBe(0);
  });
});

describe('camera and models', () => {
  it('cameraTarget puts the focus point on the stage center, capped scale', () => {
    const t = cameraTarget({ x: 900, y: 700 }, 2.5, { cx: 960, cy: 500 }, 4);
    expect(900 * t.scale + t.x).toBeCloseTo(960);
    expect(700 * t.scale + t.y).toBeCloseTo(500);
    expect(cameraTarget({ x: 0, y: 0 }, 9, { cx: 0, cy: 0 }, 4).scale).toBe(4);
    expect(cameraTarget({ x: 0, y: 0 }, 0.5, { cx: 0, cy: 0 }, 4).scale).toBe(1);
  });
  it('withVariant / modelKey', () => {
    const m = { wheels: 'wheels.road', engine: 'engine.small' };
    expect(withVariant(m, 'wheels', 'wheels.mud')).toEqual({ wheels: 'wheels.mud', engine: 'engine.small' });
    expect(m.wheels).toBe('wheels.road');
    expect(modelKey(m, 'wheels')).toBe('engine.small');
  });
});
