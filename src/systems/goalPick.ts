/** Pure goal selection (no Phaser). */
import type { PlaceSite, Vec2 } from '../core/types';

export interface PickOpts {
  min: number;
  max: number;
  /** Used for the first goal: distance window from the players' midpoint. */
  firstMin: number;
  firstMax: number;
  recentWords: string[];
}

const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Choose a place whose `front` lies in the distance window from `origin` (the previous goal, or the
 * players' midpoint for the first goal). Prefers words not used recently; relaxes distances when empty.
 * `rand` returns [0,1).
 */
export function pickGoal(
  places: readonly PlaceSite[], origin: Vec2, isFirst: boolean, opts: PickOpts, rand: () => number,
): PlaceSite | null {
  if (!places.length) return null;
  const lo = isFirst ? opts.firstMin : opts.min;
  const hi = isFirst ? opts.firstMax : opts.max;
  const recent = new Set(opts.recentWords);
  const d = places.map((p) => dist(p.front, origin));
  const idx = places.map((_, i) => i);
  const choose = (list: number[]) => places[list[Math.floor(rand() * list.length) % list.length]];

  const windows: [number, number][] = [[lo, hi], [lo * 0.6, hi * 1.3], [lo * 0.3, hi * 1.8], [1, Infinity]];
  const inWin = (a: number, b: number) => idx.filter((i) => d[i] >= a && d[i] <= b && d[i] > 1);
  for (const [a, b] of windows) {
    const fresh = inWin(a, b).filter((i) => !recent.has(places[i].word));
    if (fresh.length) return choose(fresh);
  }
  for (const [a, b] of windows) {
    const ok = inWin(a, b);
    if (ok.length) return choose(ok);
  }
  return choose(idx);
}

/** True if the segment a->b touches the circle (centre c, radius r): catches fast movers that skip the zone between frames. */
export function segmentHitsCircle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, r: number): boolean {
  const sx = bx - ax, sy = by - ay;
  const l2 = sx * sx + sy * sy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((cx - ax) * sx + (cy - ay) * sy) / l2));
  return Math.hypot(ax + sx * t - cx, ay + sy * t - cy) <= r;
}
