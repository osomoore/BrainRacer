import type { Rng } from '../../core/rng';
import { WORLD } from '../../config/gameConfig';
import { Tile, type BuildingLot } from '../../core/types';
import { biomeAt } from './biome';
import { DIRS, isRoad, type Grid } from './grid';

export type BlockKind = 'building' | 'park' | 'plaza';

export interface Block {
  id: number;
  tiles: number[];          // all non-road land tile indices (sidewalk + interior)
  interior: number[];       // tile indices that are not sidewalk
  kind: BlockKind;
}

export interface BlockInfo {
  blocks: Block[];
  /** Block id per tile (-1 = none). */
  blockOf: Int32Array;
  lots: BuildingLot[];
  /** Block id of every lot, indexed by lot id. */
  lotBlock: number[];
}

const NB8: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Pass 2: flood-fill land between roads into blocks, add sidewalks, parks, plazas and building lots. */
export function generateBlocks(rng: Rng, g: Grid, seed: number, featureTiles: number[]): BlockInfo {
  const lo = WORLD.waterBorderTiles + 1;
  const blockOf = new Int32Array(g.w * g.h).fill(-1);
  const blocks: Block[] = [];

  // Flood fill non-road tiles inside the ring road.
  for (let y = lo + 1; y < g.h - lo - 1; y++) {
    for (let x = lo + 1; x < g.w - lo - 1; x++) {
      const i = y * g.w + x;
      if (g.tiles[i] === Tile.Road || blockOf[i] >= 0) continue;
      const id = blocks.length;
      const tiles: number[] = [];
      const stack = [i];
      blockOf[i] = id;
      while (stack.length) {
        const t = stack.pop()!;
        tiles.push(t);
        const tx = t % g.w, ty = (t / g.w) | 0;
        for (const d of DIRS) {
          const ni = (ty + d.dy) * g.w + tx + d.dx;
          if (g.tiles[ni] === Tile.Road || blockOf[ni] >= 0) continue;
          blockOf[ni] = id;
          stack.push(ni);
        }
      }
      tiles.sort((a, b) => a - b);
      blocks.push({ id, tiles, interior: [], kind: 'building' });
    }
  }

  // Sidewalks: land tiles touching a road (incl. diagonally).
  for (const b of blocks) {
    for (const t of b.tiles) {
      const tx = t % g.w, ty = (t / g.w) | 0;
      const touches = NB8.some(([dx, dy]) => isRoad(g, tx + dx, ty + dy));
      if (touches) g.tiles[t] = Tile.Sidewalk; else b.interior.push(t);
    }
  }

  // Choose parks / plazas under a land budget so buildings stay dominant.
  const totalInterior = blocks.reduce((s, b) => s + b.interior.length, 0);
  const merged = new Set(featureTiles.map((t) => blockOf[t]));
  const featureOrder = rng.shuffle(blocks.slice()).sort((a, b) => Number(merged.has(b.id)) - Number(merged.has(a.id)));
  let nonBuilding = 0;
  for (const b of featureOrder) {
    if (nonBuilding + b.interior.length > (1 - WORLD.minBuildingFrac) * totalInterior) continue;
    const isMerged = merged.has(b.id);
    if (isMerged) {
      b.kind = rng.chance(0.6) ? 'park' : 'plaza';
    } else {
      if (!isChunky(g, b) || biomeAt(b.tiles[0] % g.w, (b.tiles[0] / g.w) | 0, seed) !== 'city') continue;
      const r = rng.next();
      if (r < WORLD.parkChance) b.kind = 'park';
      else if (r < WORLD.parkChance + WORLD.plazaChance) b.kind = 'plaza';
      else continue;
    }
    nonBuilding += b.interior.length;
    const tile = b.kind === 'park' ? Tile.Park : Tile.Plaza;
    for (const t of b.interior) g.tiles[t] = tile;
    if (b.kind === 'park' && (isMerged || rng.chance(WORLD.pondChance))) makePond(rng, g, b);
  }

  // Alleys also consume building land. Keep the building fraction after excluding their tiles.
  const openSpaceBudget = (1 - WORLD.minBuildingFrac) * totalInterior;
  let alleyBudget = Math.floor((openSpaceBudget - nonBuilding) / (1 - WORLD.minBuildingFrac));
  const lots: BuildingLot[] = [];
  const lotBlock: number[] = [];
  for (const b of blocks) {
    if (b.kind !== 'building') continue;
    if (b.interior.length >= 9 && alleyBudget >= 2 && rng.chance(WORLD.alleyChance)) {
      const alleys = findAlleys(g, b, alleyBudget);
      if (alleys.length) {
        const alley = rng.pick(alleys);
        for (const t of alley) g.tiles[t] = Tile.Sidewalk;
        alleyBudget -= alley.length;
        b.interior = b.interior.filter((t) => g.tiles[t] !== Tile.Sidewalk);
      }
    }
    for (const t of b.interior) {
      if (g.tiles[t] === Tile.Building) continue;
      const tx = t % g.w, ty = (t / g.w) | 0;
      let w = Math.min(rng.weighted([1, 2, 3], [2, 4, 3]), WORLD.lotMaxSide);
      let h = Math.min(rng.weighted([1, 2, 3], [2, 4, 3]), WORLD.lotMaxSide);
      const free = (x: number, y: number) => {
        const i = y * g.w + x;
        return x < g.w && y < g.h && blockOf[i] === b.id && g.tiles[i] !== Tile.Building && g.tiles[i] !== Tile.Sidewalk;
      };
      const fits = () => {
        for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) if (!free(x, y)) return false;
        return true;
      };
      while (!fits()) { if (w >= h && w > 1) w--; else h--; }
      const lot: BuildingLot = { id: lots.length, tx, ty, tw: w, th: h, style: rng.int(0, 5) };
      for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) g.tiles[y * g.w + x] = Tile.Building;
      lots.push(lot);
      lotBlock.push(b.id);
    }
  }
  return breakLongWalls(g, { blocks, blockOf, lots, lotBlock });
}

/** Longest straight run of building tiles through (x,y) along the axis; returns [start, end] inclusive. */
function runAt(g: Grid, x: number, y: number, horizontal: boolean): [number, number] {
  const at = (p: number) => (horizontal ? g.tiles[y * g.w + p] : g.tiles[p * g.w + x]) === Tile.Building;
  let a = horizontal ? x : y, b = a;
  while (a > 0 && at(a - 1)) a--;
  while (b < (horizontal ? g.w : g.h) - 1 && at(b + 1)) b++;
  return [a, b];
}

/**
 * Cut an alley (one-tile sidewalk strip, side to side through the building mass) wherever a straight run of
 * building tiles exceeds WORLD.maxBuildingRun, so adjacent lots never form an unbroken wall. Lots crossed by a
 * cut are split into smaller lots.
 */
function breakLongWalls(g: Grid, info: BlockInfo): BlockInfo {
  const max = WORLD.maxBuildingRun;
  const cut = new Set<number>();
  for (let guard = 0; guard < g.w * g.h; guard++) {
    let found = false;
    scan:
    for (const horizontal of [true, false]) {
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          if (g.tiles[y * g.w + x] !== Tile.Building) continue;
          const [a, b] = runAt(g, x, y, horizontal);
          const len = b - a + 1;
          if (len <= max) { if (horizontal) x = b; continue; }
          // Cut so the left piece is as close to max as possible (fewest alleys), at least 1 tile each side.
          const c = a + Math.min(max, len - 2);
          // Alley runs perpendicular to the wall, through every consecutive building tile of that line.
          const pos = (p: number) => (horizontal ? p * g.w + c : c * g.w + p);
          let lo = horizontal ? y : x, hi = lo;
          const isB = (p: number) => g.tiles[pos(p)] === Tile.Building;
          while (lo > 0 && isB(lo - 1)) lo--;
          while (hi < (horizontal ? g.h : g.w) - 1 && isB(hi + 1)) hi++;
          for (let p = lo; p <= hi; p++) { g.tiles[pos(p)] = Tile.Sidewalk; cut.add(pos(p)); }
          found = true;
          break scan;
        }
      }
    }
    if (!found) break;
  }
  if (!cut.size) return info;

  // Re-tile lots that lost tiles into rectangles; untouched lots keep their shape.
  const lots: BuildingLot[] = [];
  const lotBlock: number[] = [];
  for (const lot of info.lots) {
    const blk = info.lotBlock[lot.id];
    let touched = false;
    for (let y = lot.ty; y < lot.ty + lot.th && !touched; y++) for (let x = lot.tx; x < lot.tx + lot.tw; x++) if (cut.has(y * g.w + x)) { touched = true; break; }
    if (!touched) { lots.push({ ...lot, id: lots.length }); lotBlock.push(blk); continue; }
    const used = new Set<number>();
    const ok = (x: number, y: number) => x < lot.tx + lot.tw && y < lot.ty + lot.th && g.tiles[y * g.w + x] === Tile.Building && !used.has(y * g.w + x);
    for (let y = lot.ty; y < lot.ty + lot.th; y++) for (let x = lot.tx; x < lot.tx + lot.tw; x++) {
      if (!ok(x, y)) continue;
      let w = 1, h = 1;
      while (ok(x + w, y)) w++;
      const rowOk = () => { for (let xx = x; xx < x + w; xx++) if (!ok(xx, y + h)) return false; return true; };
      while (y + h < lot.ty + lot.th && rowOk()) h++;
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) used.add(yy * g.w + xx);
      lots.push({ id: lots.length, tx: x, ty: y, tw: w, th: h, style: lot.style });
      lotBlock.push(blk);
    }
  }
  return { ...info, lots, lotBlock };
}

/** Find one-tile-wide passages between two outer sidewalks with building space on both sides. */
function findAlleys(g: Grid, b: Block, maxLength: number): number[][] {
  const alleys: number[][] = [];
  for (const [along, across] of [[1, g.w], [g.w, 1]]) {
    for (const start of b.interior) {
      if (g.tiles[start - along] !== Tile.Sidewalk) continue;
      const line: number[] = [];
      let t = start;
      while (g.tiles[t] === Tile.Grass && g.tiles[t - across] === Tile.Grass && g.tiles[t + across] === Tile.Grass) {
        line.push(t);
        t += along;
      }
      if (line.length >= 2 && line.length <= maxLength && g.tiles[t] === Tile.Sidewalk) alleys.push(line);
    }
  }
  return alleys;
}

/** A single water tile in a park, only where all 8 neighbours are park (never touches roads). */
function makePond(rng: Rng, g: Grid, b: Block): void {
  const cands = b.interior.filter((t) => {
    const tx = t % g.w, ty = (t / g.w) | 0;
    return NB8.every(([dx, dy]) => g.tiles[(ty + dy) * g.w + tx + dx] === Tile.Park);
  });
  if (cands.length) g.tiles[rng.pick(cands)] = Tile.Water;
}

/** True if the block interior contains a 2x2 area (so a park/plaza reads as more than a strip). */
function isChunky(g: Grid, b: Block): boolean {
  const set = new Set(b.interior);
  return b.interior.some((t) => set.has(t + 1) && set.has(t + g.w) && set.has(t + g.w + 1));
}
