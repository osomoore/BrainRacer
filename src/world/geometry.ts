/** Phaser-free world geometry helpers (package G). */
import { Tile, type Ramp, type Rect, type Vec2, type WorldData } from '../core/types';

export const tileToPx = (t: number, tileSize: number): number => t * tileSize;
export const pxToTile = (p: number, tileSize: number): number => Math.floor(p / tileSize);
export const tileCenter = (t: number, tileSize: number): number => t * tileSize + tileSize / 2;

export function tileAt(world: WorldData, tx: number, ty: number): Tile | -1 {
  if (tx < 0 || ty < 0 || tx >= world.widthTiles || ty >= world.heightTiles) return -1;
  return world.tiles[ty * world.widthTiles + tx] as Tile;
}

export function isDrivableTile(t: number): boolean {
  return t === Tile.Road || t === Tile.Sidewalk || t === Tile.Plaza || t === Tile.Park || t === Tile.Grass || t === Tile.Dirt
    || t === Tile.Corn || t === Tile.Mud;
}

type Footprints = ReadonlyArray<ReadonlyArray<Vec2>>;
const footprintsByWorld = new WeakMap<WorldData, Map<number, Footprints>>();

/** Register the same geometry used by Matter for point queries such as jump landings. */
export function registerBuildingFootprints(world: WorldData, lots: ReadonlyMap<number, Footprints>): void {
  const byTile = new Map<number, Footprints>();
  for (const { id, tx, ty, tw, th } of world.buildings) {
    const polygons = lots.get(id);
    if (!polygons) continue;
    for (let y = ty; y < ty + th; y++) for (let x = tx; x < tx + tw; x++) {
      byTile.set(y * world.widthTiles + x, polygons);
    }
  }
  footprintsByWorld.set(world, byTile);
}

function inConvexFootprint(points: ReadonlyArray<Vec2>, x: number, y: number): boolean {
  let positive = false, negative = false;
  for (const [i, a] of points.entries()) {
    const b = points[(i + 1) % points.length];
    const side = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
    positive ||= side > 0;
    negative ||= side < 0;
    if (positive && negative) return false;
  }
  return true;
}

export function isDrivable(world: WorldData, x: number, y: number): boolean {
  const tx = pxToTile(x, world.tileSize), ty = pxToTile(y, world.tileSize);
  const t = tileAt(world, tx, ty);
  if (t === Tile.Building) {
    const footprints = footprintsByWorld.get(world)?.get(ty * world.widthTiles + tx);
    if (footprints) return !footprints.some(points => inConvexFootprint(points, x, y));
  }
  return t !== -1 && isDrivableTile(t);
}

/** Greedy rectangle merge of a boolean grid (row-major). Returns tile-space rects {x,y,w,h}. */
export function mergeRects(grid: ArrayLike<boolean | number>, w: number, h: number): Rect[] {
  const used = new Uint8Array(w * h);
  const rects: Rect[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!grid[y * w + x] || used[y * w + x]) continue;
      let rw = 1;
      while (x + rw < w && grid[y * w + x + rw] && !used[y * w + x + rw]) rw++;
      let rh = 1;
      outer: while (y + rh < h) {
        for (let k = 0; k < rw; k++) {
          const i = (y + rh) * w + x + k;
          if (!grid[i] || used[i]) break outer;
        }
        rh++;
      }
      for (let j = 0; j < rh; j++) for (let k = 0; k < rw; k++) used[(y + j) * w + x + k] = 1;
      rects.push({ x, y, w: rw, h: rh });
    }
  }
  return rects;
}

/** Center of the nearest Road tile to (x, y); null if the map has no roads. */
export function nearestRoadPoint(world: WorldData, x: number, y: number): Vec2 | null {
  const ts = world.tileSize;
  let best: Vec2 | null = null;
  let bd = Infinity;
  for (let ty = 0; ty < world.heightTiles; ty++) {
    for (let tx = 0; tx < world.widthTiles; tx++) {
      if (world.tiles[ty * world.widthTiles + tx] !== Tile.Road) continue;
      const cx = tileCenter(tx, ts), cy = tileCenter(ty, ts);
      const d = (cx - x) ** 2 + (cy - y) ** 2;
      if (d < bd) { bd = d; best = { x: cx, y: cy }; }
    }
  }
  return best;
}

/** Oriented rectangle test: w along `angle`, h across. */
export function pointInRamp(ramp: Ramp, x: number, y: number): boolean {
  const dx = x - ramp.x, dy = y - ramp.y;
  const c = Math.cos(ramp.angle), s = Math.sin(ramp.angle);
  const lx = dx * c + dy * s;
  const ly = -dx * s + dy * c;
  return Math.abs(lx) <= ramp.w / 2 && Math.abs(ly) <= ramp.h / 2;
}
