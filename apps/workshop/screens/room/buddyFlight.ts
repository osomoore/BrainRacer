/** Pure (Phaser-free) buddy flight maths for the room: a gently looping curved path with the buddy angled along it. */
import { WS_BUDDIES } from '../../config';

export interface FlightPoint { x: number; y: number }
export interface FlightOpts {
  /** +1 / -1: which side the arc bulges to. */
  side: 1 | -1;
  startAngle: number;
  startFlipX: boolean;
  endAngle: number;
  endFlipX: boolean;
}
export interface FlightPose { x: number; y: number; angle: number; flipX: boolean }

const DEG = 180 / Math.PI;

/** Tilt (degrees, sprite faces +x; mirrored when `flipX`) that makes the buddy point from `from` at `target`, clamped for kids' readability. */
export function pointAngle(from: FlightPoint, target: FlightPoint, flipX: boolean): number {
  return tilt(target.x - from.x, target.y - from.y, flipX);
}

function tilt(dx: number, dy: number, flipX: boolean): number {
  const a = Math.atan2(dy, flipX ? -dx : dx) * DEG;
  const c = WS_BUDDIES.fly.maxTiltDeg;
  return Math.max(-c, Math.min(c, flipX ? -a : a));
}

/** Whether the buddy faces left when pointing at `target` from `from` (keeps `current` when almost straight above/below). */
export function facesLeft(from: FlightPoint, target: FlightPoint, current: boolean): boolean {
  const dx = target.x - from.x;
  return Math.abs(dx) < WS_BUDDIES.fly.flipDeadPx ? current : dx < 0;
}

function offset(p: FlightPoint, heading: number, distance: number): FlightPoint {
  return { x: p.x + Math.cos(heading) * distance, y: p.y + Math.sin(heading) * distance };
}

/** Two joined B?zier arcs let the buddy swing away and turn back when either perch faces away from the route. */
export function flightPose(a: FlightPoint, b: FlightPoint, t: number, o: FlightOpts): FlightPose {
  if (t <= 0) return { ...a, angle: o.startAngle, flipX: o.startFlipX };
  if (t >= 1) return { ...b, angle: o.endAngle, flipX: o.endFlipX };
  const f = WS_BUDDIES.fly;
  const dx = b.x - a.x, dy = b.y - a.y;
  const distance = Math.hypot(dx, dy);
  const start = o.startAngle / DEG + (o.startFlipX ? Math.PI : 0);
  const end = o.endAngle / DEG + (o.endFlipX ? Math.PI : 0);
  const course = distance < 1 ? start : Math.atan2(dy, dx);
  const handle = Math.min(f.maxOffsetPx, Math.max(f.minTurnPx, distance * f.arc));
  const middle = offset({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, course + o.side * Math.PI / 2, handle);
  const [p0, p1, p2, p3] = t < 0.5
    ? [a, offset(a, start, handle), offset(middle, course, -handle / 2), middle]
    : [middle, offset(middle, course, handle / 2), offset(b, end, -handle), b];
  const u = t < 0.5 ? t * 2 : t * 2 - 1;
  const v = 1 - u;
  const x = v ** 3 * p0.x + 3 * v * v * u * p1.x + 3 * v * u * u * p2.x + u ** 3 * p3.x;
  const y = v ** 3 * p0.y + 3 * v * v * u * p1.y + 3 * v * u * u * p2.y + u ** 3 * p3.y;
  const vx = v * v * (p1.x - p0.x) + 2 * v * u * (p2.x - p1.x) + u * u * (p3.x - p2.x);
  const vy = v * v * (p1.y - p0.y) + 2 * v * u * (p2.y - p1.y) + u * u * (p3.y - p2.y);
  const flipX = vx < 0;
  return { x, y, angle: Math.atan2(flipX ? -vy : vy, Math.abs(vx)) * DEG, flipX };
}

export interface PerchRect { x: number; y: number; w: number; h: number }

const overlapArea = (a: PerchRect, b: PerchRect): number => {
  const w = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2);
  const h = Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2);
  return w > 0 && h > 0 ? w * h : 0;
};

/**
 * Where the buddy (a `size` square, centre-anchored) hovers to point at `tile`: just outside the tile's bounds (label included)
 * on a side with room inside the pane, preferring the side facing the pane centre and spots clear of `others`.
 * The result never overlaps `tile` and stays inside the pane whenever any side has room.
 */
export function perchFor(tile: PerchRect, pane: { w: number; h: number }, size: number, others: readonly PerchRect[] = []): FlightPoint {
  const gap = WS_BUDDIES.fly.perchGapPx;
  const half = size / 2;
  const dx = tile.w / 2 + half + gap, dy = tile.h / 2 + half + gap;
  const inward = tile.x < pane.w / 2 ? 1 : -1;
  const vertical = tile.y < pane.h / 2 ? 1 : -1;
  const clampX = (x: number) => Math.min(pane.w - half, Math.max(half, x));
  const clampY = (y: number) => Math.min(pane.h - half, Math.max(half, y));
  const candidates: FlightPoint[] = [
    { x: tile.x + inward * dx, y: clampY(tile.y) },
    { x: clampX(tile.x), y: tile.y + vertical * dy },
    { x: clampX(tile.x), y: tile.y - vertical * dy },
    { x: tile.x - inward * dx, y: clampY(tile.y) },
  ];
  let best = candidates[0]!, bestScore = Infinity;
  candidates.forEach((c, i) => {
    const box = { x: c.x, y: c.y, w: size, h: size };
    const outside = c.x - half >= -0.5 && c.x + half <= pane.w + 0.5 && c.y - half >= -0.5 && c.y + half <= pane.h + 0.5;
    const hitsTile = overlapArea(box, tile) > 0;
    const clutter = others.reduce((sum, o) => sum + (o === tile ? 0 : overlapArea(box, o)), 0);
    const score = (hitsTile ? 1e12 : 0) + (outside ? 0 : 1e9) + clutter + i;
    if (score < bestScore) { bestScore = score; best = c; }
  });
  return best;
}
