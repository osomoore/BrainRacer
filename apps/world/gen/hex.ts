import { WORLD } from '../config';
import type { HexCoord, Vec } from '../core/types';

const SQRT3 = Math.sqrt(3);
const EDGE_DIRECTIONS: readonly HexCoord[] = [
  { q: 1, r: 0 }, { q: 0, r: 1 }, { q: -1, r: 1 },
  { q: -1, r: 0 }, { q: 0, r: -1 }, { q: 1, r: -1 },
];

/** Axial pointy-top coordinates: +q points east and +r points southeast. */
export function hexToWorld(coord: HexCoord): Vec {
  const size = WORLD.hexSize;
  return { x: size * SQRT3 * (coord.q + coord.r / 2), y: size * 1.5 * coord.r };
}

/** Convert world pixels to the nearest pointy-top axial hex. */
export function worldToHex(x: number, y: number): HexCoord {
  const size = WORLD.hexSize;
  const q = (SQRT3 / 3 * x - y / 3) / size;
  const r = (2 / 3 * y) / size;
  const s = -q - r;
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
  const qDiff = Math.abs(rq - q), rDiff = Math.abs(rr - r), sDiff = Math.abs(rs - s);
  if (qDiff > rDiff && qDiff > sDiff) rq = -rr - rs;
  else if (rDiff > sDiff) rr = -rq - rs;
  return { q: rq, r: rr };
}

/** Six corners, clockwise in screen coordinates, starting at the upper-right corner. */
export function corners(coord: HexCoord): Vec[] {
  const center = hexToWorld(coord);
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (-30 + 60 * i) * Math.PI / 180;
    return { x: center.x + WORLD.hexSize * Math.cos(angle), y: center.y + WORLD.hexSize * Math.sin(angle) };
  });
}

/** Neighbor across edge index 0..5; edge 0 is east and indices continue clockwise. */
export function neighbor(coord: HexCoord, edge: number): HexCoord {
  const d = EDGE_DIRECTIONS[((Math.trunc(edge) % 6) + 6) % 6];
  return { q: coord.q + d.q, r: coord.r + d.r };
}

export function neighbors(coord: HexCoord): HexCoord[] {
  return EDGE_DIRECTIONS.map((_, edge) => neighbor(coord, edge));
}

export function ring(center: HexCoord, radius: number): HexCoord[] {
  const n = Math.max(0, Math.trunc(radius));
  if (n === 0) return [{ ...center }];
  // Start at the northwest corner and walk clockwise around the perimeter.
  let pos = { q: center.q + n * EDGE_DIRECTIONS[4].q, r: center.r + n * EDGE_DIRECTIONS[4].r };
  const result: HexCoord[] = [];
  for (let side = 0; side < 6; side++) {
    const d = EDGE_DIRECTIONS[side];
    for (let step = 0; step < n; step++) {
      result.push(pos);
      pos = { q: pos.q + d.q, r: pos.r + d.r };
    }
  }
  return result;
}

export function distance(a: HexCoord, b: HexCoord): number {
  const dq = a.q - b.q, dr = a.r - b.r;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}

/** Midpoint of the shared edge, with edge 0 on the east side. */
export function edgeMidpoint(coord: HexCoord, edge: number): Vec {
  const c = hexToWorld(coord);
  const angle = (((Math.trunc(edge) % 6 + 6) % 6) * 60) * Math.PI / 180;
  const radius = WORLD.hexSize * SQRT3 / 2;
  return { x: c.x + radius * Math.cos(angle), y: c.y + radius * Math.sin(angle) };
}

export function hexKey(coord: HexCoord): string { return `${coord.q},${coord.r}`; }
