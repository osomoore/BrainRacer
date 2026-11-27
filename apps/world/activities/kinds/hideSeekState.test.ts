import { describe, expect, it } from 'vitest';
import { updateHideSeek, type HideSeekState } from './hideSeekState';

const base = { player: { x: 0, y: 0 }, vx: 0, vy: 0, hideout: { x: 0, y: 0 }, stealth: 2,
  hideRadius: 115, passSeconds: 2.8, passDistance: 260, caughtDistance: 105, requiredSeconds: 3, maxSeconds: 14, camouflaged: false };

describe('hide and seek state', () => {
  it('wins after staying still in the foliage for the pass', () => {
    const state: HideSeekState = { crossingStillSeconds: 0 };
    let result: ReturnType<typeof updateHideSeek> = 'running';
    for (let i = 0; i < 100 && result === 'running'; i++) {
      result = updateHideSeek({ ...base, elapsed: i * 0.1, dt: 0.1 }, state);
    }
    expect(result).toBe('success');
    expect(state.crossingStillSeconds).toBeGreaterThanOrEqual(2.28);
  });

  it('fails if moving or hiding outside the foliage when the sniffing dino catches up', () => {
    const moving: HideSeekState = { crossingStillSeconds: 0 };
    expect(updateHideSeek({ ...base, elapsed: 2.7, dt: 0.1, stealth: 0, vx: 40 }, moving)).toBe('fail');
    const outside: HideSeekState = { crossingStillSeconds: 0 };
    let result: ReturnType<typeof updateHideSeek> = 'running';
    for (let i = 0; i < 100 && result === 'running'; i++) {
      result = updateHideSeek({ ...base, elapsed: i * 0.1, dt: 0.1, stealth: 0, player: { x: 350, y: 0 } }, outside);
    }
    expect(result).toBe('fail');
  });

  it('times out if the player never reaches a hideout', () => {
    expect(updateHideSeek({ ...base, elapsed: 13.9, dt: 0.1, player: { x: 500, y: 0 } }, { crossingStillSeconds: 0 })).toBe('fail');
  });

  it('lets matching camouflage stay hidden while moving, but still requires the dino to pass', () => {
    const state: HideSeekState = { crossingStillSeconds: 0 };
    expect(updateHideSeek({ ...base, elapsed: 2.7, dt: 0.1, stealth: 0, camouflaged: true, vx: 40 }, state)).toBe('running');
  });
});
