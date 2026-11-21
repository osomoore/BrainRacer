import type { Vec2 } from '../core/types';

export interface GateTiming {
  openSec: number;
  warningSec: number;
  closedSec: number;
}

export interface GateCycle {
  mode: 'open' | 'warning' | 'closed';
  elapsed: number;
}

/** A busy crossing keeps its warning active until the entire gate has cleared. */
export function advanceGate(cycle: GateCycle, dt: number, timing: GateTiming, occupied: () => boolean): GateCycle {
  const elapsed = cycle.elapsed + dt;
  if (cycle.mode === 'open' && elapsed >= timing.openSec) return { mode: 'warning', elapsed: 0 };
  if (cycle.mode === 'warning' && elapsed >= timing.warningSec) {
    return occupied() ? { mode: 'warning', elapsed: timing.warningSec } : { mode: 'closed', elapsed: 0 };
  }
  if (cycle.mode === 'closed' && elapsed >= timing.closedSec) return { mode: 'open', elapsed: 0 };
  return { mode: cycle.mode, elapsed };
}

export interface OrientedArea extends Vec2 {
  angle: number;
  depth: number;
  span: number;
}

/** Circle/rectangle overlap with a world-space center and travel heading. */
export function overlapsGate(area: OrientedArea, point: Vec2, radius: number): boolean {
  const dx = point.x - area.x, dy = point.y - area.y;
  const cos = Math.cos(area.angle), sin = Math.sin(area.angle);
  const u = Math.max(0, Math.abs(dx * cos + dy * sin) - area.depth / 2);
  const v = Math.max(0, Math.abs(dy * cos - dx * sin) - area.span / 2);
  return Math.hypot(u, v) <= radius;
}

/** Normalized position of a shuttle that slows down to reverse at either end. */
export function shuttlePosition(clock: number, period: number): number {
  return -Math.cos(clock * 2 * Math.PI / period);
}
