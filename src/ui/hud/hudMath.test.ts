import { describe, expect, it } from 'vitest';
import {
  distanceMeters, dockZone, edgeArrow, fitScale, formatTime, isOnScreen, worldToScreen,
} from './hudMath';

describe('formatTime', () => {
  it('formats mm:ss', () => {
    expect(formatTime(300)).toBe('05:00');
    expect(formatTime(25)).toBe('00:25');
    expect(formatTime(61.2)).toBe('01:02');
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(-3)).toBe('00:00');
    expect(formatTime(125)).toBe('02:05');
  });
});

describe('worldToScreen', () => {
  it('maps with offset', () => {
    const view = { x: 1000, y: 500, w: 960, h: 1080 };
    const map = { x: 960, y: 0, w: 960, h: 1080 };
    expect(worldToScreen(1000, 500, view, map)).toEqual({ x: 960, y: 0 });
    expect(worldToScreen(1480, 1040, view, map)).toEqual({ x: 1440, y: 540 });
  });
  it('handles zoomed-out views', () => {
    const wv = { x: 0, y: 0, w: 3840, h: 2160 };
    expect(worldToScreen(1920, 1080, wv, { x: 0, y: 0, w: 1920, h: 1080 })).toEqual({ x: 960, y: 540 });
  });
});

describe('isOnScreen', () => {
  const r = { x: 0, y: 0, w: 960, h: 1080 };
  it('respects margin', () => {
    expect(isOnScreen({ x: 480, y: 540 }, r, 90)).toBe(true);
    expect(isOnScreen({ x: 40, y: 540 }, r, 90)).toBe(false);
    expect(isOnScreen({ x: -10, y: 5 }, r, 0)).toBe(false);
  });
});

describe('edgeArrow', () => {
  const r = { x: 0, y: 0, w: 1000, h: 600 };
  it('points right and sits on the right edge', () => {
    const a = edgeArrow(r, 50, { x: 500, y: 300 }, { x: 2500, y: 300 });
    expect(a.x).toBeCloseTo(950);
    expect(a.y).toBeCloseTo(300);
    expect(a.angle).toBeCloseTo(0);
  });
  it('points up and sits on the top edge', () => {
    const a = edgeArrow(r, 50, { x: 500, y: 300 }, { x: 500, y: -900 });
    expect(a.x).toBeCloseTo(500);
    expect(a.y).toBeCloseTo(50);
    expect(a.angle).toBeCloseTo(-Math.PI / 2);
  });
  it('diagonal stays inside the inset rect', () => {
    const a = edgeArrow(r, 50, { x: 500, y: 300 }, { x: 1500, y: 1300 });
    expect(a.x).toBeLessThanOrEqual(950 + 1e-6);
    expect(a.y).toBeLessThanOrEqual(550 + 1e-6);
    expect(a.angle).toBeCloseTo(Math.PI / 4);
    expect(Math.abs(a.y - 550) < 1e-6 || Math.abs(a.x - 950) < 1e-6).toBe(true);
  });
  it('degenerate direction does not give NaN', () => {
    const a = edgeArrow(r, 50, { x: 1, y: 1 }, { x: 1, y: 1 });
    expect(Number.isFinite(a.x)).toBe(true);
  });
});

describe('distanceMeters', () => {
  it('is px/32 rounded', () => {
    expect(distanceMeters(0, 0, 320, 0)).toBe(10);
    expect(distanceMeters(0, 0, 3, 4)).toBe(0);
    expect(distanceMeters(0, 0, 48, 0)).toBe(2);
  });
});

describe('dockZone', () => {
  it('keeps clear of the center scoreboard', () => {
    const p1 = dockZone({ x: 0, y: 0, w: 960, h: 1080 }, 960, 240, 20);
    const p2 = dockZone({ x: 960, y: 0, w: 960, h: 1080 }, 960, 240, 20);
    expect(p1.x + p1.w).toBeLessThanOrEqual(720);
    expect(p2.x).toBeGreaterThanOrEqual(1200);
  });
  it('single full-width view uses the left part', () => {
    const z = dockZone({ x: 0, y: 0, w: 1920, h: 1080 }, 960, 240, 20);
    expect(z.x).toBe(20);
    expect(z.x + z.w).toBeLessThanOrEqual(720);
  });
});

describe('fitScale', () => {
  it('limits by tightest axis and max', () => {
    expect(fitScale(100, 100, 200, 400, 5)).toBe(2);
    expect(fitScale(100, 100, 1000, 1000, 1.5)).toBe(1.5);
  });
});

import { perfLines } from './perfLines';
import { scoreboardLayout, breakSplitRegion, isQuadView } from './hudConfig';

describe('quad HUD', () => {
  it('perfLines shows FPS, frame ms and the top sections', () => {
    const lines = perfLines({ fps: 59.6, lowFps: 41.2, frameMs: 16.78, sections: [{ name: 'render', ms: 9.5 }, { name: 'sys:Goal', ms: 0.4 }] }, 6);
    expect(lines[0]).toBe('FPS 60  low 41');
    expect(lines[1]).toBe('frame 16.8 ms');
    expect(lines.length).toBe(4);
    expect(lines[3]).toContain('Goal');
  });
  it('scoreboard layouts: 4 players centred, 3 players in the bottom-right quadrant', () => {
    const c = scoreboardLayout(4);
    expect(c.rect.x + c.rect.w / 2).toBe(960);
    expect(c.rect.y + c.rect.h / 2).toBe(540);
    expect(c.pts.length).toBe(4);
    const t = scoreboardLayout(3);
    expect(t.rect.x).toBeGreaterThanOrEqual(960);
    expect(t.rect.y).toBeGreaterThanOrEqual(540);
    expect(t.rect.x + t.rect.w).toBeLessThanOrEqual(1920);
    expect(t.pts.length).toBe(3);
    expect(scoreboardLayout(1).pts.length).toBe(0);
    expect(scoreboardLayout(2).pts.length).toBe(2);
  });
  it('quadrant views use nearly the whole view for the break panel', () => {
    const q = { x: 0, y: 0, w: 960, h: 540 };
    expect(isQuadView(q)).toBe(true);
    expect(isQuadView({ x: 0, y: 0, w: 960, h: 1080 })).toBe(false);
    const r = breakSplitRegion(q);
    expect(r.h).toBeGreaterThan(500);
  });
});
