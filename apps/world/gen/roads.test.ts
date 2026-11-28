import { describe, expect, it } from 'vitest';
import type { HexPlan } from '../core/types';
import { buildRoads } from './roads';
import { prepareSurface } from './surface';

describe('snow roads', () => {
  it('marks snow roads as icy without changing their passable route kind', () => {
    const roads = buildRoads(17, { q: 2, r: -1 }, 'snow');
    expect(roads).toHaveLength(2);
    expect(roads.every(road => road.surface === 'paved')).toBe(true);

    const plan: HexPlan = {
      coord: { q: 2, r: -1 }, biome: 'snow', seed: 17, center: { x: 0, y: 0 },
      links: [], roads, terrain: [], features: [], obstacles: [], activities: [], items: [],
    };
    const sample = prepareSurface(plan)(roads[0].points[1].x, roads[0].points[1].y);
    expect(sample.kind).toBe('road');
    expect(sample.roadSurface).toBe('paved');
    expect(sample.icyRoad).toBe(true);
  });

  it('does not mark roads in other biomes as icy', () => {
    expect(buildRoads(17, { q: 0, r: 0 }, 'meadow').every(road => road.surface === 'paved')).toBe(true);
    expect(buildRoads(17, { q: 0, r: 0 }, 'mud').every(road => road.surface === 'dirt')).toBe(true);
    const road = buildRoads(17, { q: 0, r: 0 }, 'meadow')[0];
    const plan: HexPlan = {
      coord: { q: 0, r: 0 }, biome: 'meadow', seed: 17, center: { x: 0, y: 0 },
      links: [], roads: [road], terrain: [], features: [], obstacles: [], activities: [], items: [],
    };
    const sample = prepareSurface(plan)(road.points[1].x, road.points[1].y);
    expect(sample.icyRoad).toBe(false);
  });

  it('does not mark a bridge over a snow road as icy road', () => {
    const road = buildRoads(17, { q: 0, r: 0 }, 'snow')[0];
    const at = road.points[1];
    const plan: HexPlan = {
      coord: { q: 0, r: 0 }, biome: 'snow', seed: 17, center: { x: 0, y: 0 },
      links: [], roads: [road], terrain: [],
      features: [{ id: 'bridge', kind: 'bridge', at, dir: 0, area: [
        { x: at.x - 100, y: at.y - 100 }, { x: at.x + 100, y: at.y - 100 },
        { x: at.x + 100, y: at.y + 100 }, { x: at.x - 100, y: at.y + 100 },
      ] }],
      obstacles: [], activities: [], items: [],
    };
    const sample = prepareSurface(plan)(at.x, at.y);
    expect(sample.kind).toBe('bridge');
    expect(sample.icyRoad).toBeUndefined();
  });
});
