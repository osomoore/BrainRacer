import { describe, expect, it } from 'vitest';
import { AnswerArming, heldKeys, NavHoldTracker } from './answerArming';

describe('heldKeys', () => {
  it('gas blocks up and the A slot', () => {
    const h = heldKeys({ steer: 0, throttle: 1, brake: 0 });
    expect(h.has('dir:up')).toBe(true);
    expect(h.has('slot:3')).toBe(true);
    expect(h.has('slot:0')).toBe(false);
  });
  it('steer and brake map to directions; nav-recent adds more', () => {
    const h = heldKeys({ steer: -0.8, throttle: 0, brake: 0.9 }, ['right']);
    expect([...h].sort()).toEqual(['dir:down', 'dir:left', 'dir:right']);
  });
});

describe('AnswerArming', () => {
  it('held input stays disarmed until released, then counts again', () => {
    const a = new AnswerArming();
    const held = heldKeys({ steer: 0, throttle: 1, brake: 0 });
    a.snapshot(held);
    a.update(held);
    expect(a.isArmed('slot:3')).toBe(false);
    expect(a.isArmed('dir:up')).toBe(false);
    expect(a.isArmed('slot:0')).toBe(true);
    a.update(heldKeys({ steer: 0, throttle: 0, brake: 0 }));
    expect(a.isArmed('slot:3')).toBe(true);
  });
  it('a press that starts after the snapshot is armed (no self-blocking)', () => {
    const a = new AnswerArming();
    a.snapshot(new Set());
    a.update(heldKeys({ steer: 0, throttle: 1, brake: 0 }));
    expect(a.isArmed('slot:3')).toBe(true);
  });
  it('re-snapshot on a new question re-blocks held inputs', () => {
    const a = new AnswerArming();
    a.snapshot(new Set());
    const held = heldKeys({ steer: 1, throttle: 0, brake: 0 });
    a.snapshot(held);
    expect(a.isArmed('dir:right')).toBe(false);
  });
  it('consume needs a release', () => {
    const a = new AnswerArming();
    a.consume('dir:left');
    expect(a.isArmed('dir:left')).toBe(false);
    a.update(new Set());
    expect(a.isArmed('dir:left')).toBe(true);
  });
});

describe('NavHoldTracker', () => {
  it('first edge holds long, repeats hold short, then expires', () => {
    const t = new NavHoldTracker(0.45, 0.2);
    expect(t.note('up', 0)).toBe(false);
    expect(t.recent(0.4)).toEqual(['up']);
    expect(t.recent(0.5)).toEqual([]);
    expect(t.note('up', 0.4)).toBe(true);
    t.note('up', 0.55);
    expect(t.recent(0.7)).toEqual(['up']);
    expect(t.recent(0.8)).toEqual([]);
  });
});
