import { describe, expect, it } from 'vitest';
import { emptyTouchState, mapTouch } from './touchMap';
import { newRepeatState } from '../mapping';

const st = (o: Partial<ReturnType<typeof emptyTouchState>>) => ({ ...emptyTouchState(), ...o });

describe('mapTouch', () => {
  it('race: auto gas, digital steer, brake cancels gas', () => {
    const r = newRepeatState();
    let i = mapTouch('race', st({ right: true }), emptyTouchState(), r, 0, null);
    expect(i.steer).toBe(1); expect(i.throttle).toBe(1); expect(i.brake).toBe(0);
    i = mapTouch('race', st({ left: true, right: true }), emptyTouchState(), r, 0, null);
    expect(i.steer).toBe(0);
    i = mapTouch('race', st({ brake: true }), emptyTouchState(), r, 0, null);
    expect(i.throttle).toBe(0); expect(i.brake).toBe(1);
  });
  it('race: pause and reset are edges', () => {
    const r = newRepeatState();
    const down = st({ pause: true, reset: true });
    expect(mapTouch('race', down, emptyTouchState(), r, 0, null)).toMatchObject({ pause: true, resetCar: true });
    expect(mapTouch('race', down, down, r, 0, null)).toMatchObject({ pause: false, resetCar: false });
  });
  it('menu: nav edge with repeat, A confirms, B backs', () => {
    const r = newRepeatState();
    const right = st({ right: true });
    expect(mapTouch('menu', right, emptyTouchState(), r, 0, null).navX).toBe(1);
    expect(mapTouch('menu', right, right, r, 0.1, null).navX).toBe(0);
    expect(mapTouch('menu', right, right, r, 0.5, null).navX).toBe(1);
    expect(mapTouch('menu', st({ up: true }), emptyTouchState(), newRepeatState(), 0, null).navY).toBe(-1);
    expect(mapTouch('menu', st({ a: true }), emptyTouchState(), r, 0, null).confirm).toBe(true);
    expect(mapTouch('menu', st({ b: true }), emptyTouchState(), r, 0, null)).toMatchObject({ back: true, transfer: true });
  });
  it('reports tapped answers in any layout and stays idle in none', () => {
    const r = newRepeatState();
    expect(mapTouch('race', emptyTouchState(), emptyTouchState(), r, 0, 2).answer).toBe(2);
    expect(mapTouch('none', st({ right: true }), emptyTouchState(), r, 0, null)).toMatchObject({ steer: 0, throttle: 0 });
  });
});
