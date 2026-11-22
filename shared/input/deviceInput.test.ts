import { describe, expect, it } from 'vitest';
import { deviceKey, keyAction, keyText, padDeviceActions, sameDevice } from './deviceInput';
import type { MenuPadSnapshot } from './menuInput';

const pad = (pressed: number[] = [], axes: number[] = [0, 0]): MenuPadSnapshot => ({
  id: 'test pad', mapping: 'standard', axes,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })),
});

describe('keyboard layouts', () => {
  it('KB1 is WASD + Space + Q/Escape, Tab = menu', () => {
    expect(keyAction('KeyW')).toEqual({ layout: 1, action: 'up' });
    expect(keyAction('Space')).toEqual({ layout: 1, action: 'confirm' });
    expect(keyAction('KeyQ')).toEqual({ layout: 1, action: 'back' });
    expect(keyAction('Escape')).toEqual({ layout: 1, action: 'back' });
    expect(keyAction('Tab')).toEqual({ layout: 1, action: 'menu' });
  });
  it('KB2 is arrows + Enter + Backspace', () => {
    expect(keyAction('ArrowLeft')).toEqual({ layout: 2, action: 'left' });
    expect(keyAction('Enter')).toEqual({ layout: 2, action: 'confirm' });
    expect(keyAction('Backspace')).toEqual({ layout: 2, action: 'back' });
  });
  it('unknown keys map to nothing', () => {
    expect(keyAction('KeyZ')).toBeNull();
  });
});

describe('keyText', () => {
  it('letters type, move keys only with shift', () => {
    expect(keyText('KeyZ', 'z', false)).toBe('z');
    expect(keyText('KeyW', 'w', false)).toBeNull();
    expect(keyText('KeyW', 'W', true)).toBe('W');
  });
  it('ignores non-letters', () => {
    expect(keyText('Space', ' ', false)).toBeNull();
    expect(keyText('Digit1', '1', false)).toBeNull();
    expect(keyText('Enter', 'Enter', false)).toBeNull();
  });
});

describe('padDeviceActions', () => {
  it('ignores the first sight of a pad (held buttons do not fire)', () => {
    expect(padDeviceActions(pad([0]), null)).toEqual({ actions: [], admin: false });
  });
  it('A confirms, B backs, Start is menu', () => {
    expect(padDeviceActions(pad([0]), pad()).actions).toEqual(['confirm']);
    expect(padDeviceActions(pad([1]), pad()).actions).toEqual(['back']);
    expect(padDeviceActions(pad([9]), pad()).actions).toEqual(['menu']);
  });
  it('does not repeat while held', () => {
    expect(padDeviceActions(pad([0]), pad([0])).actions).toEqual([]);
  });
  it('d-pad and stick give directions on edge', () => {
    expect(padDeviceActions(pad([15]), pad()).actions).toEqual(['right']);
    expect(padDeviceActions(pad([], [0, 0.9]), pad()).actions).toEqual(['down']);
  });
  it('LT + RT + Start is the admin chord, not a menu press', () => {
    expect(padDeviceActions(pad([6, 7, 9]), pad([6, 7]))).toEqual({ actions: [], admin: true });
    expect(padDeviceActions(pad([6, 9]), pad([6])).actions).toEqual(['menu']);
  });
});

describe('device ids', () => {
  it('compares by key', () => {
    expect(deviceKey({ kind: 'pad', index: 2 })).toBe('pad2');
    expect(sameDevice({ kind: 'kb', layout: 1 }, { kind: 'kb', layout: 1 })).toBe(true);
    expect(sameDevice({ kind: 'kb', layout: 1 }, { kind: 'kb', layout: 2 })).toBe(false);
  });
});
