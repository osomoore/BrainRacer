import { GOALS, INDUSTRIAL_PROPS, TILE_SIZE, WORLD } from '../../config/gameConfig';
import { Rng } from '../../core/rng';
import { Tile, type BuildingLot, type IndustrialDecoration, type PlaceSite, type Vec2, type WorldData } from '../../core/types';
import { computeRoadMask, type Grid } from './grid';
import { generateLaneGraph } from './lanes';

type Strip = readonly [x: number, y: number, width: number, height: number];
const CANAL_WEST = 22;
const CANAL_EAST = 26;
const NORTH_BRIDGE = 10;
const CENTRAL_BRIDGE = 24;
const SOUTH_BRIDGE = 36;
// Two extra bridges join the canal-side road to the factory cross streets.
const NORTH_MID_BRIDGE = 17;
const SOUTH_MID_BRIDGE = 31;
const LOADING_BRIDGE = 42;
const CROSSING_X = 8;
const ROAD_WIDTH = 2;

// Two playable tiles make a wide road. A separate one-tile skeleton generates
// traffic turns, then shifts to the physical center of the wider road.
const HORIZONTAL: readonly Strip[] = [
  [8, 5, 12, ROAD_WIDTH], // freight loop, north edge
  [8, NORTH_BRIDGE, 34, ROAD_WIDTH],
  [8, 15, 12, ROAD_WIDTH], // streets at either end of the railway yard
  [8, 30, 12, ROAD_WIDTH],
  [18, CENTRAL_BRIDGE, 24, ROAD_WIDTH],
  [18, NORTH_MID_BRIDGE, 24, ROAD_WIDTH], // cross streets that span the canal and run on through the factory district
  [18, SOUTH_MID_BRIDGE, 24, ROAD_WIDTH],
  [8, SOUTH_BRIDGE, 34, ROAD_WIDTH],
  [8, LOADING_BRIDGE, 22, ROAD_WIDTH], // loading loop crosses to the eastern factory road
];
const VERTICAL: readonly Strip[] = [
  [CROSSING_X, 5, ROAD_WIDTH, 39],
  [18, 5, ROAD_WIDTH, 39], // canal-side road bypasses both grade crossings
  [28, NORTH_BRIDGE, ROAD_WIDTH, LOADING_BRIDGE + ROAD_WIDTH - NORTH_BRIDGE],
  [37, NORTH_BRIDGE, ROAD_WIDTH, 28],
  [40, NORTH_BRIDGE, ROAD_WIDTH, 28],
];

interface PropSpec {
  kind: IndustrialDecoration['kind'];
  /** Cell footprint in tiles (cw along local x) and drawn size in tiles. */
  cw: number; ch: number; w: number; h: number;
  weight: number;
  turn?: boolean;      // may be rotated a quarter turn (cell swaps)
  quarter?: boolean;   // random quarter-turn angle even for square cells
}

const PROP_SPECS: readonly PropSpec[] = [
  { kind: 'containerStack', cw: 2, ch: 1, w: 1.9, h: 0.75, weight: 6, turn: true },
  { kind: 'pallets', cw: 1, ch: 1, w: 0.8, h: 0.8, weight: 2.5, quarter: true },
  { kind: 'barrels', cw: 1, ch: 1, w: 0.7, h: 0.7, weight: 2.5 },
  { kind: 'fuelTank', cw: 2, ch: 2, w: 1.8, h: 1.8, weight: 2 },
  { kind: 'conveyor', cw: 3, ch: 1, w: 2.9, h: 0.55, weight: 2, turn: true },
  { kind: 'smokeStack', cw: 1, ch: 1, w: 0.96, h: 0.96, weight: 1.5 },
  { kind: 'parkedTruck', cw: 2, ch: 1, w: 1.5, h: 0.6, weight: 3, turn: true },
  { kind: 'forklift', cw: 1, ch: 1, w: 0.62, h: 0.45, weight: 2, quarter: true },
  { kind: 'pipes', cw: 3, ch: 1, w: 2.9, h: 0.42, weight: 2.5, turn: true },
  { kind: 'fence', cw: 3, ch: 1, w: 2.9, h: 0.2, weight: 2.5, turn: true },
];
const SMALL_KINDS = new Set<IndustrialDecoration['kind']>(['pallets', 'barrels', 'forklift']);

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

/**
 * Seeded yard clutter placed only on open plaza tiles: never on road, never touching
 * the rail, crossings, goal approaches, spawn, ramp or the existing landmarks.
 */
function scatterProps(
  rng: Rng, grid: Grid, buildings: BuildingLot[], places: PlaceSite[], landmarks: IndustrialDecoration[],
  rail: { points: Vec2[]; crossings: { center: Vec2 }[] }, spawn: Vec2,
): IndustrialDecoration[] {
  const { w, h } = grid;
  const P = INDUSTRIAL_PROPS;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? Tile.Water : grid.tiles[y * w + x] as Tile);
  const near = (x: number, y: number, tile: Tile, diagonal: boolean) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if ((dx || dy) && (diagonal || !dx || !dy) && at(x + dx, y + dy) === tile) return true;
    }
    return false;
  };
  const keep = new Uint8Array(w * h);
  const ramps = [px(13, 42.75)];
  const fronts = places.map((p) => p.front);
  const pad = P.decorationPadTiles * TILE_SIZE;
  const goalClear = GOALS.radius + P.goalClearTiles * TILE_SIZE;
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
    const c = px(tx + 0.5, ty + 0.5);
    let blocked = at(tx, ty) !== Tile.Plaza || near(tx, ty, Tile.Building, false);
    if (!blocked) {
      for (let i = 0; i < rail.points.length && !blocked; i++) {
        blocked = distToSegment(c, rail.points[i], rail.points[(i + 1) % rail.points.length]) < P.railClearTiles * TILE_SIZE;
      }
    }
    blocked = blocked
      || rail.crossings.some(({ center }) => Math.hypot(c.x - center.x, c.y - center.y) < P.crossingClearTiles * TILE_SIZE)
      || fronts.some((f) => Math.hypot(c.x - f.x, c.y - f.y) < goalClear)
      || places.some(({ sign }) => Math.hypot(c.x - sign.x, c.y - sign.y) < 2.2 * TILE_SIZE)
      || ramps.some((r) => Math.hypot(c.x - r.x, c.y - r.y) < P.rampClearTiles * TILE_SIZE)
      || Math.hypot(c.x - spawn.x, c.y - spawn.y) < 3 * TILE_SIZE
      || landmarks.some((d) => Math.abs(c.x - d.x) < d.w / 2 + pad && Math.abs(c.y - d.y) < d.h / 2 + pad);
    keep[ty * w + tx] = blocked ? 1 : 0;
  }
  const used = new Uint8Array(w * h);
  const free = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < w && ty < h && !keep[ty * w + tx] && !used[ty * w + tx];
  const out: IndustrialDecoration[] = [];

  // Lamp posts line the road edges so every street has warm pools of light.
  const lamps: Vec2[] = [];
  for (let ty = 0; ty < h; ty++) for (let tx = 0; tx < w; tx++) {
    if (!free(tx, ty) || !near(tx, ty, Tile.Road, false) || (tx + 2 * ty) % P.lampSpacing !== 0) continue;
    if (lamps.some((l) => Math.hypot(l.x - tx, l.y - ty) < 3)) continue;
    lamps.push({ x: tx, y: ty });
    used[ty * w + tx] = 1;
    out.push(decoration('lampPost', tx + 0.5, ty + 0.5, 0.5, 0.5));
  }

  const total = PROP_SPECS.reduce((sum, spec) => sum + spec.weight, 0);
  const order = rng.shuffle(Array.from({ length: w * h }, (_, i) => i));
  for (const index of order) {
    const tx = index % w, ty = Math.floor(index / w);
    if (!free(tx, ty) || !rng.chance(P.fillChance)) continue;
    let pick = rng.range(0, total);
    const spec = PROP_SPECS.find((s) => (pick -= s.weight) < 0) ?? PROP_SPECS[0];
    const turned = !!spec.turn && rng.chance(0.5);
    const cw = turned ? spec.ch : spec.cw, ch = turned ? spec.cw : spec.ch;
    const onEdge = (x: number, y: number) => near(x, y, Tile.Road, true);
    let ok = true;
    for (let dy = 0; dy < ch && ok; dy++) for (let dx = 0; dx < cw && ok; dx++) {
      ok = free(tx + dx, ty + dy) && (SMALL_KINDS.has(spec.kind) || !onEdge(tx + dx, ty + dy));
    }
    if (!ok) continue;
    for (let dy = 0; dy < ch; dy++) for (let dx = 0; dx < cw; dx++) used[(ty + dy) * w + tx + dx] = 1;
    const angle = turned ? Math.PI / 2 : spec.quarter ? rng.int(0, 3) * Math.PI / 2 : 0;
    out.push({ ...decoration(spec.kind, tx + cw / 2, ty + ch / 2, spec.w, spec.h), angle });
  }

  // Skylights, vents and glowing windows on the warehouse roofs.
  for (const b of buildings) for (let dy = 0; dy < b.th; dy++) for (let dx = 0; dx < b.tw; dx++) {
    if (rng.chance(P.roofLightChance)) out.push(decoration('roofLights', b.tx + dx + 0.5, b.ty + dy + 0.5, 1, 1));
  }
  return out;
}

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

  // Long warehouse walls are split by one-tile gaps (open yard ground) so no wall exceeds WORLD.maxBuildingRun.
  const wall = ([tx, ty, tw, th]: Strip) => {
    const horizontal = tw >= th;
    const len = horizontal ? tw : th;
    const pieces = Math.ceil((len + 1) / (WORLD.maxBuildingRun + 1));
    const room = len - (pieces - 1);
    let at = 0;
    for (let i = 0; i < pieces; i++) {
      const size = Math.floor(room / pieces) + (i < room % pieces ? 1 : 0);
      lot(horizontal ? [tx + at, ty, size, th] : [tx, ty + at, tw, size]);
      at += size + 1;
    }
  };

  // Signed exits and approaches sit on the loop and away from walls and rail.
  lot([10, 13, 3, 2], 'train station', px(CROSSING_X + 1, NORTH_BRIDGE + 1));
  lot([33, 6, 3, 2], 'bridge', px(37.5, NORTH_BRIDGE + 1));
  lot([10, 32, 4, 2], 'airport', px(CROSSING_X + 1, SOUTH_BRIDGE + 1));
  lot([34, 40, 3, 2], 'water tower', px(37.5, SOUTH_BRIDGE + 1));

  // Low perimeter warehouses frame the district without blocking the open yards.
  wall([3, 8, 3, rng.int(7, 10)]);
  wall([3, 32, 3, rng.int(7, 10)]);
  wall([11, 3, rng.int(4, 7), 2]);
  wall([42, 13, 3, rng.int(5, 8)]);
  wall([42, 27, 3, rng.int(5, 8)]);
  wall([27, 3, rng.int(4, 6), 3]);
  wall([30, LOADING_BRIDGE, rng.int(4, 6), 3]);

  const bridge = (y: number) => decoration('bridge', (CANAL_WEST + CANAL_EAST) / 2, y + 1, CANAL_EAST - CANAL_WEST, ROAD_WIDTH);
  const decorations = [
    bridge(NORTH_BRIDGE),
    bridge(SOUTH_BRIDGE),
    bridge(CENTRAL_BRIDGE),
    bridge(NORTH_MID_BRIDGE),
    bridge(SOUTH_MID_BRIDGE),
    bridge(LOADING_BRIDGE),
    decoration('factoryBay', 32, NORTH_BRIDGE + 1, 6, 3.25),
    decoration('factoryBay', 32, SOUTH_BRIDGE + 1, 6, 3.25),
    decoration('gantry', 12, NORTH_BRIDGE + 1, 1.5, 3.25),
    decoration('gantry', 12, SOUTH_BRIDGE + 1, 1.5, 3.25),
    decoration('loadingYard', 14, 40, 7, 4),
    decoration('loadingYard', 13.5, 8.25, 6.5, 2.5),
    decoration('waterTower', 37.5, 41.5, 1.75, 1.75),
  ];
  const rail = {
    // The west road crosses both long straights. The gently clipped corners
    // keep the carriages clear of warehouses and the neighboring canal road.
    points: [
      px(7, 18), px(13, 18), px(15, 18.75), px(16, 21), px(16, 26), px(15, 28.25),
      px(13, 29), px(7, 29), px(5, 28.25), px(4, 26), px(4, 21), px(5, 18.75),
    ],
    crossings: [18, 29].map((y) => ({ center: px(CROSSING_X + ROAD_WIDTH / 2, y), width: ROAD_WIDTH * TILE_SIZE })),
  };

  const spawn = px(rng.range(15.5, 16.5), NORTH_BRIDGE + 1);
  decorations.push(...scatterProps(new Rng(seed * 7919 + 13), grid, buildings, places, decorations, rail, spawn));
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
