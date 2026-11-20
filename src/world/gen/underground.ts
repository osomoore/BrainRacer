import { TILE_SIZE, WORLD } from '../../config/gameConfig';
import { Rng } from '../../core/rng';
import { Tile, type BuildingLot, type PlaceSite, type Vec2, type WorldData } from '../../core/types';
import { scenesForWord } from '../../data/scenes';
import { computeRoadMask, type Grid } from './grid';
import { generateLaneGraph } from './lanes';

export const UNDERGROUND_CROSSINGS = [9, 22, 37] as const;
export const UNDERGROUND_ROADS = [6, 17, 30, 40] as const;

export const UNDERGROUND_RAIL_LOOPS: readonly (readonly Vec2[])[] = [
  [{ x: 8.5, y: 13 }, { x: 10, y: 11.8 }, { x: 14.4, y: 11.8 }, { x: 15.7, y: 13.2 },
    { x: 15.7, y: 17.9 }, { x: 14.3, y: 19.35 }, { x: 10, y: 19.35 }, { x: 8.5, y: 18 }],
  [{ x: 33, y: 25.4 }, { x: 37.6, y: 25.4 }, { x: 38.7, y: 26.7 }, { x: 38.7, y: 32.9 },
    { x: 37.5, y: 34.25 }, { x: 33, y: 34.25 }, { x: 31.85, y: 33 }, { x: 31.85, y: 26.6 }],
];

/** Exclusive right bank. The staircase meander is shared by physics and render dressing. */
export function undergroundRiverSpan(y: number, height: number, seed: number): readonly [number, number] {
  const phase = (seed >>> 0) % 23 / 23;
  const displacement = Math.round(Math.sin((y / height + phase * 0.3) * Math.PI * 2) * 1.6);
  return [21 + displacement, 27 + displacement + Number(y % 13 > 8)];
}

export function isUndergroundLava(world: WorldData, x: number, y: number): boolean {
  const [left, right] = undergroundRiverSpan(y, world.heightTiles, world.seed);
  return x >= left && x < right && world.tiles[y * world.widthTiles + x] === Tile.Water;
}

interface Chamber { x: number; y: number; rx: number; ry: number }

/** A meandering lava channel separates connected chambers with three two-lane causeways. */
export function generateUnderground(seed: number): WorldData {
  const rng = new Rng(seed), w = WORLD.widthTiles, h = WORLD.heightTiles, ts = TILE_SIZE;
  const grid: Grid = { w, h, tiles: new Uint8Array(w * h), mask: new Uint8Array(w * h) };
  const lanes: Grid = { w, h, tiles: new Uint8Array(w * h), mask: new Uint8Array(w * h) };
  const chambers: Chamber[] = [
    { x: 11, y: 10, rx: 9, ry: 7 }, { x: 12, y: 17, rx: 9, ry: 7 },
    { x: 12, y: 30, rx: 9, ry: 9 }, { x: 11, y: 39, rx: 9, ry: 6 },
    { x: 35, y: 10, rx: 9, ry: 7 }, { x: 36, y: 20, rx: 9, ry: 7 },
    { x: 35, y: 29, rx: 9, ry: 8 }, { x: 36, y: 39, rx: 8, ry: 6 },
  ];
  for (let y = 2; y < h - 2; y++) {
    const [left, right] = undergroundRiverSpan(y, h, seed);
    for (let x = 2; x < w - 2; x++) {
      if (x >= left && x < right) continue;
      const roughness = rng.range(0.87, 1.14);
      if (chambers.some(c => ((x - c.x) / c.rx) ** 2 + ((y - c.y) / c.ry) ** 2 < roughness)) {
        grid.tiles[y * w + x] = Tile.Grass;
      }
    }
  }
  const layRoad = (x: number, y: number) => {
    lanes.tiles[y * w + x] = Tile.Road;
    for (const xx of [x, x + 1]) for (const yy of [y, y + 1]) grid.tiles[yy * w + xx] = Tile.Road;
  };
  for (const y of UNDERGROUND_CROSSINGS) for (let x = 6; x <= 40; x++) layRoad(x, y);
  for (const x of UNDERGROUND_ROADS) for (let y = 9; y <= 37; y++) layRoad(x, y);
  computeRoadMask(grid);
  const laneGraph = generateLaneGraph(lanes);
  for (const node of laneGraph.nodes) { node.x += ts / 2; node.y += ts / 2; }

  const buildings: BuildingLot[] = [], places: PlaceSite[] = [];
  const lots: [x: number, y: number, word: string, roadY: number][] = [
    [9, 6, 'cave', 9], [14, 6, 'shop', 9], [33, 6, 'train station', 9], [37, 6, 'museum', 9],
    [9, 24, 'house', 23], [14, 24, 'school', 23], [33, 20, 'restaurant', 22], [37, 20, 'tower', 22],
    [10, 39, 'library', 38], [14, 39, 'bakery', 38], [33, 39, 'cave', 38], [37, 39, 'well', 38],
  ];
  for (const [x, y, word, roadY] of lots) {
    const id = buildings.length;
    const placeWord = scenesForWord(word).length ? word : undefined;
    buildings.push({ id, tx: x, ty: y, tw: 2, th: 2, style: rng.int(0, 5), placeWord });
    for (const xx of [x, x + 1]) for (const yy of [y, y + 1]) grid.tiles[yy * w + xx] = Tile.Building;
    if (placeWord) places.push({ word: placeWord, buildingId: id, sign: { x: (x + 1) * ts, y: (y + 1) * ts },
      front: { x: (x + 1) * ts, y: (roadY + 0.5) * ts } });
  }
  const ramps = [[13.3, 9.4], [18.5, 23.6], [32.5, 38.5], [38, 10.55]].map(([x, y]) => (
    { x: x * ts, y: y * ts, angle: 0, w: WORLD.rampW, h: WORLD.rampH }
  ));

  return { seed, widthTiles: w, heightTiles: h, tileSize: ts, tiles: grid.tiles, roadMask: grid.mask, laneGraph,
    buildings, places, ramps, props: [], playerSpawns: [
      { x: 11.4 * ts, y: 9.6 * ts, angle: 0 }, { x: 10.25 * ts, y: 10.45 * ts, angle: 0 },
    ] };
}
