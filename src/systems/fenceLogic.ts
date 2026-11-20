import type { Rect, Vec2 } from '../core/types';

/** Distance from a point to a finite line segment. */
function pointDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = dx * dx + dy * dy;
  const t = d ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / d)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

/** Swept vehicle path intersects the padded fence section, including fast crossings. */
export function hitsFence(a: Vec2, b: Vec2, c: Vec2, d: Vec2, radius: number): boolean {
  const cross = (p: Vec2, q: Vec2, r: Vec2) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const abC = cross(a, b, c), abD = cross(a, b, d), cdA = cross(c, d, a), cdB = cross(c, d, b);
  if (abC * abD < 0 && cdA * cdB < 0) return true;
  return Math.min(pointDistance(a, c, d), pointDistance(b, c, d), pointDistance(c, a, b), pointDistance(d, a, b)) <= radius;
}

/** Keep a section scattered until its entire affected area is outside every view. */
export function fenceOffscreen(x: number, y: number, radius: number, views: Rect[], margin: number): boolean {
  return views.every(v => x + radius < v.x - margin || x - radius > v.x + v.w + margin ||
    y + radius < v.y - margin || y - radius > v.y + v.h + margin);
}
