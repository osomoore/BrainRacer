import { describe, expect, it } from 'vitest';
import { CAMERA, GAME_HEIGHT as H, GAME_WIDTH as W } from '../config/gameConfig';
import {
  SplitController, clampCenter, clampLookToSlack, ease, fitZoom, lookTarget, nextSplit, playerViewsFor,
  screenConsistentCenter, shakeFalloff, speedZoomOut, splitViewports,
} from './cameraMath';

const pad = CAMERA.mergePadding;

describe('fitZoom', () => {
  it('is capped at maxZoom when cars are close', () => {
    expect(fitZoom({ x: 0, y: 0 }, { x: 100, y: 50 }, pad, W, H, 1)).toBe(1);
  });
  it('fits horizontal separation', () => {
    const z = fitZoom({ x: 0, y: 0 }, { x: 3000, y: 0 }, pad, W, H, 1);
    expect(z).toBeCloseTo(W / (3000 + 2 * pad));
  });
  it('fits vertical separation (limiting axis)', () => {
    const z = fitZoom({ x: 0, y: 0 }, { x: 0, y: 1500 }, pad, W, H, 1);
    expect(z).toBeCloseTo(H / (1500 + 2 * pad));
  });
  it('both cars stay in view at the fit zoom', () => {
    const a = { x: 100, y: 200 }, b = { x: 2300, y: 900 };
    const z = fitZoom(a, b, pad, W, H, 1);
    const halfW = W / 2 / z, halfH = H / 2 / z, mid = { x: 1200, y: 550 };
    for (const p of [a, b]) {
      expect(Math.abs(p.x - mid.x) + pad).toBeLessThanOrEqual(halfW + 1e-6);
      expect(Math.abs(p.y - mid.y) + pad).toBeLessThanOrEqual(halfH + 1e-6);
    }
  });
});

describe('hysteresis', () => {
  it('splits below min and re-merges only above min + hysteresis', () => {
    expect(nextSplit(false, CAMERA.minMergedZoom - 0.01, CAMERA)).toBe(true);
    expect(nextSplit(false, CAMERA.minMergedZoom + 0.01, CAMERA)).toBe(false);
    expect(nextSplit(true, CAMERA.minMergedZoom + 0.01, CAMERA)).toBe(true);
    expect(nextSplit(true, CAMERA.minMergedZoom + CAMERA.splitHysteresis + 0.01, CAMERA)).toBe(false);
  });

  it('does not flicker when the needed zoom jitters around the split threshold', () => {
    const c = new SplitController(2, CAMERA);
    c.reset(1);
    let flips = 0, prev = c.split;
    for (let i = 0; i < 600; i++) {
      const jitter = Math.sin(i * 1.7) * (CAMERA.splitHysteresis * 0.45);
      c.step(CAMERA.minMergedZoom + CAMERA.splitHysteresis / 2 + jitter - (i > 10 ? 0.04 : 0), 1 / 60);
      if (c.split !== prev) { flips++; prev = c.split; }
    }
    expect(flips).toBeLessThanOrEqual(1);
  });

  it('split zoom sits between the split and the re-merge thresholds (consistent scale)', () => {
    expect(CAMERA.splitZoom).toBeGreaterThanOrEqual(CAMERA.minMergedZoom);
    expect(CAMERA.splitZoom).toBeLessThanOrEqual(CAMERA.minMergedZoom + CAMERA.splitHysteresis + 0.05);
  });
});

describe('SplitController', () => {
  it('1 player is always single and never splits', () => {
    const c = new SplitController(1, CAMERA);
    c.reset(0.1);
    expect(c.mode).toBe('single');
    c.step(0.1, 1);
    expect(c.mode).toBe('single');
    expect(c.amount).toBe(0);
  });

  it('reset snaps without a transition', () => {
    const c = new SplitController(2, CAMERA);
    c.reset(0.3);
    expect(c.mode).toBe('split');
    expect(c.amount).toBe(1);
    c.reset(0.95);
    expect(c.mode).toBe('merged');
    expect(c.amount).toBe(0);
  });

  it('transition takes transitionSec and reports split only at the end', () => {
    const c = new SplitController(2, CAMERA);
    c.reset(1);
    const dt = 1 / 60;
    c.step(0.3, dt);
    expect(c.transitioning).toBe(true);
    let t = dt;
    while (c.amount < 1 && t < 5) {
      expect(c.mode).toBe('merged');
      c.step(0.3, dt);
      t += dt;
    }
    expect(Math.abs(t - CAMERA.transitionSec)).toBeLessThanOrEqual(dt + 1e-9);
    expect(c.amount).toBe(1);
    expect(c.mode).toBe('split');
    // merging reports 'merged' immediately
    c.step(1, dt);
    expect(c.mode).toBe('merged');
    expect(c.transitioning).toBe(true);
  });

  it('reverses smoothly mid-transition', () => {
    const c = new SplitController(2, CAMERA);
    c.reset(1);
    for (let i = 0; i < 6; i++) c.step(0.3, 1 / 60);
    const mid = c.amount;
    c.step(0.99, 1 / 60);
    expect(c.amount).toBeLessThan(mid);
    expect(c.amount).toBeGreaterThan(0);
  });
});

describe('transition geometry', () => {
  it('ease endpoints', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(-1)).toBe(0);
    expect(ease(0.5)).toBeCloseTo(0.5);
  });

  it('viewports at endpoints and abutting in between', () => {
    expect(splitViewports(0, W, H)).toEqual({ main: { x: 0, y: 0, w: W, h: H }, second: { x: W, y: 0, w: 0, h: H } });
    expect(splitViewports(1, W, H)).toEqual({ main: { x: 0, y: 0, w: W / 2, h: H }, second: { x: W / 2, y: 0, w: W / 2, h: H } });
    for (const e of [0.1, 0.33, 0.77]) {
      const v = splitViewports(e, W, H);
      expect(v.main.w + v.second.w).toBe(W);
      expect(v.second.x).toBe(v.main.w);
    }
  });

  it('screen-consistent center reproduces the merged view at the start of a transition', () => {
    const mc = { x: 1000, y: 500 }, z = 0.7;
    const full = screenConsistentCenter(mc, { x: 0, y: 0, w: W, h: H }, z, W, H);
    expect(full).toEqual(mc);
    // a right-half viewport shows the world right of the merged center
    const right = screenConsistentCenter(mc, { x: W / 2, y: 0, w: W / 2, h: H }, z, W, H);
    expect(right.x).toBeCloseTo(mc.x + W / 4 / z);
    // a world point maps to the same screen x through both cameras
    const wp = 1400;
    const screenFull = (wp - mc.x) * z + W / 2;
    const screenRight = (wp - right.x) * z + (W / 2 + W / 4);
    expect(screenRight).toBeCloseTo(screenFull);
  });
});

describe('helpers', () => {
  it('clampCenter keeps the view inside bounds or centers when too big', () => {
    const b = { x: 0, y: 0, w: 6000, h: 6000 };
    expect(clampCenter({ x: 10, y: 10 }, W, H, 1, b)).toEqual({ x: W / 2, y: H / 2 });
    expect(clampCenter({ x: 5990, y: 3000 }, W, H, 1, b)).toEqual({ x: 6000 - W / 2, y: 3000 });
    expect(clampCenter({ x: 10, y: 10 }, W, H, 1, { x: 0, y: 0, w: 1000, h: 800 })).toEqual({ x: 500, y: 400 });
  });

  it('look-ahead is capped and merged look-ahead never pushes a car out of view', () => {
    const l = lookTarget({ x: 5000, y: 0 }, CAMERA);
    expect(Math.hypot(l.x, l.y)).toBeCloseTo(CAMERA.lookAheadMax);
    const a = { x: 0, y: 0 }, b = { x: 1500, y: 0 };
    const z = fitZoom(a, b, pad, W, H, 1);
    expect(clampLookToSlack({ x: 300, y: 0 }, a, b, pad, z, W, H).x).toBeCloseTo(0);
  });

  it('speed/turbo zoom-out', () => {
    expect(speedZoomOut(0, false, CAMERA)).toBe(0);
    expect(speedZoomOut(1e6, false, CAMERA)).toBeCloseTo(CAMERA.speedZoomOut);
    expect(speedZoomOut(0, true, CAMERA)).toBeCloseTo(CAMERA.turboZoomOut);
  });

  it('shake falloff and player views', () => {
    expect(shakeFalloff(0, 500)).toBe(1);
    expect(shakeFalloff(250, 500)).toBeCloseTo(0.5);
    expect(shakeFalloff(900, 500)).toBe(0);
    expect(playerViewsFor(1, W, H)).toEqual([{ x: 0, y: 0, w: W, h: H }]);
    expect(playerViewsFor(2, W, H)[1]).toEqual({ x: W / 2, y: 0, w: W / 2, h: H });
  });
});
