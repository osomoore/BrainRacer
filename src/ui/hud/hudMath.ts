/** Pure (Phaser-free) HUD math: time formatting, world<->screen mapping, arrow edge placement. */
import type { Rect, Vec2 } from '../../core/types';

/** mm:ss, rounding partial seconds up (so the clock hits 00:00 exactly at the end). Negative gives 00:00. */
export function formatTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec - 1e-9));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Map a world point into screen space, given the world rect visible in `mapRect` (a screen rect). */
export function worldToScreen(wx: number, wy: number, worldView: Rect, mapRect: Rect): Vec2 {
  const sx = mapRect.w / worldView.w;
  const sy = mapRect.h / worldView.h;
  return { x: mapRect.x + (wx - worldView.x) * sx, y: mapRect.y + (wy - worldView.y) * sy };
}

/** Screen pixels per world pixel for a world view mapped into a screen rect. */
export function viewZoom(worldView: Rect, mapRect: Rect): number {
  return mapRect.w / worldView.w;
}

export function insetRect(r: Rect, m: number): Rect {
  return { x: r.x + m, y: r.y + m, w: Math.max(0, r.w - 2 * m), h: Math.max(0, r.h - 2 * m) };
}

export function pointInRect(p: Vec2, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

/** True when a screen point is inside `rect` shrunk by `margin` on every side. */
export function isOnScreen(p: Vec2, rect: Rect, margin: number): boolean {
  return pointInRect(p, insetRect(rect, margin));
}

export interface EdgeArrow { x: number; y: number; angle: number }

/**
 * Where to draw a goal arrow: on the border of `rect` (inset by `margin`), on the ray from the
 * rect's center in the direction from `from` to `to` (screen coords). Angle in radians, 0 = +x.
 */
export function edgeArrow(rect: Rect, margin: number, from: Vec2, to: Vec2): EdgeArrow {
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  let dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) { dx = 1; dy = 0; } else { dx /= len; dy /= len; }
  const hw = Math.max(1, rect.w / 2 - margin), hh = Math.max(1, rect.h / 2 - margin);
  const tx = Math.abs(dx) < 1e-9 ? Infinity : hw / Math.abs(dx);
  const ty = Math.abs(dy) < 1e-9 ? Infinity : hh / Math.abs(dy);
  const t = Math.min(tx, ty);
  return { x: cx + dx * t, y: cy + dy * t, angle: Math.atan2(dy, dx) };
}

/** Distance in whole meters (32 px = 1 m). */
export function distanceMeters(ax: number, ay: number, bx: number, by: number, pxPerMeter = 32): number {
  return Math.round(Math.hypot(bx - ax, by - ay) / pxPerMeter);
}

export function easeOutBack(t: number, s = 1.70158): number {
  const c = Math.min(1, Math.max(0, t)) - 1;
  return 1 + (s + 1) * c * c * c + s * c * c;
}
export function easeInBack(t: number, s = 1.70158): number {
  const c = Math.min(1, Math.max(0, t));
  return (s + 1) * c * c * c - s * c * c;
}
export function easeInOut(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Largest uniform scale (<= maxScale) that fits w x h into maxW x maxH. */
export function fitScale(w: number, h: number, maxW: number, maxH: number, maxScale = Infinity): number {
  return Math.min(maxScale, maxW / w, maxH / h);
}

/**
 * Zone of a player's view that is free for the docked challenge panel: the view shrunk by `margin`,
 * minus the central scoreboard band (`clearHalf` px either side of screenCenterX).
 * A view that spans the screen center (single mode) uses its left part.
 */
export function dockZone(view: Rect, screenCenterX: number, clearHalf: number, margin: number): Rect {
  let left = view.x + margin;
  let right = view.x + view.w - margin;
  const cl = screenCenterX - clearHalf, cr = screenCenterX + clearHalf;
  if (left < cr && right > cl) {
    const viewMid = view.x + view.w / 2;
    if (viewMid <= screenCenterX + 1) right = Math.min(right, cl);
    else left = Math.max(left, cr);
  }
  return { x: left, y: view.y + margin, w: Math.max(0, right - left), h: Math.max(0, view.h - 2 * margin) };
}

/** Exponential smoothing factor for frame-rate independent lerps. */
export function smoothFactor(dtSec: number, rate = 10): number {
  return 1 - Math.exp(-dtSec * rate);
}
