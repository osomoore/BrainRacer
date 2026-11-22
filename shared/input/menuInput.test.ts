import { describe, expect, it } from 'vitest';
import { keyActions, padActions, type MenuPadSnapshot } from './menuInput';

const pad = (pressed: number[] = [], axes: number[] = [0, 0]): MenuPadSnapshot => ({
  id: 'test pad', mapping: 'standard', axes,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })),
});

describe('padActions', () => {
  it('fires confirm on A and Start edges, back on B', () => {
    expect(padActions(pad([0]), pad())).toEqual(['confirm']);
    expect(padActions(pad([9]), pad())).toEqual(['confirm']);
    expect(padActions(pad([1]), pad())).toEqual(['back']);
  });
  it('does not repeat while held', () => {
    expect(padActions(pad([0]), pad([0]))).toEqual([]);
  });
  it('maps d-pad and stick to directions on edge', () => {
    expect(padActions(pad([15]), pad())).toEqual(['right']);
    expect(padActions(pad([], [-0.9, 0]), pad())).toEqual(['left']);
    expect(padActions(pad([], [-0.9, 0]), pad([], [-0.8, 0]))).toEqual([]);
    expect(padActions(pad([], [0, 0.2]), pad())).toEqual([]);
    expect(padActions(pad([12]), pad())).toEqual(['up']);
  });
  it('treats a null previous snapshot as nothing held', () => {
    expect(padActions(pad([1]), null)).toEqual(['back']);
  });
});

describe('keyActions', () => {
  it('maps both layouts', () => {
    expect(keyActions('Enter')).toBe('confirm');
    expect(keyActions('Space')).toBe('confirm');
    expect(keyActions('KeyA')).toBe('left');
    expect(keyActions('ArrowRight')).toBe('right');
    expect(keyActions('Escape')).toBe('back');
    expect(keyActions('KeyQ')).toBeNull();
  });
});
