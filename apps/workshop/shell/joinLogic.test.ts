import { describe, expect, it } from 'vitest';
import { emptyJoin, goButtonLabel, reduceJoin, slotLine } from './joinLogic';

const kb1 = { kind: 'kb', layout: 1 } as const;
const kb2 = { kind: 'kb', layout: 2 } as const;
const pad0 = { kind: 'pad', index: 0 } as const;

describe('reduceJoin', () => {
  it('confirm joins in order, max 2', () => {
    let r = reduceJoin(emptyJoin, kb1, 'confirm', 2);
    expect(r.result).toBe('joined');
    r = reduceJoin(r.state, kb2, 'confirm', 2);
    expect(r.state.slots).toEqual([kb1, kb2]);
    r = reduceJoin(r.state, pad0, 'confirm', 2);
    expect(r.result).toBe('none');
    expect(r.state.slots).toHaveLength(2);
  });
  it('only Player 1 confirm (or menu from a joined device) starts', () => {
    const s = { slots: [kb1, kb2] };
    expect(reduceJoin(s, kb1, 'confirm', 2).result).toBe('start');
    expect(reduceJoin(s, kb2, 'confirm', 2).result).toBe('none');
    expect(reduceJoin(s, kb2, 'menu', 2).result).toBe('start');
    expect(reduceJoin(s, pad0, 'menu', 2).result).toBe('none');
  });
  it('back leaves, and goes to the hub when nobody is joined', () => {
    const s = { slots: [kb1, kb2] };
    expect(reduceJoin(s, kb1, 'back', 2).state.slots).toEqual([kb2]);
    expect(reduceJoin(emptyJoin, kb1, 'back', 2).result).toBe('hub');
    expect(reduceJoin({ slots: [kb1] }, kb2, 'back', 2).result).toBe('none');
  });
});

describe('any-button join', () => {
  it('any non-back action makes the first device Player 1', () => {
    for (const a of ['confirm', 'menu', 'left', 'right', 'up', 'down'] as const) {
      expect(reduceJoin(emptyJoin, pad0, a, 2)).toEqual({ state: { slots: [pad0] }, result: 'joined' });
    }
    expect(reduceJoin(emptyJoin, kb1, 'back', 2).state.slots).toEqual([]);
  });
  it('a second device joins on confirm or menu, not on a move', () => {
    const s = { slots: [kb1] };
    expect(reduceJoin(s, pad0, 'left', 2).result).toBe('none');
    expect(reduceJoin(s, pad0, 'confirm', 2).state.slots).toEqual([kb1, pad0]);
    expect(reduceJoin(s, kb2, 'menu', 2).state.slots).toEqual([kb1, kb2]);
  });
  it('Player 1 moving keys do nothing once joined', () => {
    expect(reduceJoin({ slots: [kb1] }, kb1, 'left', 2).result).toBe('none');
  });
  it('names the go button per device', () => {
    expect(goButtonLabel(pad0)).toBe('A');
    expect(goButtonLabel(kb1)).toBe('Space');
    expect(goButtonLabel(kb2)).toBe('Enter');
  });
});

describe('slotLine', () => {
  it('shows a check or the join prompt', () => {
    expect(slotLine(0, kb1, 'x')).toBe('Player 1 ✓');
    expect(slotLine(1, undefined, 'press A to join')).toBe('Player 2: press A to join');
  });
});
