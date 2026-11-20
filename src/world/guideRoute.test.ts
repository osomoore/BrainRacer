import { expect, it } from 'vitest';
import { Tile, type WorldData } from '../core/types';
import { guideRoute } from './guideRoute';

it('chooses the permanent crossing when the direct span opens', () => {
  const { Road, Water } = Tile;
  const world: WorldData = {
    seed: 1, widthTiles: 7, heightTiles: 3, tileSize: 100,
    tiles: Uint8Array.of(
      Road, Road, Road, Road, Road, Road, Road,
      Road, Road, Water, Water, Water, Road, Road,
      Road, Road, Road, Road, Road, Road, Road,
    ),
    roadMask: new Uint8Array(21), buildings: [], places: [], props: [], ramps: [],
    laneGraph: { nodes: [] }, playerSpawns: [],
  };
  const start = { x: 150, y: 250 }, goal = { x: 550, y: 250 };
  expect(guideRoute(world, goal)(start)).toBe(goal);

  world.tiles.fill(Water, 16, 19);
  const around = guideRoute(world, goal);
  expect(around(start)).toEqual({ x: 150, y: 50 });
  expect(around({ x: 150, y: 50 })).toEqual({ x: 550, y: 50 });
});
