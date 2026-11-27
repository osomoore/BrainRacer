import { describe, expect, it } from 'vitest';
import { canShakeTree, rollFruit, stepFruit, type FruitState } from './fruitShake';

describe('fruit shake helpers', () => {
  it('reach increases tree contact distance', () => {
    const player = { x: 0, y: 0 }, tree = { x: 120, y: 0 };
    expect(canShakeTree(player, tree, 0)).toBe(false);
    expect(canShakeTree(player, tree, 2)).toBe(true);
    expect(canShakeTree(player, { x: 1000, y: 0 }, 3)).toBe(false);
  });

  it('fruit only rolls when nudged and stops at the basket', () => {
    const fruit = { x: 0, y: 0 }, basket = { x: 100, y: 0 };
    expect(rollFruit(fruit, basket, { x: 200, y: 0 }, 1, { x: 30, y: 0 }, 1)).toEqual(fruit);
    expect(rollFruit(fruit, basket, { x: 0, y: 0 }, 1, { x: 30, y: 0 }, 1)).toEqual({ x: 65, y: 0 });
    expect(rollFruit(fruit, basket, { x: 0, y: 0 }, 1, { x: 30, y: 0 }, 2)).toEqual(basket);
    expect(rollFruit(fruit, basket, { x: 0, y: 0 }, 1, { x: -30, y: 0 }, 1)).toEqual(fruit);
  });

  it('finishes when fruit is bumped and guided into the basket', () => {
    let state: FruitState = {
      trees: [{ x: 0, y: 0 }],
      fruits: [{ at: { x: 0, y: 0 }, basket: { x: 110, y: 28 }, dropped: false }],
      elapsed: 0,
      missed: 0,
    };
    let result = stepFruit(state, { x: 0, y: 0 }, 1, { x: 30, y: 0 }, 0.1);
    state = result.state;
    expect(state.fruits[0].dropped).toBe(true);
    for (let i = 0; i < 30 && result.outcome === 'running'; i++) {
      const at = state.fruits[0].at;
      result = stepFruit(state, at, 1, { x: 30, y: 0 }, 0.1);
      state = result.state;
    }
    expect(result.outcome).toBe('success');
  });

  it('gently fails repeated bumps outside reach and times out when left unfinished', () => {
    let state: FruitState = {
      trees: [{ x: 0, y: 0 }],
      fruits: [{ at: { x: 0, y: 0 }, basket: { x: 200, y: 0 }, dropped: false }],
      elapsed: 0,
      missed: 0,
    };
    let result = stepFruit(state, { x: 120, y: 0 }, 0, { x: 30, y: 0 }, 3);
    state = result.state;
    result = stepFruit(state, { x: 120, y: 0 }, 0, { x: 30, y: 0 }, 3);
    state = result.state;
    result = stepFruit(state, { x: 120, y: 0 }, 0, { x: 30, y: 0 }, 3);
    expect(result.outcome).toBe('fail');

    const timeout = stepFruit({ ...state, elapsed: 54.9, missed: 0 }, { x: 500, y: 0 }, 0, { x: 0, y: 0 }, 0.2);
    expect(timeout.outcome).toBe('fail');
  });
});
