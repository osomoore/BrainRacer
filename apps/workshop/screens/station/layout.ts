/** Pure station-screen layout and helpers (no Phaser): bands, swatch strip window, camera target maths. */
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
  strip: { bandY: number; y: number; swatch: number; visible: number; xs: number[]; arrowL: number; arrowR: number; arrowW: number };
  /** Where the zoomed part should sit on screen. */
  stage: { cx: number; cy: number };
}

export function stationLayout(kind: LayoutKind): StationLayout {
  const size = paneSize(kind);
  const sw = WS_ROOM.swatchSize[kind];
  const visible = WS_ROOM.swatchVisible[kind];
  const gap = kind === 'wide' ? 40 : 25;
  const xs = Array.from({ length: visible }, (_, i) => size.w / 2 + (i - (visible - 1) / 2) * (sw + gap));
  if (kind === 'wide') {
    return {
      size, topBandH: 250,
      aspect: { x: size.w / 2, y: 68, size: 72 },
      name: { x: size.w / 2, y: 160, size: 88, maxW: 1000 },
      back: { x: 175, y: 115, w: 240, h: 130 },
      use: { x: size.w - 230, y: 115, w: 380, h: 130 },
      strip: { bandY: 790, y: 935, swatch: sw, visible, xs, arrowL: 100, arrowR: size.w - 100, arrowW: 130 },
      stage: { cx: size.w / 2, cy: 505 },
    };
  }
  return {
    size, topBandH: 285,
    aspect: { x: 570, y: 75, size: 64 },
    name: { x: size.w / 2, y: 190, size: 76, maxW: 880 },
    back: { x: 130, y: 75, w: 200, h: 120 },
    use: { x: size.w / 2, y: 1005, w: 560, h: 120 },
    strip: { bandY: 700, y: 810, swatch: sw, visible, xs, arrowL: 60, arrowR: size.w - 60, arrowW: 120 },
    stage: { cx: size.w / 2, cy: 490 },
  };
}

/** First visible index of the swatch window so that `index` is inside it (centered when possible). */
export function windowStart(count: number, index: number, visible: number): number {
  const maxStart = Math.max(0, count - visible);
  return Math.min(maxStart, Math.max(0, index - Math.floor(visible / 2)));
}

/** Slot x positions when fewer swatches than slots exist: the row stays centered. */
export function stripXs(xs: readonly number[], count: number): number[] {
  if (count >= xs.length || xs.length < 2) return [...xs];
  const step = xs[1] - xs[0];
  const mid = (xs[0] + xs[xs.length - 1]) / 2;
  return Array.from({ length: count }, (_, i) => mid + (i - (count - 1) / 2) * step);
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
