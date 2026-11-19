import { describe, expect, it } from 'vitest';
import { mapKeyboard } from './keyboardMap';
import { applyDeadzone, mapGamepad, mergeInputs, navEdge, newRepeatState, type PadSnapshot } from './mapping';
import { resolvePadMap, STANDARD_MAP } from './padMaps';

function pad(over: { axes?: number[]; down?: number[]; values?: Record<number, number>; id?: string; mapping?: string } = {}): PadSnapshot {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
  for (const i of over.down ?? []) buttons[i] = { pressed: true, value: 1 };
  for (const [i, v] of Object.entries(over.values ?? {})) buttons[+i] = { pressed: v > 0.5, value: v };
  return { id: over.id ?? 'Xbox Controller', mapping: over.mapping ?? 'standard', axes: over.axes ?? [0, 0, 0, 0], buttons };
}
const run = (s: PadSnapshot, prev: PadSnapshot | null = null, now = 0) =>
  mapGamepad(s, prev, newRepeatState(), now);

describe('deadzone', () => {
  it('zeroes inside the deadzone', () => {
    expect(applyDeadzone(0.1, 0.1)).toEqual([0, 0]);
    expect(run(pad({ axes: [0.17, 0] })).steer).toBe(0);
  });
  it('rescales from the edge and reaches 1', () => {
    expect(run(pad({ axes: [1, 0] })).steer).toBeCloseTo(1);
    expect(run(pad({ axes: [-1, 0] })).steer).toBeCloseTo(-1);
    const mid = run(pad({ axes: [0.59, 0] })).steer;
    expect(mid).toBeCloseTo((0.59 - 0.18) / 0.82);
  });
  it('is radial (diagonal magnitude clamps to 1)', () => {
    const [x, y] = applyDeadzone(1, 1);
    expect(Math.hypot(x, y)).toBeCloseTo(1);
  });
  it('dpad overrides to +-1', () => {
    expect(run(pad({ down: [15] })).steer).toBe(1);
    expect(run(pad({ down: [14] })).steer).toBe(-1);
  });
});

describe('triggers', () => {
  it('RT analog and A both give throttle', () => {
    expect(run(pad({ values: { 7: 0.4 } })).throttle).toBeCloseTo(0.4);
    expect(run(pad({ down: [0] })).throttle).toBe(1);
    expect(run(pad({ down: [0], values: { 7: 0.3 } })).throttle).toBe(1);
  });
  it('LT is brake', () => {
    expect(run(pad({ values: { 6: 0.7 } })).brake).toBeCloseTo(0.7);
  });
});

describe('edges', () => {
  it('confirm/back/pause fire only on the pressing frame', () => {
    const up = pad();
    const dn = pad({ down: [0, 9] });
    const first = run(dn, up);
    expect(first.confirm).toBe(true);
    expect(first.pause).toBe(true);
    const held = run(dn, dn);
    expect(held.confirm).toBe(false);
    expect(held.pause).toBe(false);
    expect(run(pad({ down: [1] }), up).back).toBe(true);
  });
  it('answers: X=0, Y=1, B=2', () => {
    expect(run(pad({ down: [2] }), pad()).answer).toBe(0);
    expect(run(pad({ down: [3] }), pad()).answer).toBe(1);
    expect(run(pad({ down: [1] }), pad()).answer).toBe(2);
  });
  it('gamepad A answers slot 3 and still confirms', () => {
    const i = run(pad({ down: [0] }), pad());
    expect(i.answer).toBe(3);
    expect(i.confirm).toBe(true);
    expect(i.throttle).toBe(1);
  });
  it('leftmost wins when several pressed', () => {
    expect(run(pad({ down: [3, 1] }), pad()).answer).toBe(1);
    expect(run(pad({ down: [2, 3, 1] }), pad()).answer).toBe(0);
  });
  it('held answer does not repeat', () => {
    expect(run(pad({ down: [2] }), pad({ down: [2] })).answer).toBeNull();
  });
});

describe('nav repeat', () => {
  it('fires once, waits 0.4s, then every 0.15s', () => {
    const st = newRepeatState();
    const right = pad({ down: [15] });
    const fires: number[] = [];
    for (let t = 0; t <= 1.0001; t += 0.05) {
      if (mapGamepad(right, right, st, t).navX === 1) fires.push(Math.round(t * 100) / 100);
    }
    expect(fires[0]).toBe(0);
    expect(fires[1]).toBeGreaterThanOrEqual(0.4);
    expect(fires[1]).toBeLessThan(0.46);
    expect(fires[2] - fires[1]).toBeGreaterThanOrEqual(0.149);
    expect(fires[2] - fires[1]).toBeLessThan(0.21);
  });
  it('releasing resets so the next press fires immediately', () => {
    const st = { dir: 0, nextAt: 0 };
    expect(navEdge(1, st, 0)).toBe(1);
    expect(navEdge(1, st, 0.1)).toBe(0);
    expect(navEdge(0, st, 0.2)).toBe(0);
    expect(navEdge(1, st, 0.25)).toBe(1);
  });
  it('stick past 0.5 navigates; dpad up is navY -1', () => {
    expect(run(pad({ axes: [0, 0.6] })).navY).toBe(1);
    expect(run(pad({ axes: [0, 0.4] })).navY).toBe(0);
    expect(run(pad({ down: [12] })).navY).toBe(-1);
  });
});

describe('non-standard fallback', () => {
  it('unknown pads use the generic default', () => {
    expect(resolvePadMap('Weird Pad (Vendor: 1234)', '')).toEqual(STANDARD_MAP);
    expect(run(pad({ down: [0], mapping: '', id: 'Weird' }), pad({ mapping: '', id: 'Weird' })).confirm).toBe(true);
  });
  it('matches by id substring and applies overrides', () => {
    const table = [{ match: 'acme', map: { a: 1, b: 0 } }];
    const m = resolvePadMap('ACME Gamepad 3000', '', table);
    expect(m.a).toBe(1);
    expect(m.b).toBe(0);
    expect(m.x).toBe(STANDARD_MAP.x);
    const out = mapGamepad(pad({ down: [1], mapping: '' }), pad({ mapping: '' }), newRepeatState(), 0, m);
    expect(out.confirm).toBe(true);
    expect(resolvePadMap('ACME', 'standard', table)).toEqual(STANDARD_MAP);
  });
});

describe('keyboard', () => {
  const none = new Set<string>();
  const kb = (layout: 'left' | 'right', keys: string[], prev: string[] = [], now = 0) =>
    mapKeyboard(layout, new Set(keys), new Set(prev), newRepeatState(), now);

  it('left layout driving', () => {
    const i = kb('left', ['KeyW', 'KeyA']);
    expect(i.throttle).toBe(1);
    expect(i.steer).toBe(-1);
    expect(kb('left', ['KeyS', 'KeyD']).brake).toBe(1);
    expect(kb('left', ['KeyS', 'KeyD']).steer).toBe(1);
  });
  it('right layout driving ignores left keys', () => {
    expect(kb('right', ['KeyW']).throttle).toBe(0);
    const i = kb('right', ['ArrowUp', 'ArrowRight']);
    expect(i.throttle).toBe(1);
    expect(i.steer).toBe(1);
  });
  it('answers per layout, edge only', () => {
    expect(kb('left', ['Digit1']).answer).toBe(0);
    expect(kb('left', ['Digit3']).answer).toBe(2);
    expect(kb('right', ['Comma']).answer).toBe(0);
    expect(kb('right', ['Period']).answer).toBe(1);
    expect(kb('right', ['Slash']).answer).toBe(2);
    expect(kb('right', ['Slash'], ['Slash']).answer).toBeNull();
    expect(kb('left', ['Digit2', 'Digit1']).answer).toBe(0);
    expect(kb('left', ['Digit4']).answer).toBe(3);
    expect(kb('right', ['KeyM']).answer).toBe(3);
  });
  it('confirm keys are per layout; back/pause shared', () => {
    expect(kb('left', ['Space']).confirm).toBe(true);
    expect(kb('left', ['Enter']).confirm).toBe(false);
    expect(kb('right', ['Enter']).confirm).toBe(true);
    expect(kb('right', ['Space']).confirm).toBe(false);
    for (const l of ['left', 'right'] as const) {
      expect(kb(l, ['Escape']).pause).toBe(true);
      expect(kb(l, ['Backspace']).back).toBe(true);
    }
    expect(mapKeyboard('left', none, none, newRepeatState(), 0).pause).toBe(false);
  });
});

describe('mergeInputs', () => {
  it('max analog, OR edges, first answer', () => {
    const a = run(pad({ values: { 7: 0.2 } }));
    const b = { ...run(pad({ down: [0] }), pad()), answer: 2 as const };
    const c = { ...run(pad()), answer: 1 as const, steer: -0.5 };
    const m = mergeInputs([a, b, c]);
    expect(m.throttle).toBe(1);
    expect(m.confirm).toBe(true);
    expect(m.answer).toBe(2);
    expect(m.steer).toBe(-0.5);
  });
});
