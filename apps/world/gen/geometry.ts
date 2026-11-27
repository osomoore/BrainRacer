import { GEN } from '../config';
import type { Vec } from '../core/types';

export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }

export function boundsOf(points: readonly Vec[]): Bounds {
  return {
    minX: Math.min(...points.map(p => p.x)), minY: Math.min(...points.map(p => p.y)),
    maxX: Math.max(...points.map(p => p.x)), maxY: Math.max(...points.map(p => p.y)),
  };
}

export function circleBounds(x: number, y: number, radius: number): Bounds {
  return { minX: x - radius, minY: y - radius, maxX: x + radius, maxY: y + radius };
}

export function inBounds(bounds: Bounds, x: number, y: number): boolean {
  return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
}

export function inPolygon(points: readonly Vec[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function segmentDistanceSquared(x: number, y: number, a: Vec, b: Vec): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / lengthSquared));
  const px = x - (a.x + t * dx);
  const py = y - (a.y + t * dy);
  return px * px + py * py;
}

/** Distance from a point to the polygon, zero for points in its interior. */
export function polygonDistanceSquared(points: readonly Vec[], x: number, y: number): number {
  if (inPolygon(points, x, y)) return 0;
  let min = Infinity;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    min = Math.min(min, segmentDistanceSquared(x, y, points[j], points[i]));
  }
  return min;
}

/** World-aligned cells. Each plan only indexes cells touched by its own geometry. */
export class SpatialGrid<T> {
  private readonly rows = new Map<number, Map<number, T[]>>();

  insert(bounds: Bounds, value: T): void {
    for (let y = Math.floor(bounds.minY / GEN.spatialCell); y <= Math.floor(bounds.maxY / GEN.spatialCell); y++) {
      let row = this.rows.get(y);
      if (!row) this.rows.set(y, row = new Map());
      for (let x = Math.floor(bounds.minX / GEN.spatialCell); x <= Math.floor(bounds.maxX / GEN.spatialCell); x++) {
        const cell = row.get(x);
        if (cell) cell.push(value);
        else row.set(x, [value]);
      }
    }
  }

  at(x: number, y: number): readonly T[] {
    return this.rows.get(Math.floor(y / GEN.spatialCell))?.get(Math.floor(x / GEN.spatialCell)) ?? [];
  }

  *within(bounds: Bounds): IterableIterator<T> {
    const seen = new Set<T>();
    for (let y = Math.floor(bounds.minY / GEN.spatialCell); y <= Math.floor(bounds.maxY / GEN.spatialCell); y++) {
      const row = this.rows.get(y);
      if (!row) continue;
      for (let x = Math.floor(bounds.minX / GEN.spatialCell); x <= Math.floor(bounds.maxX / GEN.spatialCell); x++) {
        for (const value of row.get(x) ?? []) {
          if (!seen.has(value)) {
            seen.add(value);
            yield value;
          }
        }
      }
    }
  }
}
