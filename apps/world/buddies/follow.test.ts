import { describe, expect, it } from 'vitest';
import { WORLD_BUDDIES } from '../config';
import { buddyHop, followBuddy } from './follow';

const C = WORLD_BUDDIES.follower;
const clear = () => true;

describe('World buddy follower', () => {
  it('eases behind the creation and snaps behind it after a long move', () => {
    const first = followBuddy(undefined, { x: 0, y: 0, angle: 0 }, 0, clear)!;
    expect(first).toEqual({ x: -C.distance, y: 0 });
    const moved = followBuddy(first, { x: 100, y: 0, angle: 0 }, 0.1, clear)!;
    expect(moved.x).toBeGreaterThan(first.x);
    expect(moved.x).toBeLessThan(100 - C.distance);
    expect(followBuddy(moved, { x: 900, y: 0, angle: Math.PI }, 0.1, clear)?.x).toBeCloseTo(900 + C.distance);
  });

  it('samples through a long step, stops at walls, and skips unsafe respawns', () => {
    const wall = ({ x }: { x: number }) => x < 0 || x > 12;
    expect(followBuddy({ x: -30, y: 0 }, { x: 200, y: 0, angle: 0 }, 1, wall)!.x).toBeLessThan(0);
    expect(followBuddy(undefined, { x: 200, y: 0, angle: 0 }, 0, () => false)).toBeUndefined();
  });

  it('hops over a prop without making it a follower collision', () => {
    const obstacle = { id: 'rock', kind: 'rock', at: { x: 0, y: 0 }, radius: 35 };
    expect(buddyHop(obstacle.at, [obstacle])).toBe(C.hopHeight);
    expect(buddyHop({ x: 400, y: 0 }, [obstacle])).toBe(0);
    expect(followBuddy(undefined, { x: C.distance, y: 0, angle: 0 }, 0, clear)).toEqual(obstacle.at);
  });
});
