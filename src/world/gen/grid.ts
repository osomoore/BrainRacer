import { ROAD_E, ROAD_N, ROAD_S, ROAD_W, Tile } from '../../core/types';

/** Direction index: 0 = E, 1 = S, 2 = W, 3 = N (clockwise on screen, +y down). */
export const DIRS = [
  { dx: 1, dy: 0, bit: ROAD_E },
  { dx: 0, dy: 1, bit: ROAD_S },
  { dx: -1, dy: 0, bit: ROAD_W },
  { dx: 0, dy: -1, bit: ROAD_N },
] as const;

export const opposite = (d: number): number => (d + 2) % 4;
/** Angle (radians) of travel for direction index d. */
export const dirAngle = (d: number): number => (d === 3 ? -Math.PI / 2 : (d * Math.PI) / 2);

export const MASK_NS = ROAD_N | ROAD_S;
export const MASK_EW = ROAD_E | ROAD_W;

export interface Grid {
  w: number;
  h: number;
  tiles: Uint8Array;
  mask: Uint8Array;
}

export const inBounds = (g: Grid, x: number, y: number): boolean => x >= 0 && y >= 0 && x < g.w && y < g.h;
export const idx = (g: Grid, x: number, y: number): number => y * g.w + x;
export const isRoad = (g: Grid, x: number, y: number): boolean => inBounds(g, x, y) && g.tiles[y * g.w + x] === Tile.Road;

export function computeRoadMask(g: Grid): void {
  g.mask.fill(0);
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (g.tiles[y * g.w + x] !== Tile.Road) continue;
      let m = 0;
      for (const d of DIRS) if (isRoad(g, x + d.dx, y + d.dy)) m |= d.bit;
      g.mask[y * g.w + x] = m;
    }
  }
}

/** Axis of a straight road tile at (x,y): 'h' (E|W), 'v' (N|S) or null. */
export function straightAxis(g: Grid, x: number, y: number): 'h' | 'v' | null {
  if (!inBounds(g, x, y)) return null;
  const m = g.mask[y * g.w + x];
  return m === MASK_EW ? 'h' : m === MASK_NS ? 'v' : null;
}
