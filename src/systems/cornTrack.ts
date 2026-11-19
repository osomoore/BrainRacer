/** Pure helpers for the farm corn / mud driving effects (Phaser-free). */
import { FARM_CORN } from '../config/gameConfig';
import { Tile, type Rect } from '../core/types';

export type Surface = 'none' | 'corn' | 'mud';

export function surfaceOfTile(t: number): Surface {
  return t === Tile.Corn ? 'corn' : t === Tile.Mud ? 'mud' : 'none';
}

export function speedMultFor(s: Surface): number {
  return s === 'corn' ? FARM_CORN.cornSpeedMult : s === 'mud' ? FARM_CORN.mudSpeedMult : 1;
}

export function dragFor(s: Surface): number {
  return s === 'corn' ? FARM_CORN.cornDrag : s === 'mud' ? FARM_CORN.mudDrag : 0;
}

/** True when the car has travelled at least `spacing` px since the last stamp. */
export function needsStamp(lastX: number, lastY: number, x: number, y: number, spacing = FARM_CORN.stampSpacing): boolean {
  return Math.hypot(x - lastX, y - lastY) >= spacing;
}

/** A stamp is visible if its (radius-padded) box touches any view rect grown by `margin`. */
export function insideAnyView(x: number, y: number, views: Rect[], margin = FARM_CORN.viewMargin, radius = 48): boolean {
  const m = margin + radius;
  for (const v of views) {
    if (x >= v.x - m && x <= v.x + v.w + m && y >= v.y - m && y <= v.y + v.h + m) return true;
  }
  return false;
}

/** Corn springs back when off every view or too old. */
export function shouldSpringBack(x: number, y: number, ageSec: number, views: Rect[], margin = FARM_CORN.viewMargin, life = FARM_CORN.stampLifeSec): boolean {
  return ageSec > life || !insideAnyView(x, y, views, margin);
}
