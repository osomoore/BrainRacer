import { describe, expect, it } from 'vitest';
import { POLICE, POLICE_SPEC, REWARDS } from '../config/gameConfig';
import {
  shouldDestroyLeavingSwarmCar, shouldRecycleSwarmCar, swarmDeficit, swarmSpawnCandidates,
} from './policeSwarm';

describe('policeSwarm', () => {
  it('tops up toward the count, capped per tick', () => {
    expect(swarmDeficit(POLICE.monsterSwarmCount)).toBe(0);
    expect(swarmDeficit(POLICE.monsterSwarmCount + 2)).toBe(0);
    expect(swarmDeficit(0)).toBe(POLICE.monsterSwarmTopUpBatch);
    expect(swarmDeficit(POLICE.monsterSwarmCount - 1)).toBe(1);
  });

  it('filters spawn candidates by ring, players, cars and dead ends', () => {
    const mk = (id: number, x: number, next: number[] = [0]) => ({ id, x, y: 0, next });
    const nodes = [mk(0, 100), mk(1, 600), mk(2, 700), mk(3, 800, []), mk(4, 5000)];
    const out = swarmSpawnCandidates(nodes, { x: 0, y: 0 }, [{ x: 700, y: 50 }], [{ x: 600, y: 10 }]);
    expect(out.map((n) => n.id)).toEqual([]);
    const out2 = swarmSpawnCandidates(nodes, { x: 0, y: 0 }, [], []);
    expect(out2.map((n) => n.id)).toEqual([1, 2]);
  });

  it('recycles lost or wedged cars but not ones bumping the boss', () => {
    expect(shouldRecycleSwarmCar(POLICE.monsterSwarmRecycleDist + 1, 0)).toBe(true);
    expect(shouldRecycleSwarmCar(100, 99)).toBe(false);
    expect(shouldRecycleSwarmCar(POLICE.monsterSwarmStuckMinDist + 1, POLICE.monsterSwarmStuckSec)).toBe(true);
  });

  it('leaving cars vanish off-screen at once or after the short exit time', () => {
    expect(shouldDestroyLeavingSwarmCar(0.1, true)).toBe(true);
    expect(shouldDestroyLeavingSwarmCar(0.1, false)).toBe(false);
    expect(shouldDestroyLeavingSwarmCar(POLICE.monsterSwarmExitSec, false)).toBe(true);
    expect(POLICE.monsterSwarmExitSec).toBeLessThanOrEqual(2.5);
  });

  it('police stay just above players but turbo still escapes', () => {
    expect(POLICE_SPEC.maxSpeed).toBe(360);
    expect(344 * REWARDS.turboSpeedMult).toBeGreaterThan(POLICE_SPEC.maxSpeed);
  });
});
