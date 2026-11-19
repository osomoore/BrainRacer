/**
 * Farm map generator (Phaser-free, seeded).
 *
 * Tile conventions (see also the FarmLayout docs in core/types.ts):
 *  - Every road is a 2-tile strip. Paved county roads (outer loop, village roads) are Tile.Road;
 *    dirt farm lanes are Tile.Dirt; stream bridge decks are Tile.Road on either kind; mud puddles on
 *    lanes are Tile.Mud. `roadMask` is non-zero exactly on road/lane strip tiles (Road, lane Dirt,
 *    lane Mud), so a renderer can tell a dirt lane (mask != 0) from farmyard dirt (mask == 0).
 *  - Corn fields are Tile.Corn; corn-maze paths are mown Tile.Grass inside a `cornMaze` decoration.
 *  - Farmyards are Tile.Dirt, the village block is Tile.Plaza, water (border, stream, duck pond) is Tile.Water.
 *  - ramps[0] is the hay-bale ramp (on a dirt lane); the others are grassy hill crests on paved roads.
 *  - Traffic: the lane graph covers paved roads and dirt lanes; a node over a Dirt/Mud tile is a farm lane.
 *
 * The layout is built in a fixed "design" frame and then mirrored on x and/or y by the seed.
 */
import { FARM_GEN, TILE_SIZE, WORLD } from '../../config/gameConfig';
import { Rng } from '../../core/rng';
import { ROAD_E, ROAD_N, ROAD_S, ROAD_W, Tile, type FarmAnimalKind, type FarmDecorationKind, type Ramp, type Vec2, type WorldData } from '../../core/types';
import {
  FarmBuilder, Lane, fillCorn, fillFarmstead, fillMaze, fillOrchard, fillPasture, fillVillage,
  fillWindmillPond, fillWoods, placeSigned, type Cell, type Role,
} from './farmBuild';
import { FARM_PLACE_WORDS } from '../../data/places';
import type { Grid } from './grid';
import { generateLaneGraph, offY } from './lanes';

const TS = TILE_SIZE;
/** Outer loop skeleton coordinates (strips cover LOOP..LOOP+1 and FAR..FAR+1). */
const LOOP = 4;

interface Seg { x0: number; y0: number; x1: number; y1: number; lane: Lane }

/** Every signed farm place (footprint along the road × depth) that must exist on the map. */
const SIGNED: [string, number, number, FarmDecorationKind | undefined][] = [
  ['farm', 2, 2, 'farmhouse'], ['barn', 3, 3, 'barn'], ['well', 1, 1, undefined],
  ['windmill', 2, 2, 'windmill'], ['lake', 2, 1, undefined], ['campsite', 2, 2, undefined],
  ['cave', 2, 2, undefined], ['forest', 2, 1, undefined],
];

interface RoleSpec { role: Role; short: number; long: number; kind?: FarmAnimalKind; largest?: boolean }

/** Roles in assignment priority. The first REQUIRED_ROLES always get a field (the largest left if none fits). */
const REQUIRED_ROLES = 10;
const ROLES: RoleSpec[] = [
  { role: 'maze', short: 5, long: 7, largest: true },
  { role: 'farmstead', short: 6, long: 8 },
  { role: 'farmstead', short: 6, long: 8 },
  { role: 'farmstead', short: 6, long: 8 },
  { role: 'windmillPond', short: 6, long: 8 },
  { role: 'woods', short: 6, long: 7 },
  { role: 'pasture', short: 5, long: 6, kind: 'cow' },
  { role: 'pasture', short: 5, long: 6, kind: 'sheep' },
  { role: 'pasture', short: 5, long: 6, kind: 'horse' },
  { role: 'corn', short: 3, long: 4 },
  { role: 'pasture', short: 5, long: 5, kind: 'pig' },
  { role: 'orchard', short: 5, long: 5 },
];

/** A seeded countryside: county-road loop, dirt lanes, farmsteads, corn, pastures, a stream and a village. */
export function generateFarm(seed: number): WorldData {
  const rng = new Rng(seed);
  const W = WORLD.widthTiles, H = WORLD.heightTiles, border = WORLD.waterBorderTiles;
  const FAR = W - 2 - LOOP;
  const b = new FarmBuilder(rng.fork(1), W, H);
  b.fill(0, 0, W, H, Tile.Water);
  b.fill(border, border, W - 2 * border, H - 2 * border, Tile.Grass);

  // ── road skeleton (design frame) ──
  const cy = rng.int(19, 21);              // village main street (paved, west-east)
  const vx = rng.int(21, 24);              // north road into the village (paved)
  const nwY = rng.int(11, cy - 7);         // north-west dirt lane
  const neX = rng.int(33, 35);             // north-east dirt lane
  const sx1 = rng.int(13, 17);             // south dirt lanes (both cross the stream)
  const sx2 = rng.int(26, 29);
  const sy = rng.int(cy + 8, 33);          // stream top row (meanders down one row in places)
  const segs: Seg[] = [
    { x0: LOOP, y0: LOOP, x1: FAR, y1: LOOP, lane: Lane.Paved },
    { x0: LOOP, y0: FAR, x1: FAR, y1: FAR, lane: Lane.Paved },
    { x0: LOOP, y0: LOOP, x1: LOOP, y1: FAR, lane: Lane.Paved },
    { x0: FAR, y0: LOOP, x1: FAR, y1: FAR, lane: Lane.Paved },
    { x0: LOOP, y0: cy, x1: FAR, y1: cy, lane: Lane.Paved },
    { x0: vx, y0: LOOP, x1: vx, y1: cy, lane: Lane.Paved },
    { x0: LOOP, y0: nwY, x1: vx, y1: nwY, lane: Lane.Dirt },
    { x0: neX, y0: LOOP, x1: neX, y1: cy, lane: Lane.Dirt },
    { x0: sx1, y0: cy, x1: sx1, y1: FAR, lane: Lane.Dirt },
    { x0: sx2, y0: cy, x1: sx2, y1: FAR, lane: Lane.Dirt },
  ];
  const traffic = new Uint8Array(W * H);
  for (const s of segs) {
    for (let y = s.y0; y <= s.y1 + 1; y++) {
      for (let x = s.x0; x <= s.x1 + 1; x++) {
        const k = b.i(x, y);
        if (b.lane[k] !== Lane.Paved) b.lane[k] = s.lane;
        b.tiles[k] = b.lane[k] === Lane.Paved ? Tile.Road : Tile.Dirt;
      }
    }
    for (let y = s.y0; y <= s.y1; y++) for (let x = s.x0; x <= s.x1; x++) traffic[b.i(x, y)] = Tile.Road;
  }

  // ── stream: border to border, bridges where the vertical roads cross ──
  const bridgeCols = [LOOP, sx1, sx2, FAR];
  const off = new Int8Array(W);
  for (let x = 0, run = rng.int(3, 6), cur = 0; x < W; x++, run--) {
    if (run <= 0) { cur = 1 - cur; run = rng.int(3, 6); }
    off[x] = bridgeCols.some((s) => x >= s - 2 && x <= s + 3) ? 0 : cur;
  }
  for (let x = 0; x < W; x++) {
    for (const y of [sy + off[x], sy + off[x] + 1]) {
      const k = b.i(x, y);
      if (b.lane[k]) { b.lane[k] = Lane.Bridge; b.tiles[k] = Tile.Road; } else b.tiles[k] = Tile.Water;
    }
  }
  for (const s of bridgeCols) {
    // Width runs along travel (north-south over the 2-tile stream), height across the 2-tile road.
    b.deco('streamBridge', s + 1, sy + 1, 2, 2, false);
    b.decorations[b.decorations.length - 1].angle = Math.PI / 2;
  }

  // ── field cells between the roads ──
  const base: Cell[] = [
    { x: 6, y: 6, w: vx - 6, h: nwY - 6, roads: ['N', 'W', 'E', 'S'] },
    { x: 6, y: nwY + 2, w: vx - 6, h: cy - nwY - 2, roads: ['N', 'W', 'E', 'S'] },
    { x: neX + 2, y: 6, w: FAR - neX - 2, h: cy - 6, roads: ['N', 'W', 'E', 'S'] },
  ];
  const village: Cell = { x: vx + 2, y: 6, w: neX - vx - 2, h: cy - 6, roads: ['N', 'W', 'E', 'S'] };
  for (const [x0, x1] of [[6, sx1 - 1], [sx1 + 2, sx2 - 1], [sx2 + 2, FAR - 1]]) {
    base.push({ x: x0, y: cy + 2, w: x1 - x0 + 1, h: sy - cy - 2, roads: ['N', 'W', 'E'] });
    base.push({ x: x0, y: sy + 3, w: x1 - x0 + 1, h: FAR - sy - 3, roads: ['S', 'W', 'E'] });
  }
  const cells: Cell[] = [];
  for (const c of base) cells.push(...split(c));

  // ── assign roles: best fit (smallest area that fits), in priority order ──
  fillVillage(b, village);
  const free = rng.shuffle(cells.slice());
  const assigned: [Cell, RoleSpec][] = [];
  for (const [r, spec] of ROLES.entries()) {
    let fits = free.filter((c) => Math.min(c.w, c.h) >= spec.short && Math.max(c.w, c.h) >= spec.long);
    if (!fits.length && r < REQUIRED_ROLES && free.length) fits = [free.reduce((a, c) => (c.w * c.h > a.w * a.h ? c : a))];
    if (!fits.length) continue;
    const area = (c: Cell) => (spec.largest ? -1 : 1) * c.w * c.h;
    const pick = fits.reduce((a, c) => (area(c) < area(a) ? c : a));
    free.splice(free.indexOf(pick), 1);
    assigned.push([pick, spec]);
  }
  // Leftover fields: a 4th (unsigned) farmstead if one fits, then alternate corn and extra pastures.
  const extraHerds: FarmAnimalKind[] = ['sheep', 'cow', 'horse'];
  let extras = 0;
  for (const c of free.sort((p, q) => q.w * q.h - p.w * p.h)) {
    const fitsFarm = Math.min(c.w, c.h) >= 6 && Math.max(c.w, c.h) >= 8;
    if (fitsFarm && assigned.filter(([, r]) => r.role === 'farmstead').length < 4) {
      assigned.push([c, { role: 'farmstead', short: 6, long: 8 }]);
    } else if (extras++ % 2 === 1 && Math.min(c.w, c.h) >= 5) {
      assigned.push([c, { role: 'pasture', short: 5, long: 5, kind: extraHerds[(extras >> 1) % extraHerds.length] }]);
    } else {
      assigned.push([c, { role: 'corn', short: 0, long: 0 }]);
    }
  }
  let farmIndex = 0, cornIndex = 0;
  for (const [c, spec] of assigned) {
    switch (spec.role) {
      case 'maze': fillMaze(b, c); break;
      case 'farmstead': fillFarmstead(b, c, farmIndex++); break;
      case 'windmillPond': fillWindmillPond(b, c); break;
      case 'woods': fillWoods(b, c); break;
      case 'pasture': fillPasture(b, c, spec.kind!); break;
      case 'orchard': fillOrchard(b, c); break;
      default: fillCorn(b, c, cornIndex++ === 0);
    }
  }
  // Any signed place that did not fit its home field goes into the roomiest other field.
  const order: Role[] = ['woods', 'windmillPond', 'orchard', 'corn', 'farmstead'];
  const homes = assigned.filter(([, r]) => order.includes(r.role))
    .sort(([p, a], [q, z]) => order.indexOf(a.role) - order.indexOf(z.role) || q.w * q.h - p.w * p.h);
  for (const [word, lu, lv, kind] of SIGNED) {
    if (b.places.some((p) => p.word === word)) continue;
    homes.some(([c]) => placeSigned(b, c, lu, lv, word, kind));
  }

  // ── wind-turbine row on the strip between the east loop and the water ──
  const turbineX = FAR + 3;
  const stream = (y: number) => y >= sy - 1 && y <= sy + 3;
  const turbineRows: number[] = [];
  for (let y = LOOP + 2; y <= FAR - 1; y += FARM_GEN.turbineEveryTiles) if (!stream(y)) turbineRows.push(y);
  // One turbine stands on a 1-tile signed lot (the 'wind turbine' goal); its front is the loop's centerline.
  let signedRow = -1;
  for (const y of rng.shuffle(turbineRows.slice())) {
    const front = { x: (FAR + 1) * TS, y: (y + 0.5) * TS };
    if (!FARM_PLACE_WORDS.includes('wind turbine') || !b.frontClear(front) || near(b, FAR + 1, y + 0.5, 3)) continue;
    const lot = b.addLot(turbineX, y, 1, 1, 'windTurbine', 'wind turbine');
    b.places.push({ word: 'wind turbine', buildingId: lot.id, sign: { x: (turbineX + 0.5) * TS, y: (y + 0.5) * TS }, front });
    signedRow = y;
    break;
  }
  for (const y of turbineRows) {
    if (y === signedRow) continue;
    b.occ[b.i(turbineX, y)] = 1;
    b.deco('windTurbine', turbineX + 0.5, y + 0.5, FARM_GEN.turbineSize, FARM_GEN.turbineSize, true);
  }

  // ── ramps and mud ──
  const ramps = placeRamps(b, rng.fork(2), segs, cy);
  placeMud(b, rng.fork(3), segs, ramps);
  const spawnX = pickSpawnX(b, rng, cy, ramps);

  // ── mirror by seed, then derive masks, lane graph and spawns ──
  const mx = rng.chance(0.5), my = rng.chance(0.5);
  return finish(seed, b, traffic, ramps, mx, my, { x: (spawnX + 0.5) * TS, y: (cy + 1) * TS });
}

/** Split long cells in two with a 1-tile grass gap; each half keeps the road sides it still touches. */
function split(c: Cell): Cell[] {
  const long = Math.max(c.w, c.h);
  if (long < FARM_GEN.splitLongSide) return [c];
  if (c.w >= c.h) {
    const a = Math.floor((c.w - 1) / 2);
    return [
      { x: c.x, y: c.y, w: a, h: c.h, roads: c.roads.filter((s) => s !== 'E') },
      { x: c.x + a + 1, y: c.y, w: c.w - a - 1, h: c.h, roads: c.roads.filter((s) => s !== 'W') },
    ];
  }
  const a = Math.floor((c.h - 1) / 2);
  return [
    { x: c.x, y: c.y, w: c.w, h: a, roads: c.roads.filter((s) => s !== 'S') },
    { x: c.x, y: c.y + a + 1, w: c.w, h: c.h - a - 1, roads: c.roads.filter((s) => s !== 'N') },
  ];
}

/** Strip position (skeleton coords) along a segment where the road runs straight with no side roads. */
function straightAt(b: FarmBuilder, s: Seg, p: number): boolean {
  const vertical = s.x0 === s.x1;
  const [ax, ay, bx, by] = vertical ? [s.x0, p, s.x0 + 1, p] : [p, s.y0, p, s.y0 + 1];
  if (!b.lane[b.i(ax, ay)] || !b.lane[b.i(bx, by)]) return false;
  if (b.tiles[b.i(ax, ay)] === Tile.Mud || b.tiles[b.i(bx, by)] === Tile.Mud) return false;
  const [lx, ly, rx, ry] = vertical ? [s.x0 - 1, p, s.x0 + 2, p] : [p, s.y0 - 1, p, s.y0 + 2];
  return !b.lane[b.i(lx, ly)] && !b.lane[b.i(rx, ry)];
}

const near = (b: FarmBuilder, x: number, y: number, r: number) =>
  b.places.some((p) => Math.hypot(p.front.x / TS - x, p.front.y / TS - y) < r);

/** ramps[0] = hay-bale ramp on a south dirt lane; then grassy hill crests on paved straights. */
function placeRamps(b: FarmBuilder, rng: Rng, segs: Seg[], cy: number): Ramp[] {
  const ramps: Ramp[] = [];
  const at: { x: number; y: number }[] = [];
  const tryOn = (cands: Seg[], want: number) => {
    const opts: { s: Seg; p: number; d: number }[] = [];
    for (const s of cands) {
      const vertical = s.x0 === s.x1;
      const lo = vertical ? s.y0 : s.x0, hi = vertical ? s.y1 + 1 : s.x1 + 1;
      for (let p = lo; p <= hi; p++) {
        for (const d of [1, -1]) {
          let ok = true;
          // Straight run-up and landing; the landing may cross a bridge deck (still road).
          for (let k = -2; k <= 6 && ok; k++) {
            const q = p + k * d;
            ok = q >= lo && q <= hi && straightAt(b, s, q) && (k > 0 || b.lane[b.i(vertical ? s.x0 : q, vertical ? q : s.y0)] !== Lane.Bridge);
          }
          if (ok) opts.push({ s, p, d });
        }
      }
    }
    for (const o of rng.shuffle(opts)) {
      if (want <= 0) break;
      const vertical = o.s.x0 === o.s.x1;
      const x = vertical ? o.s.x0 + 1 : o.p + 0.5, y = vertical ? o.p + 0.5 : o.s.y0 + 1;
      if (at.some((q) => Math.hypot(q.x - x, q.y - y) < WORLD.rampSpacingTiles + 2)) continue;
      if (near(b, x, y, 3) || (Math.abs(y - (cy + 1)) < 0.6)) continue;   // keep goals and the spawn street clear
      at.push({ x, y });
      const angle = vertical ? (o.d > 0 ? Math.PI / 2 : -Math.PI / 2) : o.d > 0 ? 0 : Math.PI;
      ramps.push({ x: x * TS, y: y * TS, angle, w: WORLD.rampW, h: WORLD.rampH });
      want--;
    }
  };
  tryOn(segs.filter((s) => s.lane === Lane.Dirt), 1);
  if (!ramps.length) throw new Error('generateFarm: no straight dirt lane for the hay-bale ramp');
  tryOn(segs.filter((s) => s.lane === Lane.Paved), FARM_GEN.hillCrests);
  return ramps;
}

/** Mud puddles across half (sometimes all) of a dirt-lane strip, away from goals, ramps and junctions. */
function placeMud(b: FarmBuilder, rng: Rng, segs: Seg[], ramps: Ramp[]): void {
  const opts: { x: number; y: number; vertical: boolean }[] = [];
  for (const s of segs.filter((q) => q.lane === Lane.Dirt)) {
    const vertical = s.x0 === s.x1;
    const lo = vertical ? s.y0 : s.x0, hi = vertical ? s.y1 + 1 : s.x1 + 1;
    for (let p = lo + 3; p <= hi - 3; p++) {
      let ok = true;
      for (let k = -2; k <= 2 && ok; k++) ok = straightAt(b, s, p + k) && b.lane[b.i(vertical ? s.x0 : p + k, vertical ? p + k : s.y0)] === Lane.Dirt;
      if (ok) opts.push(vertical ? { x: s.x0, y: p, vertical } : { x: p, y: s.y0, vertical });
    }
  }
  const puddles: { x: number; y: number }[] = [];
  for (const o of rng.shuffle(opts)) {
    if (puddles.length >= FARM_GEN.mudPuddles) break;
    const cx = o.vertical ? o.x + 1 : o.x + 0.5, cyy = o.vertical ? o.y + 0.5 : o.y + 1;
    if (near(b, cx, cyy, 3.5)) continue;
    if (ramps.some((r) => Math.hypot(r.x / TS - cx, r.y / TS - cyy) < 8)) continue;
    if (puddles.some((q) => Math.hypot(q.x - cx, q.y - cyy) < 5)) continue;
    puddles.push({ x: cx, y: cyy });
    const both = rng.chance(0.3), first = rng.chance(0.5);
    for (const side of [0, 1]) {
      if (!both && (side === 0) !== first) continue;
      const tx = o.vertical ? o.x + side : o.x, ty = o.vertical ? o.y : o.y + side;
      b.tiles[b.i(tx, ty)] = Tile.Mud;
    }
  }
}

/** Spawn on a straight stretch of the village street near the map center, clear of ramps and goal rings. */
function pickSpawnX(b: FarmBuilder, rng: Rng, cy: number, ramps: Ramp[]): number {
  const street: Seg = { x0: LOOP, y0: cy, x1: b.w - 2 - LOOP, y1: cy, lane: Lane.Paved };
  // Strict first (straight for 5 tiles, away from goal rings); then just straight.
  for (const [reach, avoidGoals] of [[2, true], [2, false], [1, false]] as const) {
    const opts: number[] = [];
    for (let x = LOOP + 3; x <= b.w - LOOP - 5; x++) {
      let ok = true;
      for (let k = -reach; k <= reach && ok; k++) ok = straightAt(b, street, x + k);
      if (ok && avoidGoals && near(b, x + 0.5, cy + 1, 2.5)) ok = false;
      if (ok && !ramps.some((r) => Math.hypot(r.x / TS - x - 0.5, r.y / TS - cy - 1) < 4)) opts.push(x);
    }
    if (!opts.length) continue;
    opts.sort((p, q) => Math.abs(p - b.w / 2) - Math.abs(q - b.w / 2));
    return rng.pick(opts.slice(0, 3));
  }
  throw new Error('generateFarm: no straight street for spawns');
}

/** Mirror everything into the final frame and derive roadMask, the lane graph and spawns. */
function finish(seed: number, b: FarmBuilder, traffic: Uint8Array, ramps: Ramp[], mx: boolean, my: boolean, spawn: Vec2): WorldData {
  const W = b.w, H = b.h, PW = W * TS, PH = H * TS;
  const fx = (x: number) => (mx ? PW - x : x), fy = (y: number) => (my ? PH - y : y);
  const fp = <T extends Vec2>(p: T): T => ({ ...p, x: fx(p.x), y: fy(p.y) });
  const fa = (a: number) => {
    let r = a;
    if (mx) r = Math.PI - r;
    if (my) r = -r;
    r = Math.atan2(Math.sin(r), Math.cos(r));
    return Math.abs(r) < 1e-9 ? 0 : r;
  };
  const flipArr = (src: Uint8Array) => {
    const out = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) out[(my ? H - 1 - y : y) * W + (mx ? W - 1 - x : x)] = src[y * W + x];
    return out;
  };
  const tiles = flipArr(b.tiles), lane = flipArr(b.lane), trafficTiles = flipArr(traffic);

  const roadMask = new Uint8Array(W * H);
  const isLane = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && lane[y * W + x] !== Lane.None;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!isLane(x, y)) continue;
      roadMask[y * W + x] = (isLane(x, y - 1) ? ROAD_N : 0) | (isLane(x + 1, y) ? ROAD_E : 0)
        | (isLane(x, y + 1) ? ROAD_S : 0) | (isLane(x - 1, y) ? ROAD_W : 0);
    }
  }

  // The 1-tile traffic skeleton runs along the first tile of each 2-tile strip; after mirroring that
  // is the last tile, so the shift to the strip's center flips sign with the mirror.
  const grid: Grid = { w: W, h: H, tiles: trafficTiles, mask: new Uint8Array(W * H) };
  const laneGraph = generateLaneGraph(grid);
  for (const n of laneGraph.nodes) {
    n.x += mx ? -TS / 2 : TS / 2;
    n.y += my ? -TS / 2 : TS / 2;
  }

  const buildings = b.buildings.map((l) => ({
    ...l, tx: mx ? W - l.tx - l.tw : l.tx, ty: my ? H - l.ty - l.th : l.ty,
  }));
  const places = b.places.map((p) => ({ ...p, sign: fp(p.sign), front: fp(p.front) }));
  // Decorations keep their angle (footprints are symmetric; the sun and shadows do not mirror).
  const decorations = b.decorations.map((d) => fp(d));
  const fences = b.fences.map((f) => ({ a: fp(f.a), b: fp(f.b) }));
  const animalZones = b.zones.map((z) => ({ ...z, x: mx ? PW - z.x - z.w : z.x, y: my ? PH - z.y - z.h : z.y }));
  const props = b.props.map((p) => ({ ...fp(p), angle: fa(p.angle) }));
  const outRamps = ramps.map((r) => ({ ...fp(r), angle: fa(r.angle) }));

  // Both cars face east in the right-hand (southern) lane of the village street.
  const s = fp(spawn);
  const half = WORLD.spawnSpacingPx / 2;
  const playerSpawns = [half, -half].map((dx) => ({ x: s.x + dx, y: s.y + offY(0), angle: 0 }));

  return {
    seed, widthTiles: W, heightTiles: H, tileSize: TS,
    tiles, roadMask, buildings, places, ramps: outRamps, props, laneGraph, playerSpawns,
    farm: {
      decorations, fences, animalZones,
      shadowAngle: FARM_GEN.shadowAngle,
      shadowLength: FARM_GEN.shadowLength,
    },
  };
}
