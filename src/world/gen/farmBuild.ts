/**
 * Farm generator building blocks (Phaser-free): a shared builder, field cells and the fillers that
 * dress each cell (farmstead, corn, corn maze, pasture, woods, windmill + pond, orchard, village).
 * Everything here works in the un-mirrored "design" frame; farm.ts mirrors the result.
 */
import { FARM_GEN, GOALS, TILE_SIZE } from '../../config/gameConfig';
import type { Rng } from '../../core/rng';
import {
  Tile, type BuildingLot, type FarmAnimalKind, type FarmAnimalZone, type FarmDecoration,
  type FarmDecorationKind, type FarmFence, type PlaceSite, type Prop, type Vec2,
} from '../../core/types';
import { FARM_PLACE_WORDS } from '../../data/places';

const TS = TILE_SIZE;

/** Lane kinds painted under roads (0 = not a lane). */
export enum Lane { None = 0, Paved = 1, Dirt = 2, Bridge = 3 }

/** Side of a cell that touches a road: the road lies just beyond that edge. */
export type Side = 'N' | 'E' | 'S' | 'W';

export interface Cell {
  x: number; y: number; w: number; h: number;
  /** Sides with a road strip directly beyond the edge. */
  roads: Side[];
}

export type Role =
  | 'village' | 'farmstead' | 'maze' | 'corn' | 'pasture' | 'woods' | 'windmillPond' | 'orchard';

export class FarmBuilder {
  readonly tiles: Uint8Array;
  readonly lane: Uint8Array;
  /** 1 where something solid or a feature already sits (lots, pond, trees, bales). */
  readonly occ: Uint8Array;
  readonly buildings: BuildingLot[] = [];
  readonly places: PlaceSite[] = [];
  readonly decorations: FarmDecoration[] = [];
  readonly fences: FarmFence[] = [];
  readonly zones: FarmAnimalZone[] = [];
  readonly props: Prop[] = [];

  constructor(readonly rng: Rng, readonly w: number, readonly h: number) {
    this.tiles = new Uint8Array(w * h);
    this.lane = new Uint8Array(w * h);
    this.occ = new Uint8Array(w * h);
  }

  i(x: number, y: number): number { return y * this.w + x; }
  inside(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  tile(x: number, y: number): number { return this.inside(x, y) ? this.tiles[this.i(x, y)] : Tile.Water; }

  fill(x: number, y: number, w: number, h: number, t: Tile): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (this.inside(xx, yy)) this.tiles[this.i(xx, yy)] = t;
  }

  /** True if a rect is free ground (no lane, water, lot or feature) and has a 1-tile building-free margin. */
  free(x: number, y: number, w: number, h: number): boolean {
    for (let yy = y - 1; yy <= y + h; yy++) {
      for (let xx = x - 1; xx <= x + w; xx++) {
        const inRect = xx >= x && yy >= y && xx < x + w && yy < y + h;
        if (!this.inside(xx, yy)) { if (inRect) return false; continue; }
        const k = this.i(xx, yy);
        if (this.tiles[k] === Tile.Building) return false;
        if (inRect && (this.occ[k] || this.lane[k] || this.tiles[k] === Tile.Water)) return false;
      }
    }
    return true;
  }

  mark(x: number, y: number, w: number, h: number): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.occ[this.i(xx, yy)] = 1;
  }

  addLot(x: number, y: number, w: number, h: number, kind?: FarmDecorationKind, word?: string): BuildingLot {
    const lot: BuildingLot = { id: this.buildings.length, tx: x, ty: y, tw: w, th: h, style: this.rng.int(0, 5) };
    if (word) lot.placeWord = word;
    this.buildings.push(lot);
    this.fill(x, y, w, h, Tile.Building);
    this.mark(x, y, w, h);
    if (kind) this.deco(kind, x + w / 2, y + h / 2, w, h, false, lot.id);
    return lot;
  }

  /** Decoration centered at tile coords (cx, cy), size in tiles. */
  deco(kind: FarmDecorationKind, cx: number, cy: number, w: number, h: number, solid: boolean, buildingId?: number): void {
    const d: FarmDecoration = { kind, x: cx * TS, y: cy * TS, w: w * TS, h: h * TS, angle: 0, solid };
    if (buildingId !== undefined) d.buildingId = buildingId;
    this.decorations.push(d);
  }

  /** A goal front can host a full goal ring: every sample around it is open, non-water ground. */
  frontClear(f: Vec2): boolean {
    const r = GOALS.radius;
    for (let k = 0; k <= 8; k++) {
      const a = (k * Math.PI) / 4;
      const x = k === 8 ? f.x : f.x + Math.cos(a) * r, y = k === 8 ? f.y : f.y + Math.sin(a) * r;
      const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
      if (!this.inside(tx, ty)) return false;
      const t = this.tiles[this.i(tx, ty)];
      if (t === Tile.Water || t === Tile.Building || t === Tile.Mud) return false;
      if (this.occ[this.i(tx, ty)] && !this.lane[this.i(tx, ty)]) return false;
    }
    const ft = this.i(Math.floor(f.x / TS), Math.floor(f.y / TS));
    return this.lane[ft] !== Lane.None && this.lane[ft] !== Lane.Bridge;
  }
}

// ───────────── cell frames: (u along the road side, v depth away from it) ─────────────

export function sideLength(c: Cell, s: Side): { L: number; D: number } {
  return s === 'N' || s === 'S' ? { L: c.w, D: c.h } : { L: c.h, D: c.w };
}

/** Tile rect for a footprint of lu (along) × lv (depth) at (u, v) measured from side s. */
export function frameRect(c: Cell, s: Side, u: number, v: number, lu: number, lv: number): [number, number, number, number] {
  switch (s) {
    case 'N': return [c.x + u, c.y + v, lu, lv];
    case 'S': return [c.x + u, c.y + c.h - v - lv, lu, lv];
    case 'W': return [c.x + v, c.y + u, lv, lu];
    case 'E': return [c.x + c.w - v - lv, c.y + u, lv, lu];
  }
}

/** Pixel point on the centerline of the 2-tile road strip beyond side s, level with the rect's center. */
export function frontFor(c: Cell, s: Side, x: number, y: number, w: number, h: number): Vec2 {
  const mx = (x + w / 2) * TS, my = (y + h / 2) * TS;
  switch (s) {
    case 'N': return { x: mx, y: (c.y - 1) * TS };
    case 'S': return { x: mx, y: (c.y + c.h + 1) * TS };
    case 'W': return { x: (c.x - 1) * TS, y: my };
    case 'E': return { x: (c.x + c.w + 1) * TS, y: my };
  }
}

/**
 * Place a signed lot right behind the 1-tile verge of one of the cell's road sides
 * so its goal ring sits on the road in front of it. Returns false if nothing fits.
 */
export function placeSigned(
  b: FarmBuilder, c: Cell, lu: number, lv: number, word: string, kind?: FarmDecorationKind, sides = c.roads, prefer?: Vec2,
): boolean {
  if (!FARM_PLACE_WORDS.includes(word)) return false;
  const used = new Set(b.places.map((p) => `${p.front.x},${p.front.y}`));
  const spots: { s: Side; u: number; d: number }[] = [];
  for (const s of b.rng.shuffle(sides.slice())) {
    const { L, D } = sideLength(c, s);
    if (D < lv + 2) continue;
    const us: number[] = [];
    for (let u = 1; u + lu <= L - 1; u++) us.push(u);
    for (const u of b.rng.shuffle(us)) {
      const [x, y, w, h] = frameRect(c, s, u, 1, lu, lv);
      spots.push({ s, u, d: prefer ? Math.hypot((x + w / 2) * TS - prefer.x, (y + h / 2) * TS - prefer.y) : 0 });
    }
  }
  if (prefer) spots.sort((p, q) => p.d - q.d);
  for (const { s, u } of spots) {
    const [x, y, w, h] = frameRect(c, s, u, 1, lu, lv);
    if (!b.free(x, y, w, h)) continue;
    const front = frontFor(c, s, x, y, w, h);
    if (used.has(`${front.x},${front.y}`) || !b.frontClear(front)) continue;
    if (b.places.some((p) => Math.hypot(p.front.x - front.x, p.front.y - front.y) < GOALS.radius * 2)) continue;
    const lot = b.addLot(x, y, w, h, kind, word);
    b.places.push({ word, buildingId: lot.id, sign: { x: (x + w / 2) * TS, y: (y + h / 2) * TS }, front });
    return true;
  }
  return false;
}

/** Inner rect of a cell (1-tile verge removed). */
const inner = (c: Cell): [number, number, number, number] => [c.x + 1, c.y + 1, c.w - 2, c.h - 2];

/** Place an unsigned lot anywhere in the cell interior, deepest-from-road first. */
function placeLoose(b: FarmBuilder, c: Cell, w: number, h: number, kind: FarmDecorationKind, front: Side): boolean {
  const [ix, iy, iw, ih] = inner(c);
  const cands: { x: number; y: number; w: number; h: number; depth: number }[] = [];
  for (const [lw, lh] of w === h ? [[w, h]] : [[w, h], [h, w]]) {
    for (let y = iy; y + lh <= iy + ih; y++) {
      for (let x = ix; x + lw <= ix + iw; x++) {
        const depth = front === 'N' ? y : front === 'S' ? -y : front === 'W' ? x : -x;
        cands.push({ x, y, w: lw, h: lh, depth: depth + b.rng.next() * 1.5 });
      }
    }
  }
  cands.sort((a, z) => z.depth - a.depth);
  const spot = cands.find((r) => b.free(r.x, r.y, r.w, r.h));
  if (spot) b.addLot(spot.x, spot.y, spot.w, spot.h, kind);
  return !!spot;
}

/** Free 1×1 interior tiles of a cell (inset by `inset`), optionally away from lots. */
function freeTiles(b: FarmBuilder, c: Cell, inset: number): number[] {
  const out: number[] = [];
  for (let y = c.y + inset; y < c.y + c.h - inset; y++) {
    for (let x = c.x + inset; x < c.x + c.w - inset; x++) if (b.free(x, y, 1, 1)) out.push(b.i(x, y));
  }
  return out;
}

// ───────────────────────────── fillers ─────────────────────────────

export function fillFarmstead(b: FarmBuilder, c: Cell, index: number): void {
  const [ix, iy, iw, ih] = inner(c);
  b.fill(ix, iy, iw, ih, Tile.Dirt);
  const signed: [number, number, FarmDecorationKind | undefined, string][] = [
    [2, 2, 'farmhouse', 'farm'], [3, 3, 'barn', 'barn'], [1, 1, undefined, 'well'],
  ];
  const [lu, lv, kind, word] = signed[Math.min(index, signed.length - 1)];
  const front = b.rng.pick(c.roads);
  // The big barn claims the back of the yard first unless it is this farm's signed building.
  let barn = kind !== 'barn' && placeLoose(b, c, 3, 3, 'barn', front);
  const signedOk = index < signed.length && placeSigned(b, c, lu, lv, word, kind);
  if (signedOk && kind === 'barn') barn = true;
  if (!barn) placeLoose(b, c, 3, 3, 'barn', front);
  if (!(signedOk && kind === 'farmhouse')) placeLoose(b, c, 2, 2, 'farmhouse', front);
  placeLoose(b, c, 1, 1, 'silo', front);
  placeLoose(b, c, 2, 1, 'shed', front);

  const [lo, hi] = FARM_GEN.hayBalesPerYard;
  const yard = freeTiles(b, c, 1).filter((k) => b.tiles[k] === Tile.Dirt);
  for (const k of b.rng.shuffle(yard).slice(0, b.rng.int(lo, hi))) {
    const x = k % b.w, y = Math.floor(k / b.w);
    b.occ[k] = 1;
    b.deco('hayBale', x + 0.5, y + 0.5, FARM_GEN.hayBaleSize, FARM_GEN.hayBaleSize, true);
  }
  b.zones.push(zone('chicken', ix, iy, iw, ih, false));
}

function zone(kind: FarmAnimalKind, x: number, y: number, w: number, h: number, fenced: boolean): FarmAnimalZone {
  return { kind, x: x * TS, y: y * TS, w: w * TS, h: h * TS, count: FARM_GEN.animals[kind], fenced };
}

export function fillCorn(b: FarmBuilder, c: Cell, pumpkins: boolean): void {
  b.fill(c.x, c.y, c.w, c.h, Tile.Corn);
  if (!pumpkins) return;
  const pw = Math.min(3, c.w - 2), ph = Math.min(2, c.h - 2);
  const px = b.rng.chance(0.5) ? c.x + 1 : c.x + c.w - 1 - pw;
  const py = b.rng.chance(0.5) ? c.y + 1 : c.y + c.h - 1 - ph;
  b.fill(px, py, pw, ph, Tile.Grass);
  b.deco('pumpkinPatch', px + pw / 2, py + ph / 2, pw, ph, false);
}

/** Corn with a carved maze of mown (Grass) paths; at least two openings onto roads. */
export function fillMaze(b: FarmBuilder, c: Cell): void {
  b.fill(c.x, c.y, c.w, c.h, Tile.Corn);
  const rw = Math.floor((c.w - 1) / 2), rh = Math.floor((c.h - 1) / 2);
  const room = (i: number, j: number) => [c.x + 1 + 2 * i, c.y + 1 + 2 * j] as const;
  const mow = (x: number, y: number) => { b.tiles[b.i(x, y)] = Tile.Grass; };
  const seen = new Uint8Array(rw * rh);
  const stack: [number, number][] = [[b.rng.int(0, rw - 1), b.rng.int(0, rh - 1)]];
  seen[stack[0][1] * rw + stack[0][0]] = 1;
  mow(...room(...stack[0]));
  const steps: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (stack.length) {
    const [i, j] = stack[stack.length - 1];
    const open = steps.filter(([di, dj]) => {
      const ni = i + di, nj = j + dj;
      return ni >= 0 && nj >= 0 && ni < rw && nj < rh && !seen[nj * rw + ni];
    });
    if (!open.length) { stack.pop(); continue; }
    const [di, dj] = b.rng.pick(open);
    const [x, y] = room(i, j);
    mow(x + di, y + dj);
    mow(x + 2 * di, y + 2 * dj);
    seen[(j + dj) * rw + i + di] = 1;
    stack.push([i + di, j + dj]);
  }
  // Knock out a few extra walls between rooms (loops are friendlier for 5-year-olds).
  for (let k = 0; k < FARM_GEN.mazeExtraOpenings; k++) {
    const i = b.rng.int(0, rw - 1), j = b.rng.int(0, rh - 1);
    const [x, y] = room(i, j);
    if (i + 1 < rw && b.rng.chance(0.5)) mow(x + 1, y); else if (j + 1 < rh) mow(x, y + 1);
  }
  // Entrances: one per road side (at least two), carved from the edge room to the road verge.
  for (const s of c.roads) {
    const along = s === 'N' || s === 'S' ? rw : rh;
    const k = b.rng.int(0, along - 1);
    const [x, y] = s === 'N' ? room(k, 0) : s === 'S' ? room(k, rh - 1) : s === 'W' ? room(0, k) : room(rw - 1, k);
    if (s === 'N') for (let yy = c.y; yy <= y; yy++) mow(x, yy);
    if (s === 'S') for (let yy = y; yy < c.y + c.h; yy++) mow(x, yy);
    if (s === 'W') for (let xx = c.x; xx <= x; xx++) mow(xx, y);
    if (s === 'E') for (let xx = x; xx < c.x + c.w; xx++) mow(xx, y);
  }
  b.deco('cornMaze', c.x + c.w / 2, c.y + c.h / 2, c.w, c.h, false);
}

/** Fenced paddock inset by the 1-tile verge, with wide open gates on road-facing sides. */
export function fillPasture(b: FarmBuilder, c: Cell, kind: FarmAnimalKind): void {
  const [ix, iy, iw, ih] = inner(c);
  b.fill(c.x, c.y, c.w, c.h, Tile.Grass);
  const g = FARM_GEN.gateTiles;
  // Gates prefer road-facing sides that are long enough; a pasture always gets at least one.
  const sideLen = (s: Side) => (s === 'N' || s === 'S' ? iw : ih);
  const roomy = (['N', 'E', 'S', 'W'] as Side[]).filter((s) => sideLen(s) >= g + 2);
  const ranked = [...b.rng.shuffle(roomy.filter((s) => c.roads.includes(s))), ...b.rng.shuffle(roomy.filter((s) => !c.roads.includes(s)))];
  const gateSides = new Set(ranked.slice(0, FARM_GEN.gatesPerPasture));
  const edge = (s: Side): [Vec2, Vec2, number] => {
    const x0 = ix * TS, y0 = iy * TS, x1 = (ix + iw) * TS, y1 = (iy + ih) * TS;
    switch (s) {
      case 'N': return [{ x: x0, y: y0 }, { x: x1, y: y0 }, iw];
      case 'S': return [{ x: x0, y: y1 }, { x: x1, y: y1 }, iw];
      case 'W': return [{ x: x0, y: y0 }, { x: x0, y: y1 }, ih];
      case 'E': return [{ x: x1, y: y0 }, { x: x1, y: y1 }, ih];
    }
  };
  for (const s of ['N', 'E', 'S', 'W'] as Side[]) {
    const [a, z, len] = edge(s);
    const lerp = (t: number): Vec2 => ({ x: a.x + ((z.x - a.x) * t) / len, y: a.y + ((z.y - a.y) * t) / len });
    if (gateSides.has(s) && len >= g + 2) {
      const at = b.rng.int(1, len - g - 1);
      b.fences.push({ a, b: lerp(at) }, { a: lerp(at + g), b: z });
    } else {
      b.fences.push({ a, b: z });
    }
  }
  b.mark(ix, iy, iw, ih);
  b.zones.push(zone(kind, ix, iy, iw, ih, true));
  if (kind === 'pig') {
    // Pigs get a muddy wallow inside their pen.
    const mw = Math.min(2, iw - 2), mh = Math.min(2, ih - 2);
    if (mw > 0 && mh > 0) b.fill(ix + b.rng.int(1, iw - 1 - mw), iy + b.rng.int(1, ih - 1 - mh), mw, mh, Tile.Mud);
  }
}

export function fillWoods(b: FarmBuilder, c: Cell): void {
  b.fill(c.x, c.y, c.w, c.h, Tile.Grass);
  placeSigned(b, c, 2, 2, 'campsite');
  placeSigned(b, c, 2, 2, 'cave');
  placeSigned(b, c, 2, 1, 'forest');
  // Trees may stand right beside the cabins (unlike yards, woods are meant to feel dense).
  for (let y = c.y + 1; y < c.y + c.h - 1; y++) for (let x = c.x + 1; x < c.x + c.w - 1; x++) {
    const k = b.i(x, y);
    if (b.occ[k] || b.tiles[k] !== Tile.Grass || !b.rng.chance(FARM_GEN.treeChance)) continue;
    b.occ[k] = 1;
    b.props.push({
      kind: b.rng.chance(0.75) ? 'tree' : 'bush',
      x: (x + 0.5) * TS + b.rng.range(-30, 30), y: (y + 0.5) * TS + b.rng.range(-30, 30),
      angle: b.rng.range(0, Math.PI * 2),
    });
  }
}

export function fillWindmillPond(b: FarmBuilder, c: Cell): void {
  b.fill(c.x, c.y, c.w, c.h, Tile.Grass);
  const [ix, iy, iw, ih] = inner(c);
  // The duck pond goes in first, as far from the roads as it can (leaving the road sides for lots).
  const roadDist = (x: number, y: number, pw: number, ph: number) => Math.min(...c.roads.map((s) =>
    s === 'N' ? y - c.y : s === 'S' ? c.y + c.h - (y + ph) : s === 'W' ? x - c.x : c.x + c.w - (x + pw)));
  let best: { x: number; y: number; pw: number; ph: number; d: number } | undefined;
  for (const [pw, ph] of [[3, 3], [3, 2], [2, 3], [2, 2]]) {
    if (pw > iw - 1 || ph > ih - 1) continue;
    for (let y = iy; y + ph <= iy + ih; y++) {
      for (let x = ix; x + pw <= ix + iw; x++) {
        const d = roadDist(x, y, pw, ph) + b.rng.next() * 0.5;
        if (b.free(x, y, pw, ph) && (!best || d > best.d)) best = { x, y, pw, ph, d };
      }
    }
    if (best) break;
  }
  if (best) {
    const { x, y, pw, ph } = best;
    b.fill(x, y, pw, ph, Tile.Water);
    b.mark(x, y, pw, ph);
    const zx = Math.max(c.x + 1, x - 1), zy = Math.max(c.y + 1, y - 1);
    const zw = Math.min(c.x + c.w - 1, x + pw + 1) - zx, zh = Math.min(c.y + c.h - 1, y + ph + 1) - zy;
    b.zones.push(zone('duck', zx, zy, zw, zh, false));
  }
  const pond = best ? { x: (best.x + best.pw / 2) * TS, y: (best.y + best.ph / 2) * TS } : undefined;
  placeSigned(b, c, 2, 2, 'windmill', 'windmill');
  placeSigned(b, c, 2, 1, 'lake', undefined, c.roads, pond);
}

export function fillOrchard(b: FarmBuilder, c: Cell): void {
  b.fill(c.x, c.y, c.w, c.h, Tile.Grass);
  const ox = b.rng.int(0, 1), oy = b.rng.int(0, 1);
  for (let y = c.y + 1 + oy; y < c.y + c.h - 1; y += 2) {
    for (let x = c.x + 1 + ox; x < c.x + c.w - 1; x += 2) {
      b.occ[b.i(x, y)] = 1;
      b.deco('orchardTree', x + 0.5, y + 0.5, FARM_GEN.orchardTreeSize, FARM_GEN.orchardTreeSize, true);
    }
  }
}

/** Village crossroads block: plaza ground ringed by small shops and houses. */
export function fillVillage(b: FarmBuilder, c: Cell): void {
  b.fill(c.x, c.y, c.w, c.h, Tile.Plaza);
  placeSigned(b, c, 3, 2, 'school');
  placeSigned(b, c, 2, 2, 'bakery');
  placeSigned(b, c, 2, 2, 'shop');
  placeSigned(b, c, 2, 2, 'house');
  // Plain houses fill the rest of the ring behind the verge.
  for (const s of c.roads) {
    const { L } = sideLength(c, s);
    for (let u = 1; u + 2 <= L - 1; u++) {
      const [x, y, w, h] = frameRect(c, s, u, 1, 2, 2);
      if (b.free(x, y, w, h)) b.addLot(x, y, w, h);
    }
  }
}
