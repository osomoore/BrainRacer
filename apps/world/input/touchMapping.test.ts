import { describe, expect, it } from 'vitest';
import { TOUCH, WORLD } from '../config';
import { buttonSpecs, stickVector, TouchState, touchModeWanted } from './touchMapping';

const layout = { width: WORLD.width, ...TOUCH };
const mk = () => new TouchState(layout);
const spec = (id: string) => buttonSpecs(layout).find(b => b.id === id)!;

describe('stickVector', () => {
  it('ignores the dead zone and clamps to 1', () => {
    expect(stickVector(5, 5, 150, 0.15)).toEqual({ x: 0, y: 0 });
    const full = stickVector(0, -400, 150, 0.15);
    expect(full.x).toBeCloseTo(0);
    expect(full.y).toBeCloseTo(-1);
  });
});

describe('TouchState stick', () => {
  it('pushing up is forward throttle, pulling down is brake', () => {
    const t = mk();
    expect(t.down(1, 300, 700)).toBe('stick');
    t.move(1, 300, 600);
    let c = t.frame();
    expect(c.throttle).toBeGreaterThan(0.3);
    expect(c.brake).toBe(0);
    expect(c.y).toBeLessThan(0);
    t.move(1, 300, 800);
    c = t.frame();
    expect(c.brake).toBeGreaterThan(0.3);
    expect(c.throttle).toBe(0);
  });
  it('steers right with x', () => {
    const t = mk();
    t.down(1, 300, 700);
    t.move(1, 450, 700);
    expect(t.frame().x).toBeCloseTo(1);
  });
  it('releases to idle', () => {
    const t = mk();
    t.down(1, 300, 700);
    t.move(1, 300, 600);
    t.up(1);
    const c = t.frame();
    expect([c.x, c.y, c.throttle, c.brake]).toEqual([0, 0, 0, 0]);
  });
  it('only starts in the left zone and keeps the base on screen', () => {
    const t = mk();
    expect(t.down(1, 1200, 500)).toBeNull();
    expect(t.down(2, 5, 500)).toBe('stick');
    expect(t.base.x).toBe(TOUCH.stickMargin + TOUCH.stickRadius);
  });
  it('a second finger in the zone does not steal the stick', () => {
    const t = mk();
    t.down(1, 300, 700);
    expect(t.down(2, 400, 600)).toBeNull();
  });
});

describe('TouchState buttons', () => {
  it('buttons are large enough and do not overlap', () => {
    const b = buttonSpecs(layout);
    for (const s of b) expect(s.r * 2).toBeGreaterThanOrEqual(130);
    for (const p of b) for (const q of b) if (p !== q) expect(Math.hypot(p.x - q.x, p.y - q.y)).toBeGreaterThan(p.r + q.r);
  });
  it('edge-triggers once per tap', () => {
    const t = mk();
    const a = spec('a');
    expect(t.down(5, a.x, a.y)).toBe('button');
    expect(t.frame().pressed.a).toBe(true);
    expect(t.frame().pressed.a).toBe(false);
    expect(t.held.a).toBe(true);
    t.up(5);
    expect(t.held.a).toBe(false);
  });
  it('a tap shorter than a frame still registers', () => {
    const t = mk();
    const b = spec('b');
    t.down(5, b.x, b.y);
    t.up(5);
    expect(t.frame().pressed.b).toBe(true);
  });
  it('steers and presses at once, and several buttons together', () => {
    const t = mk();
    t.down(1, 300, 700);
    t.move(1, 300, 580);
    const x = spec('x');
    const y = spec('y');
    t.down(2, x.x, x.y);
    t.down(3, y.x, y.y);
    const c = t.frame();
    expect(c.throttle).toBeGreaterThan(0);
    expect(c.pressed.x && c.pressed.y).toBe(true);
    expect(c.pressed.a || c.pressed.b).toBe(false);
  });
  it('cancelAll clears everything', () => {
    const t = mk();
    t.down(1, 300, 700);
    const a = spec('a');
    t.down(2, a.x, a.y);
    t.cancelAll();
    expect(t.held.a).toBe(false);
    expect(t.stickPointer).toBeNull();
  });
});

describe('touchModeWanted', () => {
  it('needs one player and mobile or ?touch=1', () => {
    expect(touchModeWanted('', true, 1)).toBe(true);
    expect(touchModeWanted('', false, 1)).toBe(false);
    expect(touchModeWanted('?touch=1', false, 1)).toBe(true);
    expect(touchModeWanted('?touch=1', false, 2)).toBe(false);
    expect(touchModeWanted('?touch=0', true, 1)).toBe(false);
  });
});

describe('TouchState pause button', () => {
  const pause = { x: 70, y: 70, radius: 48, hitScale: 1.4 };
  const mkp = () => new TouchState({ ...layout, pause });
  it('a tap reports menu once and does not start the stick', () => {
    const t = mkp();
    expect(t.down(1, 70, 70)).toBe('button');
    expect(t.stickPointer).toBeNull();
    expect(t.frame().pressed.menu).toBe(true);
    expect(t.frame().pressed.menu).toBe(false);
    t.up(1);
  });
  it('is off without a pause spec', () => {
    const t = mk();
    t.down(1, 70, 70);
    expect(t.frame().pressed.menu).toBe(false);
  });
});
