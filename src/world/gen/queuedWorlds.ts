import { TILE_SIZE, WORLD } from '../../config/gameConfig';
import { QUEUED_MAPS, type QueuedMap } from '../../config/queuedMaps';
import { Rng } from '../../core/rng';
import { Tile, type BuildingLot, type PlaceSite, type WorldData } from '../../core/types';
import { scenesForWord } from '../../data/scenes';
import { computeRoadMask, type Grid } from './grid';
import { generateLaneGraph } from './lanes';

type Four = readonly [number, number, number, number];
type Area = readonly [x: number, y: number, w: number, h: number];
type Plan = {
  columns: Four;
  rows: Four;
  moverSide: 'west' | 'east';
  outerLinks: readonly [west: boolean, east: boolean];
  accent: readonly Area[];
  words: readonly string[];
};

const PLANS: Record<QueuedMap, Plan> = {
  brickworks: {
    columns: [5, 16, 30, 42], rows: [6, 17, 29, 41], moverSide: 'west', outerLinks: [true, false],
    accent: [[8, 8, 8, 9], [32, 31, 10, 10], [19, 21, 6, 8]],
    words: ['workshop', 'house', 'school', 'tower', 'shop', 'museum', 'library', 'park'],
  },
  mushroom: {
    columns: [6, 16, 29, 40], rows: [8, 18, 29, 38], moverSide: 'east', outerLinks: [false, true],
    accent: [[8, 9, 9, 9], [8, 20, 8, 11], [30, 24, 10, 13]],
    words: ['park', 'house', 'bakery', 'shop', 'restaurant', 'library', 'school', 'museum'],
  },
  tundra: {
    columns: [5, 19, 31, 42], rows: [5, 16, 29, 41], moverSide: 'west', outerLinks: [true, true],
    accent: [[7, 17, 8, 10], [24, 30, 7, 9], [33, 9, 6, 7]],
    words: ['house', 'shop', 'school', 'hospital', 'park', 'library', 'restaurant', 'tower'],
  },
  volcano: {
    columns: [7, 18, 30, 42], rows: [7, 16, 27, 40], moverSide: 'east', outerLinks: [false, false],
    accent: [[19, 29, 10, 10], [10, 19, 7, 8], [32, 10, 8, 6]],
    words: ['museum', 'tower', 'house', 'shop', 'school', 'park', 'restaurant', 'library'],
  },
  candy: {
    columns: [4, 16, 28, 41], rows: [6, 18, 31, 41], moverSide: 'west', outerLinks: [true, true],
    accent: [[6, 8, 9, 10], [30, 9, 9, 9], [17, 32, 10, 8]],
    words: ['bakery', 'shop', 'restaurant', 'house', 'park', 'school', 'library', 'museum'],
  },
  castle: {
    columns: [5, 15, 29, 42], rows: [6, 20, 31, 42], moverSide: 'east', outerLinks: [true, false],
    accent: [[16, 8, 14, 12], [7, 32, 10, 8], [33, 21, 9, 8]],
    words: ['tower', 'church', 'house', 'shop', 'library', 'museum', 'park', 'bakery'],
  },
  airport: {
    columns: [5, 18, 29, 42], rows: [6, 19, 28, 41], moverSide: 'west', outerLinks: [false, true],
    accent: [[6, 7, 13, 10], [7, 30, 34, 10], [30, 8, 12, 10]],
    words: ['airport', 'tower', 'shop', 'restaurant', 'museum', 'house', 'hospital', 'park'],
  },
  house: {
    columns: [4, 16, 31, 42], rows: [5, 16, 30, 42], moverSide: 'east', outerLinks: [true, true],
    accent: [[6, 7, 10, 9], [18, 18, 11, 11], [33, 32, 9, 9]],
    words: ['house', 'bed', 'chair', 'book', 'library', 'shop', 'park', 'bakery', 'school'],
  },
};

function layout(map: QueuedMap, seed: number) {
  const plan = PLANS[map];
  const rng = new Rng(seed).fork(QUEUE_LAYOUT_SALT);
  const [left, innerWest, innerEast, right] = plan.columns;
  const [top, shortcut, mid, bottom] = plan.rows;
  return {
    columns: [left, innerWest + rng.int(-1, 1), innerEast + rng.int(-1, 1), right] as const,
    rows: [top, shortcut + rng.int(-1, 1), mid + rng.int(-1, 1), bottom] as const,
  };
}

const QUEUE_LAYOUT_SALT = 0x65e7e2;
const VOLCANO_PEAK: Area = [23, 30, 5, 3];

export function queuedVolcanoPeak(world: Pick<WorldData, 'tileSize'>) {
  const [x, y, w, h] = VOLCANO_PEAK;
  return { x: (x + w / 2) * world.tileSize, y: (y + h / 2) * world.tileSize };
}

/** Feature positions share the same seed and geometry as the generated layout. */
export function queuedFeatureSites(map: QueuedMap, world: Pick<WorldData, 'seed' | 'tileSize' | 'widthTiles'>) {
  const { columns: [left, west, east, right], rows: [top, shortcut] } = layout(map, world.seed);
  const ts = world.tileSize;
  const gateX = Math.floor((west + east) / 2);
  const [start, end] = PLANS[map].moverSide === 'west' ? [left + 4, west - 2] : [east + 4, right - 2];
  return {
    gate: {
      x: (gateX + 0.5) * ts, y: (shortcut + 1) * ts, angle: 0,
      tiles: [shortcut * world.widthTiles + gateX, (shortcut + 1) * world.widthTiles + gateX],
    },
    mover: { x: ((start + end) / 2 + 0.5) * ts, y: (top + 5.5) * ts, angle: 0, length: (end - start) * ts },
  };
}

export function queuedIceAt(world: WorldData, x: number, y: number): boolean {
  const tx = Math.floor(x / world.tileSize), ty = Math.floor(y / world.tileSize);
  return tx >= 0 && tx < world.widthTiles && ty >= 0 && ty < world.heightTiles &&
    world.tiles[ty * world.widthTiles + tx] === Tile.Dirt;
}

function paint(grid: Grid, x: number, y: number, w: number, h: number, tile: Tile): void {
  for (let row = y; row < y + h; row++) grid.tiles.fill(tile, row * grid.w + x, row * grid.w + x + w);
}

function terrain(grid: Grid, map: QueuedMap, rng: Rng): void {
  const { w, h } = grid;
  paint(grid, 2, 2, w - 4, h - 4, Tile.Grass);
  for (const [x, y, width, height] of PLANS[map].accent) {
    paint(grid, x, y, width, height, map === 'tundra' ? Tile.Dirt : Tile.Park);
  }
  if (map === 'mushroom') {
    for (const [x, y] of [[2, 2], [w - 8, 2], [2, h - 8], [w - 8, h - 8]]) {
      paint(grid, x, y, 6, 6, Tile.Water);
    }
    paint(grid, 19, 3, 10, 5, Tile.Water);
    paint(grid, 20, 40, 7, 6, Tile.Water);
  }
  if (map === 'volcano') {
    const x = rng.int(21, 23);
    paint(grid, x, 33, 5, 4, Tile.Water);
    paint(grid, x + 2, 35, 6, 3, Tile.Water);
    paint(grid, 34, 34, 4, 4, Tile.Water);
  }
}

/** Road rectangles are two tiles wide. The lane graph follows their shared centerline. */
export function generateQueuedWorld(map: QueuedMap, seed: number): WorldData {
  const rng = new Rng(seed).fork(QUEUE_LAYOUT_SALT + QUEUED_MAPS.indexOf(map) + 1);
  const w = WORLD.widthTiles, h = WORLD.heightTiles, ts = TILE_SIZE;
  const grid: Grid = { w, h, tiles: new Uint8Array(w * h), mask: new Uint8Array(w * h) };
  const lanes: Grid = { w, h, tiles: new Uint8Array(w * h), mask: new Uint8Array(w * h) };
  const { columns, rows } = layout(map, seed);
  const [left, west, east, right] = columns;
  const [top, shortcut, mid, bottom] = rows;
  const { mover, gate } = queuedFeatureSites(map, { seed, tileSize: ts, widthTiles: w });
  terrain(grid, map, rng);

  const gateX = Math.floor(gate.x / ts);
  // The timed crossing spans a channel with permanent road crossings above and below.
  paint(grid, gateX - 1, top + 2, 3, mid - top - 2, Tile.Water);
  const road = (x0: number, y0: number, x1: number, y1: number, traffic = true) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      paint(grid, x, y, 2, 2, Tile.Road);
      if (traffic) lanes.tiles[y * w + x] = Tile.Road;
    }
  };
  for (const y of [top, mid, bottom]) road(left, y, right, y);
  road(left, shortcut, west, shortcut);
  road(west, shortcut, east, shortcut, false);
  road(east, shortcut, right, shortcut);
  road(left, top, left, bottom);
  road(right, top, right, bottom);
  road(west, top, west, mid);
  road(east, top, east, mid);
  if (PLANS[map].outerLinks[0]) road(west, mid, west, bottom);
  if (PLANS[map].outerLinks[1]) road(east, mid, east, bottom);

  switch (map) {
    case 'brickworks':
      road(left + 5, shortcut, left + 5, mid);
      break;
    case 'mushroom':
      road(east, mid + 5, right, mid + 5);
      break;
    case 'tundra':
      road(left, mid - 4, left + 4, mid - 4);
      road(left + 4, mid - 6, left + 4, mid - 4);
      road(left + 4, mid - 6, left + 8, mid - 6);
      road(left + 8, mid - 6, left + 8, mid);
      break;
    case 'volcano':
      road(west + 2, mid, west + 2, bottom);
      break;
    case 'candy':
      road(east, top + 5, right, top + 5);
      break;
    case 'castle':
      road(left, mid + 5, west, mid + 5);
      break;
    case 'airport':
      road(east + 6, top, east + 6, shortcut);
      break;
    case 'house':
      road(left, bottom - 4, left + 5, bottom - 4);
      road(left + 5, bottom - 6, left + 5, bottom - 4);
      road(left + 5, bottom - 6, west, bottom - 6);
      break;
  }

  const moverX = Math.floor((mover.x - mover.length / 2) / ts) - 1;
  const moverY = Math.floor(mover.y / ts);
  paint(grid, moverX, moverY, mover.length / ts + 3, 1, Tile.Sidewalk);

  const buildings: BuildingLot[] = [], places: PlaceSite[] = [];
  const roomForLot = (x: number, y: number, width: number, height: number) => {
    for (let row = y; row < y + height; row++) for (let col = x; col < x + width; col++) {
      const tile = grid.tiles[row * w + col];
      if (tile !== Tile.Grass && tile !== Tile.Park && tile !== Tile.Dirt) return false;
    }
    return true;
  };
  const lot = (tx: number, ty: number, tw: number, th: number, style: number, placeWord?: string): BuildingLot => {
    const building = { id: buildings.length, tx, ty, tw, th, style, placeWord };
    buildings.push(building);
    paint(grid, tx, ty, tw, th, Tile.Building);
    return building;
  };
  if (map === 'volcano') lot(...VOLCANO_PEAK, 0);
  if (map === 'castle') {
    const tx = gateX + 2, width = Math.min(east - tx, 5);
    lot(tx, top + 4, width, 3, 0);
    lot(tx, top + 8, width, 1, 6);
  }
  const words = rng.shuffle(PLANS[map].words.filter(word => scenesForWord(word).length > 0));
  const place = (tx: number, ty: number, roadY: number) => {
    if (!roomForLot(tx, ty, 2, 2) || grid.tiles[roadY * w + tx + 1] !== Tile.Road) return;
    const word = words[places.length % words.length];
    const building = lot(tx, ty, 2, 2, places.length % 6, word);
    places.push({ word, buildingId: building.id, sign: { x: (tx + 1) * ts, y: (ty + 1) * ts },
      front: { x: (tx + 1) * ts, y: (roadY + 0.5) * ts } });
  };
  for (const roadY of [top, mid, bottom]) {
    for (const [start, end] of [[left, west], [west, east], [east, right]]) {
      place(start + 3 + rng.int(0, 1), roadY + 2, roadY + 1);
      place(end - 4 - rng.int(0, 1), roadY - 2, roadY);
    }
  }
  for (const [from, to] of [[top, shortcut], [shortcut, mid], [mid, bottom]]) {
    for (const [start, end] of [[left, west], [west, east], [east, right]]) {
      const tx = start + 3 + rng.int(0, 1), ty = Math.floor((to + from) / 2) - 1;
      const tw = Math.min(end - tx - 1, rng.int(3, 5)), th = rng.int(2, 4);
      if (roomForLot(tx, ty, tw, th)) lot(tx, ty, tw, th, rng.int(0, 5));
    }
  }
  computeRoadMask(grid);
  const laneGraph = generateLaneGraph(lanes);
  for (const node of laneGraph.nodes) { node.x += ts / 2; node.y += ts / 2; }
  const start = {
    brickworks: [left + 4.3, top + 1, 0],
    mushroom: [right - 5, bottom + 1, Math.PI],
    tundra: [left + 4.8, mid + 1, 0],
    volcano: [east - 3.8, mid + 1, Math.PI],
    candy: [west - 3.8, top + 1, Math.PI],
    castle: [east - 3, top + 1, Math.PI],
    airport: [left + 8.2, bottom + 1, 0],
    house: [right - 7.2, mid + 1, Math.PI],
  } satisfies Record<QueuedMap, [number, number, number]>;
  const [spawnX, spawnY, heading] = start[map];
  const facing = heading === 0 ? 1 : -1;

  return {
    seed, widthTiles: w, heightTiles: h, tileSize: ts, tiles: grid.tiles, roadMask: grid.mask, buildings, places,
    laneGraph, props: [],
    ramps: [
      { x: (left + 4.6) * ts, y: (shortcut + 0.7) * ts, angle: 0, w: WORLD.rampW, h: WORLD.rampH },
      { x: (right - 3.8) * ts, y: (bottom + 1.35) * ts, angle: Math.PI, w: WORLD.rampW, h: WORLD.rampH },
      { x: (right + 1.3) * ts, y: ((mid + bottom) / 2) * ts, angle: -Math.PI / 2, w: WORLD.rampW, h: WORLD.rampH },
    ],
    playerSpawns: [
      { x: spawnX * ts, y: (spawnY - 0.4 * facing) * ts, angle: heading },
      { x: (spawnX - 1.2 * facing) * ts, y: (spawnY + 0.4 * facing) * ts, angle: heading },
    ],
  };
}

/** Main runway centerline, separate from the baggage route. */
export function queuedRunway(world: Pick<WorldData, 'seed' | 'tileSize'>) {
  const { columns: [left, , , right], rows: [, , , bottom] } = layout('airport', world.seed);
  return { start: (left + 3) * world.tileSize, end: (right - 1) * world.tileSize, y: (bottom + 1) * world.tileSize };
}

export function queuedVolcanoTunnel(world: Pick<WorldData, 'seed' | 'tileSize'>) {
  const { columns: [, west], rows: [, , mid, bottom] } = layout('volcano', world.seed);
  return { x: (west + 3) * world.tileSize, y: (mid + bottom) / 2 * world.tileSize };
}
