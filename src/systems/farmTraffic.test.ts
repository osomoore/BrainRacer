import { describe, expect, it } from 'vitest';
import { FARM_TRAFFIC } from '../config/gameConfig';
import { Rng } from '../core/rng';
import { Tile } from '../core/types';
import { type SpawnQuery } from '../entities/laneFollow';
import { generateFarm } from '../world/gen/farm';
import { findFarmStarts, hitchPoint, isFarmLaneNode, pickFarmStart, tileAtPx, trailerPose } from './farmTraffic';

describe('farm traffic spawns', () => {
  for (const seed of [1, 3, 7, 12]) {
    const world = generateFarm(seed);
    const starts = findFarmStarts(world);
    it(`seed ${seed}: has dirt-lane starts for tractors and combines`, () => {
      expect(starts.tractor.length).toBeGreaterThan(8);
      expect(starts.combine.length).toBeGreaterThan(0);
      for (const s of [...starts.tractor, ...starts.combine]) {
        expect(isFarmLaneNode(world, s.node)).toBe(true);
        const t = tileAtPx(world, s.node.x, s.node.y);
        expect(t === Tile.Dirt || t === Tile.Mud).toBe(true);
      }
    });
    it(`seed ${seed}: picking is deterministic and respects the query`, () => {
      const q: SpawnQuery = { players: [{ x: 0, y: 0 }], views: [], occupied: [], minR: 0, maxR: 1e9, margin: 0, gap: FARM_TRAFFIC.slowSpawnGap };
      const a = pickFarmStart(starts.tractor, q, new Rng(5)), b = pickFarmStart(starts.tractor, q, new Rng(5));
      expect(a).toBe(b);
      expect(pickFarmStart(starts.tractor, { ...q, maxR: 1 }, new Rng(5))).toBeUndefined();
      expect(pickFarmStart([], q, new Rng(5))).toBeUndefined();
    });
  }
});

describe('trailer follow math', () => {
  it('pins the front to the hitch and points along prev-to-hitch', () => {
    const p = trailerPose(100, 0, 40, 0, 60, 0);
    expect(p.angle).toBeCloseTo(0);
    expect(p.x).toBeCloseTo(40);
  });
  it('keeps the front on the hitch through a curve', () => {
    let x = -60, y = 0, angle = 0;
    for (let i = 0; i < 200; i++) {
      const th = i * 0.02;
      const hx = 300 * Math.sin(th), hy = 300 * (1 - Math.cos(th));
      const p = trailerPose(hx, hy, x, y, 60, angle);
      x = p.x; y = p.y; angle = p.angle;
      expect(Math.hypot(x + Math.cos(angle) * 60 - hx, y + Math.sin(angle) * 60 - hy)).toBeLessThan(1e-6);
    }
  });
  it('falls back to the given angle when degenerate', () => {
    expect(trailerPose(5, 5, 5, 5, 10, 1.2).angle).toBe(1.2);
  });
  it('hitch sits behind the tractor', () => {
    expect(hitchPoint(0, 0, 0, 80, 4).x).toBeCloseTo(-44);
  });
});
