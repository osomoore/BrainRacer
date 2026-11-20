import { describe, expect, it } from 'vitest';
import { SKY_CROSSINGS, SKY_DRAWBRIDGE, SKY_FIXED_CROSSINGS, SKY_NORTH_SOUTH_ROADS } from '../../config/gameConfig';
import { Tile } from '../../core/types';
import { tileAt } from '../geometry';
import { largestScc } from './analysis';
import { DIRS } from './grid';
import { generateSky, isSkyBridgeDeck } from './sky';

describe('Sky-city', () => {
  it('keeps all roads and goals reachable when the sky drawbridge lifts', () => {
    const world = generateSky(4), ts = world.tileSize;
    const queue = [[Math.floor(world.playerSpawns[0].x / ts), Math.floor(world.playerSpawns[0].y / ts)]];
    const visited = new Set<string>();
    for (let i = 0; i < queue.length; i++) {
      const [x, y] = queue[i], key = `${x},${y}`;
      if (visited.has(key) || isSkyBridgeDeck(x, y) || tileAt(world, x, y) !== Tile.Road) continue;
      visited.add(key);
      for (const { dx, dy } of DIRS) queue.push([x + dx, y + dy]);
    }
    const worldRoadCount = world.tiles.filter((tile, index) => tile === Tile.Road &&
      !isSkyBridgeDeck(index % world.widthTiles, Math.floor(index / world.widthTiles))).length;
    expect(visited.size).toBe(worldRoadCount);
    expect(world.places.length).toBeGreaterThanOrEqual(10);
    for (const p of world.places) expect(visited.has(`${Math.floor(p.front.x / ts)},${Math.floor(p.front.y / ts)}`)).toBe(true);
    const center = (SKY_DRAWBRIDGE.left + SKY_DRAWBRIDGE.right) / 2;
    expect(tileAt(world, center, SKY_CROSSINGS[0])).toBe(Tile.Road);
    expect(tileAt(world, center, SKY_CROSSINGS[2])).toBe(Tile.Road);
    expect(tileAt(world, center, SKY_CROSSINGS[2] - 1)).toBe(Tile.Water);
  });

  it('keeps traffic connected on permanent roads and out of the drawbridge mechanism', () => {
    const world = generateSky(16), ts = world.tileSize;
    const { nodes } = world.laneGraph;
    expect(largestScc(world.laneGraph)).toBe(nodes.length);
    for (const { x, y } of nodes) {
      expect(tileAt(world, Math.floor(x / ts), Math.floor(y / ts))).toBe(Tile.Road);
      expect(isSkyBridgeDeck(x / ts, y / ts)).toBe(false);
    }
  });

  it('fills the permanent skyways and their approaches with continuous two-tile decks', () => {
    const world = generateSky(16);
    for (const row of SKY_FIXED_CROSSINGS) {
      for (let x = 17; x < 31; x++) {
        expect(tileAt(world, x, row)).toBe(Tile.Road);
        expect(tileAt(world, x, row + 1)).toBe(Tile.Road);
      }
    }
    for (const x of SKY_NORTH_SOUTH_ROADS) {
      for (let y = 19; y < 29; y++) {
        expect(tileAt(world, x, y)).toBe(Tile.Road);
        expect(tileAt(world, x + 1, y)).toBe(Tile.Road);
      }
    }
    expect(world.buildings.filter(lot => !lot.placeWord && lot.style >= 6).length).toBeGreaterThanOrEqual(20);
  });

  it('repeats the same layout and architecture for a seed', () => {
    expect(generateSky(248)).toEqual(generateSky(248));
    expect(generateSky(248).buildings).not.toEqual(generateSky(249).buildings);
  });
});
