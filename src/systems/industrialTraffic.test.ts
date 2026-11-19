import { describe, expect, it } from 'vitest';
import { FREIGHT_TRUCK_SPEC, INDUSTRIAL_TRAFFIC, TRAFFIC } from '../config/gameConfig';
import { Rng } from '../core/rng';
import { type SpawnQuery } from '../entities/laneFollow';
import { generateIndustrial } from '../world/gen/industrial';
import { isDrivable } from '../world/geometry';
import { findFreightStarts, pickFreightStart } from './industrialTraffic';

describe('industrial freight traffic', () => {
  const world = generateIndustrial(3);
  const starts = findFreightStarts(world);

  it('starts long rigs on straight, drivable lanes near both loading yards', () => {
    const yards = world.industrial!.decorations.filter((d) => d.kind === 'loadingYard');
    for (const yard of yards) {
      expect(starts.some(({ node }) => Math.abs(node.y - yard.y) < 3 * world.tileSize)).toBe(true);
    }
    for (const { node, next } of starts) {
      const angle = Math.atan2(next.y - node.y, next.x - node.x);
      for (const l of [-FREIGHT_TRUCK_SPEC.length / 2, FREIGHT_TRUCK_SPEC.length / 2]) {
        for (const w of [-FREIGHT_TRUCK_SPEC.width / 2, FREIGHT_TRUCK_SPEC.width / 2]) {
          const x = node.x + l * Math.cos(angle) - w * Math.sin(angle);
          const y = node.y + l * Math.sin(angle) + w * Math.cos(angle);
          expect(isDrivable(world, x, y)).toBe(true);
        }
      }
    }
  });

  it('stays outside both cameras and leaves room for nearby vehicles', () => {
    const candidate = starts[0];
    const { x, y } = candidate.node;
    const query: SpawnQuery = {
      players: [{ x: x - 950, y }, { x: x + 1050, y }],
      views: [{ x: x - 1200, y: y - 100, w: 500, h: 200 }],
      occupied: [], minR: TRAFFIC.initialSpawnMin, maxR: TRAFFIC.spawnRadiusMax,
      margin: TRAFFIC.spawnMargin, gap: INDUSTRIAL_TRAFFIC.freightSpawnGap,
    };
    const rng = new Rng(3);
    expect(pickFreightStart([candidate], query, rng)).toBe(candidate);
    expect(pickFreightStart([candidate], {
      ...query, views: [...query.views, { x: x + 100, y: y - 100, w: 600, h: 200 }],
    }, rng)).toBeUndefined();
    expect(pickFreightStart([candidate], { ...query, occupied: [{ x: x - query.gap + 1, y }] }, rng)).toBeUndefined();
    expect(pickFreightStart([candidate], { ...query, players: [{ x: x + query.maxR + 1, y }] }, rng)).toBeUndefined();
  });
});
