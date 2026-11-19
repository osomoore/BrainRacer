import { TILE_SIZE, WORLD } from '../../config/gameConfig';
import { Rng } from '../../core/rng';
import { Tile, type BuildingLot, type IndustrialDecoration, type PlaceSite, type Vec2, type WorldData } from '../../core/types';
import { computeRoadMask, type Grid } from './grid';
import { generateLaneGraph } from './lanes';

type Strip = readonly [x: number, y: number, width: number, height: number];
const CANAL_WEST = 22;
const CANAL_EAST = 26;
const NORTH_BRIDGE = 10;
const SOUTH_BRIDGE = 36;
const CROSSING_X = 8;
const RAIL_Y = 24;
const ROAD_WIDTH = 2;

// Two playable tiles make a wide road. A separate one-tile skeleton generates
// traffic turns, then shifts to the physical center of the wider road.
const HORIZONTAL: readonly Strip[] = [
  [8, 5, 12, ROAD_WIDTH], // freight loop, north edge
  [8, NORTH_BRIDGE, 34, ROAD_WIDTH],
  [37, 24, 5, ROAD_WIDTH], // factory loop cross street
  [8, SOUTH_BRIDGE, 34, ROAD_WIDTH],
  [8, 42, 12, ROAD_WIDTH], // loading loop, south edge
];
const VERTICAL: readonly Strip[] = [
  [CROSSING_X, 5, ROAD_WIDTH, 39],
  [18, 5, ROAD_WIDTH, 7],
  [18, SOUTH_BRIDGE, ROAD_WIDTH, 8],
  [37, NORTH_BRIDGE, ROAD_WIDTH, 28],
  [40, NORTH_BRIDGE, ROAD_WIDTH, 28],
];

const px = (x: number, y: number): Vec2 => ({ x: x * TILE_SIZE, y: y * TILE_SIZE });

function paint(grid: Grid, [x, y, w, h]: Strip, tile: Tile): void {
  for (let row = y; row < y + h; row++) grid.tiles.fill(tile, row * grid.w + x, row * grid.w + x + w);
}

function decoration(kind: IndustrialDecoration['kind'], x: number, y: number, w: number, h: number): IndustrialDecoration {
  return { kind, ...px(x, y), w: w * TILE_SIZE, h: h * TILE_SIZE, angle: 0 };
}

/** A seeded industrial district with fixed bridge and crossing landmarks. */
export function generateIndustrial(seed: number): WorldData {
  const rng = new Rng(seed);
  const w = WORLD.widthTiles, h = WORLD.heightTiles, border = WORLD.waterBorderTiles;
  const grid: Grid = { w, h, tiles: new Uint8Array(w * h), mask: new Uint8Array(w * h) };
  const traffic: Grid = { w, h, tiles: new Uint8Array(w * h), mask: new Uint8Array(w * h) };
  paint(grid, [border, border, w - 2 * border, h - 2 * border], Tile.Plaza);
  paint(grid, [CANAL_WEST, border, CANAL_EAST - CANAL_WEST, h - 2 * border], Tile.Water);
  for (const [x, y, width, height] of HORIZONTAL) {
    paint(grid, [x, y, width, height], Tile.Road);
    paint(traffic, [x, y, width - 1, 1], Tile.Road);
  }
  for (const [x, y, width, height] of VERTICAL) {
    paint(grid, [x, y, width, height], Tile.Road);
    paint(traffic, [x, y, 1, height - 1], Tile.Road);
  }
  computeRoadMask(grid);

  const buildings: BuildingLot[] = [];
  const places: PlaceSite[] = [];
  const lot = ([tx, ty, tw, th]: Strip, word?: string, front?: Vec2) => {
    const id = buildings.length;
    buildings.push({ id, tx, ty, tw, th, style: rng.int(0, 5), placeWord: word });
    paint(grid, [tx, ty, tw, th], Tile.Building);
    if (word && front) places.push({ word, buildingId: id, sign: px(tx + tw / 2, ty + th / 2), front });
  };

  // Signed exits and approaches sit on the loop and away from walls and rail.
  lot([10, 13, 3, 2], 'train station', px(CROSSING_X + 1, NORTH_BRIDGE + 1));
  lot([33, 6, 3, 2], 'bridge', px(37.5, NORTH_BRIDGE + 1));
  lot([10, 32, 4, 2], 'airport', px(CROSSING_X + 1, SOUTH_BRIDGE + 1));
  lot([34, 40, 3, 2], 'water tower', px(37.5, SOUTH_BRIDGE + 1));

  // Low perimeter warehouses frame the district without blocking the open yards.
  lot([3, 8, 3, rng.int(7, 10)]);
  lot([3, 32, 3, rng.int(7, 10)]);
  lot([11, 3, rng.int(4, 7), 2]);
  lot([42, 13, 3, rng.int(5, 8)]);
  lot([42, 27, 3, rng.int(5, 8)]);
  lot([27, 3, rng.int(4, 6), 3]);
  lot([27, 42, rng.int(4, 6), 3]);

  const bridge = (y: number) => decoration('bridge', (CANAL_WEST + CANAL_EAST) / 2, y + 1, CANAL_EAST - CANAL_WEST, ROAD_WIDTH);
  const decorations = [
    bridge(NORTH_BRIDGE),
    bridge(SOUTH_BRIDGE),
    decoration('factoryBay', 32, NORTH_BRIDGE + 1, 6, 3.25),
    decoration('factoryBay', 32, SOUTH_BRIDGE + 1, 6, 3.25),
    decoration('gantry', 12, NORTH_BRIDGE + 1, 1.5, 3.25),
    decoration('gantry', 12, SOUTH_BRIDGE + 1, 1.5, 3.25),
    decoration('loadingYard', 14, 40, 7, 4),
    decoration('loadingYard', 13.5, 8.25, 6.5, 2.5),
    decoration('waterTower', 37.5, 41.5, 1.75, 1.75),
  ];
  const rail = {
    start: px(0, RAIL_Y), end: px(CANAL_WEST, RAIL_Y),
    crossing: px(CROSSING_X + ROAD_WIDTH / 2, RAIL_Y), crossingWidth: ROAD_WIDTH * TILE_SIZE,
  };

  const spawn = px(rng.range(15.5, 16.5), NORTH_BRIDGE + 1);
  const laneGraph = generateLaneGraph(traffic);
  for (const node of laneGraph.nodes) {
    node.x += TILE_SIZE / 2;
    node.y += TILE_SIZE / 2;
  }
  return {
    seed, widthTiles: w, heightTiles: h, tileSize: TILE_SIZE,
    tiles: grid.tiles, roadMask: grid.mask, buildings, places,
    industrial: { decorations, rail },
    ramps: [{ ...px(13, 42.75), angle: 0, w: WORLD.rampW, h: WORLD.rampH }],
    props: [],
    laneGraph,
    playerSpawns: [1, -1].map((direction) => ({ ...spawn, y: spawn.y + direction * WORLD.spawnSpacingPx / 2, angle: 0 })),
  };
}
