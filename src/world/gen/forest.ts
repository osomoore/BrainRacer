import { FOREST, TILE_SIZE } from '../../config/gameConfig';
import { Rng } from '../../core/rng';
import { Tile, type BuildingLot, type FreightRoute, type Prop, type Vec2, type WorldData } from '../../core/types';
import { COUNTRY_PLACE_WORDS, CITY_PLACE_WORDS } from '../../data/places';
import { DIRS, computeRoadMask, idx, isRoad, type Grid } from './grid';
import { generateLaneGraph } from './lanes';
import { generateRamps } from './ramps';
import { generateSpawns } from './spawns';

const NORTH = 6;
const SOUTH = 40;
const WEST = 5;
const EAST = 42;
const CROSS_STREETS = [NORTH, 17, 26, SOUTH];
const AVENUES = [WEST, 16, 35, EAST];
const INNER_NORTH = 12;
const INNER_SOUTH = 34;
const STREETS: readonly [x: number, y: number, x2: number, y2: number][] = [
  ...CROSS_STREETS.map((y): [number, number, number, number] => [WEST, y, EAST, y]),
  ...AVENUES.map((x): [number, number, number, number] => [x, NORTH, x, SOUTH]),
  [16, INNER_NORTH, 35, INNER_NORTH], [16, INNER_SOUTH, 35, INNER_SOUTH],
  [24, INNER_NORTH, 24, INNER_SOUTH],
];

/** Space for the footpaths around each roof is reserved by the street plan. */
const PLOTS: readonly [x: number, y: number, w: number, h: number][] = [
  [7, 8, 2, 2], [13, 12, 2, 3], [18, 8, 3, 2], [26, 8, 3, 2], [37, 13, 2, 3],
  [7, 19, 3, 2], [12, 20, 3, 3], [19, 19, 2, 3], [26, 19, 3, 2], [31, 22, 3, 2], [40, 20, 2, 3],
  [7, 28, 3, 3], [13, 30, 2, 3], [19, 29, 3, 2], [26, 30, 3, 2], [31, 28, 3, 2], [37, 30, 2, 3],
  [18, 36, 3, 1], [28, 36, 3, 1], [32, 38, 3, 2],
];

const PLACE_WORDS = ['house', 'bakery', 'shop', 'school', 'train station', 'library', 'playground', 'campsite',
  'forest', 'well', 'barn', 'park', 'tower', 'museum']
  .filter(word => CITY_PLACE_WORDS.includes(word) || COUNTRY_PLACE_WORDS.includes(word));

const RAIL = { left: 11, top: 10.65, right: 39.5, bottom: 37.55, bend: 1.3 };
const toPixels = (point: Vec2): Vec2 => ({ x: point.x * TILE_SIZE, y: point.y * TILE_SIZE });

/** Clockwise line through the lantern district, groves, and the logging yard. */
export function forestRailRoute(): FreightRoute {
  const { left, top, right, bottom, bend } = RAIL;
  const centers = [{ x: right - bend, y: top + bend }, { x: right - bend, y: bottom - bend },
    { x: left + bend, y: bottom - bend }, { x: left + bend, y: top + bend }];
  const points = centers.flatMap((center, i) => Array.from({ length: 7 }, (_, step) => {
    const angle = (i - 1 + step / 6) * Math.PI / 2;
    return toPixels({ x: center.x + bend * Math.cos(angle), y: center.y + bend * Math.sin(angle) });
  }));
  const crossings = [
    ...[16, 35].map(x => ({ x: x + 1, y: top })),
    ...[17, 26].map(y => ({ x: right, y: y + 1 })),
    ...[35, 16].map(x => ({ x: x + 1, y: bottom })),
    ...[26, 17].map(y => ({ x: left, y: y + 1 })),
  ].map(point => ({ center: toPixels(point), width: 2 * TILE_SIZE }));
  return { points, crossings };
}

function railDistance(route: FreightRoute, x: number, y: number): number {
  let min = Infinity;
  for (const [i, a] of route.points.entries()) {
    const b = route.points[(i + 1) % route.points.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    const along = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
    min = Math.min(min, Math.hypot(x - a.x - along * dx, y - a.y - along * dy));
  }
  return min;
}

function makeGrid(): Grid {
  const size = FOREST.size;
  const tiles = new Uint8Array(size * size);
  for (let y = 2; y < size - 2; y++) for (let x = 2; x < size - 2; x++) {
    tiles[y * size + x] = x < WEST || x > EAST + 1 || y < NORTH || y > SOUTH + 1 ? Tile.Park : Tile.Grass;
  }
  return { w: size, h: size, tiles, mask: new Uint8Array(tiles.length) };
}

function layStreets(grid: Grid, wide: boolean): void {
  for (const [x, y, x2, y2] of STREETS) {
    for (let iy = y; iy <= y2 + Number(wide); iy++) for (let ix = x; ix <= x2 + Number(wide); ix++) {
      grid.tiles[idx(grid, ix, iy)] = Tile.Road;
    }
  }
  computeRoadMask(grid);
}

function addLots(rng: Rng, grid: Grid): BuildingLot[] {
  return PLOTS.map(([tx, ty, tw, th], id) => {
    for (let y = ty; y < ty + th; y++) for (let x = tx; x < tx + tw; x++) grid.tiles[idx(grid, x, y)] = Tile.Building;
    return { id, tx, ty, tw, th, style: rng.int(0, 5) };
  });
}

function addScenery(rng: Rng, grid: Grid, route: FreightRoute): Prop[] {
  const props: Prop[] = [];
  const trees: number[] = [], shrubs: number[] = [];
  for (let y = 2; y < grid.h - 2; y++) for (let x = 2; x < grid.w - 2; x++) {
    const i = idx(grid, x, y), tile = grid.tiles[i];
    if (tile !== Tile.Grass && tile !== Tile.Park) continue;
    const edge = DIRS.find(({ dx, dy }) => isRoad(grid, x + dx, y + dy));
    const px = x + 0.5, py = y + 0.5;
    if (railDistance(route, px * TILE_SIZE, py * TILE_SIZE) <= FOREST.railClearanceTiles * TILE_SIZE) {
      grid.tiles[i] = Tile.Dirt;
      continue;
    }
    if (edge) {
      grid.tiles[i] = Tile.Sidewalk;
      const chainage = edge.dx ? y : x;
      const street = edge.dx ? x : y;
      if ((chainage + street) % FOREST.streetLampStep === 0) {
        props.push({ kind: 'lamp', ...toPixels({ x: px + edge.dx * .27, y: py + edge.dy * .27 }), angle: 0 });
      }
    } else {
      trees.push(i);
      shrubs.push(i);
      if (tile === Tile.Park || rng.chance(.3)) trees.push(i);
    }
  }
  const scatter = (candidates: number[], kind: Prop['kind'], quota: number): void => {
    for (const i of [...new Set(rng.shuffle(candidates))].slice(0, quota)) {
      const x = i % grid.w + rng.range(.34, .66), y = Math.floor(i / grid.w) + rng.range(.34, .66);
      if (railDistance(route, x * TILE_SIZE, y * TILE_SIZE) <= FOREST.railClearanceTiles * TILE_SIZE) continue;
      props.push({ kind, ...toPixels({ x, y }), angle: rng.range(0, Math.PI * 2) });
    }
  };
  scatter(trees, 'tree', FOREST.treeCount);
  scatter(shrubs, 'bush', FOREST.shrubCount);
  return props;
}

/** A fixed street plan makes the crossings learnable. Shop signs and planting vary by seed. */
export function generateForest(seed: number): WorldData {
  const rng = new Rng(seed);
  const grid = makeGrid(), skeleton = makeGrid();
  layStreets(grid, true);
  layStreets(skeleton, false);
  const route = forestRailRoute();
  const buildings = addLots(rng.fork(1), grid);
  const laneGraph = generateLaneGraph(skeleton);
  // The two physical lanes straddle the seam between the two road tiles.
  const centerRoad = <T extends Vec2>(point: T): T => ({
    ...point, x: point.x + TILE_SIZE / 2, y: point.y + TILE_SIZE / 2,
  });
  laneGraph.nodes = laneGraph.nodes.map(centerRoad);
  const roadNodes = laneGraph.nodes.filter(node => railDistance(route, node.x, node.y) > TILE_SIZE * 1.4);
  // Most lots are place buildings. Keep the ordinary shops interspersed, too.
  const placeLots = rng.fork(2).shuffle(buildings.slice()).slice(0, PLACE_WORDS.length);
  const places = placeLots.map((lot, i) => {
    lot.placeWord = PLACE_WORDS[i];
    const sign = toPixels({ x: lot.tx + lot.tw / 2, y: lot.ty + lot.th / 2 });
    const front = roadNodes.reduce((best, candidate) =>
      Math.hypot(candidate.x - sign.x, candidate.y - sign.y) < Math.hypot(best.x - sign.x, best.y - sign.y) ? candidate : best);
    return { word: lot.placeWord, buildingId: lot.id, sign, front: { x: front.x, y: front.y } };
  });
  const spawns = generateSpawns(rng.fork(3), skeleton);
  const props = addScenery(rng.fork(4), grid, route);
  return {
    seed, widthTiles: grid.w, heightTiles: grid.h, tileSize: TILE_SIZE, tiles: grid.tiles, roadMask: grid.mask,
    buildings, places, props, laneGraph, playerSpawns: spawns.map(centerRoad),
    ramps: generateRamps(rng.fork(5), skeleton, spawns).map(centerRoad)
      .filter(ramp => railDistance(route, ramp.x, ramp.y) > 1.7 * TILE_SIZE),
  };
}
