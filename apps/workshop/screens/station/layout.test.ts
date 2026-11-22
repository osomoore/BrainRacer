import { describe, expect, it } from 'vitest';
import { WS_UI } from '../../config';
import { cameraTarget, clampIndex, modelKey, stationLayout, stripXs, windowStart, withVariant } from './layout';

describe('stationLayout', () => {
  for (const kind of ['wide', 'tall'] as const) {
    const L = stationLayout(kind);
    it(`${kind}: swatches and buttons fit inside the pane and are tappable`, () => {
      expect(L.strip.xs).toHaveLength(L.strip.visible);
      for (const x of L.strip.xs) {
        expect(x - L.strip.swatch / 2).toBeGreaterThanOrEqual(L.strip.arrowL + L.strip.arrowW / 2 - 4);
        expect(x + L.strip.swatch / 2).toBeLessThanOrEqual(L.strip.arrowR - L.strip.arrowW / 2 + 4);
      }
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

describe('strip window', () => {
  it('centers the selection and clamps at the ends', () => {
    expect(windowStart(10, 0, 5)).toBe(0);
    expect(windowStart(10, 5, 5)).toBe(3);
    expect(windowStart(10, 9, 5)).toBe(5);
    expect(windowStart(3, 2, 5)).toBe(0);
    expect(clampIndex(-1, 4)).toBe(0);
    expect(clampIndex(9, 4)).toBe(3);
    expect(clampIndex(0, 0)).toBe(0);
    expect(stripXs([100, 200, 300, 400, 500], 2)).toEqual([250, 350]);
    expect(stripXs([100, 200, 300], 3)).toEqual([100, 200, 300]);
    expect(stripXs([100, 200, 300], 1)).toEqual([200]);
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
