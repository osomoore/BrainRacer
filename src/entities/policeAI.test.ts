import { describe, expect, it } from 'vitest';
import { POLICE } from '../config/gameConfig';
import { Tile, type LaneGraph, type WorldData } from '../core/types';
import {
  addHeat, decayHeat, desiredChasers, findPath, heatGain, leadPoint, lineOfSight, newBrain, NodeIndex,
  pursuitTarget, steerToward, think, updateEscape,
} from './policeAI';

// 0 -> 1 -> 2 -> 3 along +x, 1 -> 4 branch down, 5 isolated
const graph: LaneGraph = {
  nodes: [
    { id: 0, x: 0, y: 0, next: [1] },
    { id: 1, x: 100, y: 0, next: [2, 4] },
    { id: 2, x: 200, y: 0, next: [3] },
    { id: 3, x: 300, y: 0, next: [] },
    { id: 4, x: 100, y: 100, next: [] },
    { id: 5, x: 900, y: 900, next: [] },
  ],
};

function world(tiles: number[], w: number, h: number): WorldData {
  return { seed: 0, widthTiles: w, heightTiles: h, tileSize: 100, tiles: Uint8Array.from(tiles), laneGraph: graph } as unknown as WorldData;
}

describe('findPath / NodeIndex', () => {
  it('finds a path between connected nodes', () => {
    expect(findPath(graph, 0, 3)).toEqual([0, 1, 2, 3]);
    expect(findPath(graph, 0, 4)).toEqual([0, 1, 4]);
    expect(findPath(graph, 2, 2)).toEqual([2]);
  });
  it('returns null when unreachable (directed / isolated)', () => {
    expect(findPath(graph, 3, 0)).toBeNull();
    expect(findPath(graph, 0, 5)).toBeNull();
  });
  it('nearest node lookup', () => {
    const idx = new NodeIndex(graph, 128);
    expect(idx.nearest(210, 20)).toBe(2);
    expect(idx.nearest(880, 950)).toBe(5);
  });
});

describe('steering', () => {
  it('steers clockwise (+) toward a target on the right/below, counter-clockwise (-) on the left', () => {
    expect(steerToward(0, 0, 0, 100, 100)).toBeGreaterThan(0);
    expect(steerToward(0, 0, 0, 100, -100)).toBeLessThan(0);
    expect(steerToward(0, 0, 0, 100, 0)).toBeCloseTo(0);
  });
  it('pure pursuit skips close nodes', () => {
    const p = pursuitTarget(graph, [0, 1, 2, 3], 0, 10, 0, 110);
    expect(p.cursor).toBe(2);
    expect(p.x).toBe(200);
  });
  it('leads the target by velocity', () => {
    expect(leadPoint({ x: 100, y: 50 }, { x: 500, y: -100 }, 0.4)).toEqual({ x: 300, y: 10 });
  });
});

describe('lineOfSight', () => {
  const t = Tile;
  const w = world([t.Road, t.Road, t.Road, t.Road, t.Road, t.Road], 3, 2);
  it('clear over drivable tiles, blocked by buildings', () => {
    expect(lineOfSight(w, { x: 10, y: 50 }, { x: 290, y: 50 })).toBe(true);
    const wb = world([t.Road, t.Building, t.Road, t.Road, t.Road, t.Road], 3, 2);
    expect(lineOfSight(wb, { x: 10, y: 50 }, { x: 290, y: 50 })).toBe(false);
  });
});

describe('think', () => {
  const w = world(new Array(100).fill(Tile.Road), 10, 10);
  const env = { world: w, index: new NodeIndex(graph), pickGoal: () => 3 };
  it('chases directly with lead when near and visible', () => {
    const brain = newBrain();
    const cmd = think(brain, env, { x: 100, y: 500, angle: 0, forwardSpeed: 300 }, 'chase', { x: 300, y: 500, vx: 0, vy: 400 }, 680, 0.016);
    expect(cmd.steer).toBeGreaterThan(0); // target is moving down => aim below => clockwise
    expect(cmd.throttle).toBe(1);
  });
  it('reverses when stuck', () => {
    const brain = newBrain();
    let cmd = { throttle: 1, brake: 0, steer: 0 };
    for (let i = 0; i < 60; i++) cmd = think(brain, env, { x: 100, y: 500, angle: 0, forwardSpeed: 0 }, 'chase', { x: 300, y: 500, vx: 0, vy: 0 }, 680, 0.016);
    expect(brain.reverseSec).toBeGreaterThan(0);
    expect(cmd.brake).toBe(1);
  });
  it('patrols along the lane graph', () => {
    const brain = newBrain();
    const cmd = think(brain, env, { x: 0, y: 0, angle: 0, forwardSpeed: 100 }, 'patrol', null, 370, 0.016);
    expect(brain.path.length).toBeGreaterThan(0);
    expect(cmd.throttle).toBe(1);
  });
});

describe('heat math', () => {
  it('gains scale up with impact, none for buildings', () => {
    expect(heatGain('building', 500)).toBe(0);
    expect(heatGain('police', 0)).toBe(POLICE.heatPerCrash.police);
    expect(heatGain('police', 600)).toBeGreaterThan(heatGain('police', 100));
    expect(heatGain('police', 99999)).toBeCloseTo(POLICE.heatPerCrash.police * 1.5);
  });
  it('clamps and decays', () => {
    expect(addHeat(95, 'police', 600)).toBe(POLICE.heatMax);
    expect(decayHeat(10, 1)).toBe(10 - POLICE.heatDecayPerSec);
    expect(decayHeat(1, 10)).toBe(0);
  });
  it('desired chasers scales with heat', () => {
    expect(desiredChasers(POLICE.heatChaseThreshold - 1)).toBe(0);
    expect(desiredChasers(POLICE.heatChaseThreshold)).toBe(1);
    expect(desiredChasers(POLICE.heatMax)).toBe(POLICE.maxChasersPerPlayer);
  });
  it('escape needs 1.5 s far, or turbo beyond 900', () => {
    const st = { farSec: 0 };
    expect(updateEscape(st, POLICE.loseDistance + 1, false, 1)).toBe(false);
    expect(updateEscape(st, POLICE.loseDistance + 1, false, 0.6)).toBe(true);
    const st2 = { farSec: 0 };
    expect(updateEscape(st2, 950, true, 0.016)).toBe(true);
    expect(updateEscape(st2, 950, false, 0.016)).toBe(false);
    expect(updateEscape({ farSec: 1 }, 100, false, 0.5)).toBe(false);
  });
});
