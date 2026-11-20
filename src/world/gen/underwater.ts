import { TILE_SIZE, UNDERWATER_CROSSING, WORLD } from '../../config/gameConfig';
import { Rng } from '../../core/rng';
import { Tile, type BuildingLot, type PlaceSite, type WorldData } from '../../core/types';
import { scenesForWord } from '../../data/scenes';
import { computeRoadMask, type Grid } from './grid';
import { generateLaneGraph } from './lanes';

export function isUnderwaterCrossing(x: number, y: number, tileSize: number): boolean {
  const { left, right, top, bottom } = UNDERWATER_CROSSING;
  return x >= left * tileSize && x < right * tileSize && y >= top * tileSize && y < bottom * tileSize;
}

/** Two neighborhoods encircle their own plazas. Deep-water tunnels connect them at three levels. */
export function generateUnderwater(seed: number): WorldData {
  const rng = new Rng(seed);
  const w = WORLD.widthTiles, h = WORLD.heightTiles, ts = TILE_SIZE;
  const grid: Grid = { w, h, tiles: new Uint8Array(w * h), mask: new Uint8Array(w * h) };
  const lanes: Grid = { w, h, tiles: new Uint8Array(w * h), mask: new Uint8Array(w * h) };
  const deck = (x: number, y: number, width: number, height: number, tile: Tile) => {
    for (let yy = y; yy < y + height; yy++) {
      grid.tiles.fill(tile, yy * w + x, yy * w + x + width);
    }
  };
  deck(5, 7, 15, 17, Tile.Plaza);
  deck(7, 24, 9, 16, Tile.Plaza);
  deck(5, 33, 15, 5, Tile.Plaza);
  deck(29, 9, 15, 15, Tile.Plaza);
  deck(33, 24, 9, 15, Tile.Plaza);
  deck(29, 33, 15, 5, Tile.Plaza);

  const road = (x0: number, y0: number, x1: number, y1: number, traffic = true) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      deck(x, y, 2, 2, Tile.Road);
      if (traffic) lanes.tiles[y * w + x] = Tile.Road;
    }
  };
  // Traffic uses the north and south bypasses, so the moving span stays clear of lane-following cars.
  road(6, 8, 17, 8);
  road(6, 8, 6, 36);
  road(17, 8, 17, 36);
  road(17, 10, 41, 10);
  road(30, 10, 30, 36);
  road(41, 10, 41, 36);
  road(6, 36, 41, 36);
  road(6, 20, 17, 20);
  road(17, 20, 30, 20, false);
  road(30, 20, 41, 20);
  road(6, 29, 17, 29);
  road(30, 29, 41, 29);

  computeRoadMask(grid);
  const laneGraph = generateLaneGraph(lanes);
  for (const node of laneGraph.nodes) { node.x += ts / 2; node.y += ts / 2; }

  const buildings: BuildingLot[] = [], places: PlaceSite[] = [];
  const lots = [
    [8, 11, 'school', 8.65], [11, 11, 'shop', 9.35], [14, 11, 'bakery', 9.35],
    [8, 17, 'museum', 20.65], [11, 16, 'library', 20.65], [14, 17, 'tower', 20.65],
    [8, 23, 'restaurant', 21.35], [13, 25, 'house', 29.35], [9, 32, 'park', 36.65],
    [32, 12, 'school', 11.35], [35, 13, 'hospital', 11.35], [38, 12, 'library', 11.35],
    [32, 17, 'museum', 20.65], [35, 18, 'restaurant', 20.65], [38, 17, 'tower', 20.65],
    [34, 24, 'shop', 21.35], [38, 25, 'house', 29.35], [34, 32, 'bakery', 36.65],
    [38, 33, 'park', 36.65],
  ] as const;
  for (const [x, y, word, roadY] of lots) {
    const id = buildings.length;
    const placeWord = scenesForWord(word).length ? word : undefined;
    buildings.push({ id, tx: x, ty: y, tw: 2, th: 2, style: rng.int(0, 5), placeWord });
    deck(x, y, 2, 2, Tile.Building);
    if (placeWord) places.push({ word: placeWord, buildingId: id, sign: { x: (x + 1) * ts, y: (y + 1) * ts },
      front: { x: (x + 1) * ts, y: roadY * ts } });
  }

  const ramps = [[11.5, 9.35], [19.3, 10.6], [34.5, 37.4]].map(([x, y]) => (
    { x: x * ts, y: y * ts, angle: 0, w: WORLD.rampW, h: WORLD.rampH }
  ));
  return { seed, widthTiles: w, heightTiles: h, tileSize: ts, tiles: grid.tiles, roadMask: grid.mask,
    buildings, places, ramps, props: [], laneGraph, playerSpawns: [
      { x: 17.5 * ts, y: 21.35 * ts, angle: 0 }, { x: 16.3 * ts, y: 20.55 * ts, angle: 0 },
    ] };
}
