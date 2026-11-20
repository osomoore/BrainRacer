import { SKY_CROSSINGS, SKY_DRAWBRIDGE, TILE_SIZE, WORLD } from '../../config/gameConfig';
import { Rng } from '../../core/rng';
import { Tile, type BuildingLot, type PlaceSite, type WorldData } from '../../core/types';
import { scenesForWord } from '../../data/scenes';
import { computeRoadMask, type Grid } from './grid';
import { generateLaneGraph } from './lanes';

export function isSkyBridgeDeck(x: number, y: number): boolean {
  const b = SKY_DRAWBRIDGE;
  return x >= b.left && x < b.right && y >= b.row && y < b.row + b.height;
}

/** Four floating districts. Suspended decks form a connected circuit even with the middle span raised. */
export function generateSky(seed: number): WorldData {
  const rng = new Rng(seed);
  const { widthTiles: w, heightTiles: h } = WORLD;
  const ts = TILE_SIZE;
  const grid: Grid = { w, h, tiles: new Uint8Array(w * h), mask: new Uint8Array(w * h) };
  const lanes: Grid = { w, h, tiles: new Uint8Array(w * h), mask: new Uint8Array(w * h) };
  const paint = (x: number, y: number, width: number, height: number, tile: Tile) => {
    for (let row = y; row < y + height; row++) grid.tiles.fill(tile, row * w + x, row * w + x + width);
  };
  for (const [left, right] of [[4, SKY_DRAWBRIDGE.left], [SKY_DRAWBRIDGE.right, 44]]) {
    for (const [top, bottom] of [[5, 20], [27, 43]]) {
      // Stepped corners leave space for visible girders and under-deck propulsion rings.
      paint(left + 2, top, right - left - 4, bottom - top, Tile.Plaza);
      paint(left, top + 2, right - left, bottom - top - 4, Tile.Plaza);
    }
  }
  const road = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      // Traffic uses the permanent crossings. The lifting deck stays clear for players and airships.
      if (!isSkyBridgeDeck(x, y) && !(y === SKY_DRAWBRIDGE.row && x === SKY_DRAWBRIDGE.left - 1)) {
        lanes.tiles[y * w + x] = Tile.Road;
      }
      paint(x, y, 2, 2, Tile.Road);
    }
  };
  for (const y of SKY_CROSSINGS) road(7, y, 39, y);
  for (const x of [7, 17, 29, 39]) road(x, 8, x, 39);
  for (const y of [12, 39]) {
    road(7, y, 17, y);
    road(29, y, 39, y);
  }

  const buildings: BuildingLot[] = [];
  const places: PlaceSite[] = [];
  const sites = [
    [10, 6, 'tower', 8], [14, 6, 'museum', 8], [32, 6, 'train station', 8], [36, 6, 'shop', 8],
    [10, 14, 'bakery', 16], [14, 14, 'library', 16], [32, 14, 'restaurant', 16], [36, 14, 'school', 16],
    [10, 33, 'house', 31], [14, 35, 'farm', 39], [32, 33, 'church', 31], [36, 35, 'park', 39],
  ] as const;
  for (const [x, y, word, streetY] of sites) {
    const id = buildings.length;
    const placeWord = scenesForWord(word).length ? word : undefined;
    buildings.push({ id, tx: x, ty: y, tw: 2, th: 2, style: rng.int(0, 5), placeWord });
    paint(x, y, 2, 2, Tile.Building);
    if (placeWord) places.push({ word: placeWord, buildingId: id,
      sign: { x: (x + 1) * ts, y: (y + 1) * ts }, front: { x: (x + 1) * ts, y: (streetY + .55) * ts } });
  }
  computeRoadMask(grid);
  const laneGraph = generateLaneGraph(lanes);
  for (const node of laneGraph.nodes) { node.x += ts / 2; node.y += ts / 2; }

  return {
    seed, widthTiles: w, heightTiles: h, tileSize: ts, tiles: grid.tiles, roadMask: grid.mask,
    laneGraph, buildings, places, props: [], ramps: [
      { x: 11.6 * ts, y: 30.6 * ts, angle: 0, w: WORLD.rampW, h: WORLD.rampH },
      { x: 35.2 * ts, y: 39.6 * ts, angle: Math.PI, w: WORLD.rampW, h: WORLD.rampH },
    ], playerSpawns: [
      { x: 17.6 * ts, y: 16.64 * ts, angle: 0 }, { x: 16.5 * ts, y: 17.36 * ts, angle: 0 },
    ],
  };
}
