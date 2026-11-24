/** Pure station-screen layout and helpers (no Phaser): bands, swatch strip scroll, camera target maths. */
import { WS_ROOM } from '../../config';
import type { Model, VariantId } from '../../core/types';
import { paneSize, type LayoutKind } from '../room/layout';

export interface StationLayout {
  size: { w: number; h: number };
  topBandH: number;
  aspect: { x: number; y: number; size: number };
  name: { x: number; y: number; size: number; maxW: number };
  back: { x: number; y: number; w: number; h: number };
  use: { x: number; y: number; w: number; h: number };
  /** `inset` is the edge width reserved for overlaid arrows (0 when they sit elsewhere); the strip window is `[inset, size.w - inset]`. */
  strip: { bandY: number; y: number; swatch: number; gap: number; inset: number; arrowY: number; arrowL: number; arrowR: number; arrowW: number; arrowH: number };
  /** Where the zoomed part should sit on screen. */
  stage: { cx: number; cy: number };
}

export function stationLayout(kind: LayoutKind): StationLayout {
  const size = paneSize(kind);
  const sw = WS_ROOM.swatchSize[kind];
  const gap = WS_ROOM.swatchGap[kind];
  if (kind === 'wide') {
    return {
      size, topBandH: 250,
      aspect: { x: size.w / 2, y: 68, size: 72 },
      name: { x: size.w / 2, y: 160, size: 88, maxW: 1000 },
      back: { x: 420, y: 115, w: 240, h: 130 },
      use: { x: size.w - 230, y: 115, w: 380, h: 130 },
      strip: { bandY: 790, y: 935, swatch: sw, gap, inset: 130, arrowY: 935, arrowL: 65, arrowR: size.w - 65, arrowW: 130, arrowH: 150 },
      stage: { cx: size.w / 2, cy: 505 },
    };
  }
  return {
    size, topBandH: 285,
    aspect: { x: 770, y: 75, size: 64 },
    name: { x: size.w / 2, y: 190, size: 76, maxW: 880 },
    back: { x: 130, y: 75, w: 200, h: 120 },
    use: { x: size.w / 2, y: 1005, w: 560, h: 120 },
    strip: { bandY: 700, y: 810, swatch: sw, gap, inset: 0, arrowY: 1005, arrowL: 70, arrowR: size.w - 70, arrowW: 120, arrowH: 120 },
    stage: { cx: size.w / 2, cy: 490 },
  };
}

export interface StripGeom { count: number; swatch: number; gap: number; windowW: number; peek: number }

/** Total width of the swatch row (edge padding equals the gap). */
export function stripContentW(g: StripGeom): number { return 2 * g.gap + g.count * g.swatch + Math.max(0, g.count - 1) * g.gap; }

/** Left edge of swatch `i` in content coordinates. */
export function swatchLeft(g: StripGeom, i: number): number { return g.gap + i * (g.swatch + g.gap); }

/**
 * Scroll offset of the row (content x shown at the window's left edge) after selecting `index`. Scrolls as little as
 * needed from `current` so the selected swatch is fully visible with `peek` of a neighbour beyond it (when one exists).
 * A row that fits the window is centered (negative offset).
 */
export function stripOffset(g: StripGeom, index: number, current: number): number {
  const total = stripContentW(g);
  if (total <= g.windowW) return -(g.windowW - total) / 2;
  const m = g.gap + g.peek * g.swatch;
  const lo = index > 0 ? swatchLeft(g, index) - m : 0;
  const hi = index < g.count - 1 ? swatchLeft(g, index) + g.swatch + m : total;
  const next = Math.min(Math.max(current, hi - g.windowW), lo);
  return Math.min(Math.max(0, next), total - g.windowW);
}

export function clampIndex(i: number, count: number): number { return Math.min(Math.max(0, i), Math.max(0, count - 1)); }

/** Model with one aspect changed. */
export function withVariant(model: Model, aspect: string, variant: VariantId): Model { return { ...model, [aspect]: variant }; }

/**
 * Camera maths for the zoom: the world (room backdrop + model) is scaled by `scale` about the origin and moved so the
 * focus point (in world coordinates) lands on `stage`.
 */
export function cameraTarget(focus: { x: number; y: number }, zoom: number, stage: { cx: number; cy: number }, maxScale: number): { scale: number; x: number; y: number } {
  const scale = Math.min(Math.max(1, zoom), maxScale);
  return { scale, x: stage.cx - scale * focus.x, y: stage.cy - scale * focus.y };
}

/** Texture-cache key part that identifies the rest of the model (everything except the swatch's own aspect). */
export function modelKey(model: Model, aspect: string): string {
  return Object.keys(model).filter((k) => k !== aspect).sort().map((k) => model[k]).join('|');
}
