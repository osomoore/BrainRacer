import { Rng } from '../../core/rng';
import { TILE_SIZE, WORLD } from '../../config/gameConfig';
import { Tile, type WorldData } from '../../core/types';
import { CITY_PLACE_WORDS } from '../../data/places';
import { generateBlocks } from './blocks';
import { generateLaneGraph } from './lanes';
import { generatePlaces } from './places';
import { generateProps } from './props';
import { generateRamps } from './ramps';
import { generateRoads } from './roads';
import { generateSpawns } from './spawns';
import type { Grid } from './grid';

export { toAscii, largestScc } from './analysis';
export type { Biome } from './biome';
export { biomeAt } from './biome';

/** Procedural city. Deterministic for a given seed (Rng only, no Math.random). */
export function cityGen(seed: number): WorldData {
  const rng = new Rng(seed);
  const w = WORLD.widthTiles, h = WORLD.heightTiles, b = WORLD.waterBorderTiles;
  const g: Grid = { w, h, tiles: new Uint8Array(w * h), mask: new Uint8Array(w * h) };
  for (let y = b; y < h - b; y++) for (let x = b; x < w - b; x++) g.tiles[y * w + x] = Tile.Grass;

  const featureTiles = generateRoads(rng.fork(1), g);
  const blocks = generateBlocks(rng.fork(2), g, seed, featureTiles);
  const places = generatePlaces(rng.fork(3), g, blocks, CITY_PLACE_WORDS);
  const playerSpawns = generateSpawns(rng.fork(4), g);
  const ramps = generateRamps(rng.fork(5), g, playerSpawns);
  const props = generateProps(rng.fork(6), g, ramps, playerSpawns);
  const laneGraph = generateLaneGraph(g);

  return {
    seed, widthTiles: w, heightTiles: h, tileSize: TILE_SIZE,
    tiles: g.tiles, roadMask: g.mask,
    buildings: blocks.lots, places, ramps, props, laneGraph, playerSpawns,
  };
}
