import { describe, expect, it } from 'vitest';
import { FOREST } from '../../config/gameConfig';
import { Tile, type Vec2, type WorldData } from '../../core/types';
import { measureCircuit } from '../../systems/freightTiming';
import { largestScc } from './analysis';
import { forestRailRoute, generateForest } from './forest';

function tileAt(world: WorldData, point: Vec2): Tile {
  const tx = Math.floor(point.x / world.tileSize), ty = Math.floor(point.y / world.tileSize);
  return world.tiles[ty * world.widthTiles + tx];
}

describe('Dark Forest', () => {
  it('generates a connected, seed-reproducible street plan with accessible goals', () => {
    const world = generateForest(7);
    expect(world).toEqual(generateForest(7));
    expect(world.props).not.toEqual(generateForest(8).props);
    expect(world.places.length).toBeGreaterThan(10);
    expect(world.ramps.length).toBeGreaterThan(0);
    expect(world.props.filter(prop => prop.kind === 'tree').length).toBeGreaterThan(FOREST.treeCount * .9);
    expect(world.props.filter(prop => prop.kind === 'bush').length).toBeGreaterThan(FOREST.shrubCount * .9);
    expect(largestScc(world.laneGraph)).toBe(world.laneGraph.nodes.length);
    expect([...world.laneGraph.nodes, ...world.playerSpawns, ...world.places.map(place => place.front)]
      .every(point => tileAt(world, point) === Tile.Road)).toBe(true);
    for (const prop of world.props) {
      expect([Tile.Park, Tile.Grass, Tile.Sidewalk]).toContain(tileAt(world, prop));
    }
  });

  it('takes the logging line across exactly eight road crossings and clears nearby buildings', () => {
    const world = generateForest(3);
    const { tileSize } = world;
    const { crossings, length, sample } = measureCircuit(forestRailRoute());
    expect(crossings).toHaveLength(8);
    for (const { center, dx, dy, width, start } of crossings) {
      expect(tileAt(world, center)).toBe(Tile.Road);
      for (const sign of [-1, 1]) {
        const offset = sign * (width / 2 + 4);
        expect(tileAt(world, { x: center.x + offset * dx, y: center.y + offset * dy })).not.toBe(Tile.Road);
      }
      const centerOnTrack = sample(start + tileSize);
      expect(centerOnTrack.x).toBeCloseTo(center.x);
      expect(centerOnTrack.y).toBeCloseTo(center.y);
    }
    for (let distance = 0; distance < length; distance += 16) {
      expect(tileAt(world, sample(distance))).not.toBe(Tile.Building);
    }
    expect(sample(-1)).toEqual(sample(length - 1));
  });
});
