/**
 * Pure (Phaser-free) camera math for the split/merge rig (package H).
 * Screen coords are the 1920x1080 logical game space; world coords are pixels.
 */
import type { CameraMode, Rect, Vec2 } from '../core/types';

export interface CameraTuning extends FacingTuning {
  facingUp: boolean;
  facingSplitZoom: number;
  baseZoom: number;
  minMergedZoom: number;
  splitZoom: number;
  mergePadding: number;
  splitHysteresis: number;
  transitionSec: number;
  lookAheadSec: number;
  lookAheadMax: number;
  lookSmoothing: number;
  zoomSmoothing: number;
  speedZoomOut: number;
  speedZoomRef: number;
  turboZoomOut: number;
  /** Zoom of each 960x540 quadrant (3-4 players). */
  quadZoom: number;
  /** Fraction of quadrant height (from the top) where the car sits. */
  quadCarScreenY: number;
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const lerpVec = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
/** Smoothstep easing, 0→0, 1→1, zero slope at both ends (no pop at start/end of transitions). */
export const ease = (t: number): number => { const c = clamp(t, 0, 1); return c * c * (3 - 2 * c); };
/** Frame-rate independent exponential smoothing factor for a rate in 1/s. */
export const smoothFactor = (rate: number, dtSec: number): number => 1 - Math.exp(-rate * dtSec);

/**
 * Zoom needed so that both points plus `pad` on every side fit a `viewW`×`viewH` viewport
 * when centered on their midpoint. Capped at `maxZoom`.
 */
export function fitZoom(a: Vec2, b: Vec2, pad: number, viewW: number, viewH: number, maxZoom: number): number {
  const w = Math.abs(a.x - b.x) + 2 * pad;
  const h = Math.abs(a.y - b.y) + 2 * pad;
  return Math.min(maxZoom, viewW / w, viewH / h);
}

/** Hysteresis: split below minMergedZoom, re-merge only above minMergedZoom + splitHysteresis. */
export function nextSplit(split: boolean, neededZoom: number, cfg: Pick<CameraTuning, 'minMergedZoom' | 'splitHysteresis'>): boolean {
  if (!split && neededZoom < cfg.minMergedZoom) return true;
  if (split && neededZoom > cfg.minMergedZoom + cfg.splitHysteresis) return false;
  return split;
}

/** Zoom-out from speed and turbo, subtracted from a base zoom. */
export function speedZoomOut(speed: number, turbo: boolean, cfg: Pick<CameraTuning, 'speedZoomOut' | 'speedZoomRef' | 'turboZoomOut'>): number {
  return cfg.speedZoomOut * clamp(speed / cfg.speedZoomRef, 0, 1) + (turbo ? cfg.turboZoomOut : 0);
}

/** Target look-ahead offset for a velocity (capped length). */
export function lookTarget(vel: Vec2, cfg: Pick<CameraTuning, 'lookAheadSec' | 'lookAheadMax'>): Vec2 {
  let x = vel.x * cfg.lookAheadSec, y = vel.y * cfg.lookAheadSec;
  const len = Math.hypot(x, y);
  if (len > cfg.lookAheadMax) { x *= cfg.lookAheadMax / len; y *= cfg.lookAheadMax / len; }
  return { x, y };
}

/**
 * Clamp a merged-camera look-ahead offset so both cars (+pad) stay in view at `zoom`.
 * At the fit zoom there is no slack, so look-ahead fades out automatically.
 */
export function clampLookToSlack(look: Vec2, a: Vec2, b: Vec2, pad: number, zoom: number, viewW: number, viewH: number): Vec2 {
  const sx = Math.max(0, viewW / 2 / zoom - (Math.abs(a.x - b.x) / 2 + pad));
  const sy = Math.max(0, viewH / 2 / zoom - (Math.abs(a.y - b.y) / 2 + pad));
  return { x: clamp(look.x, -sx, sx), y: clamp(look.y, -sy, sy) };
}

/** Keep a camera center such that its world view stays inside `bounds` (centered if the view is larger). */
export function clampCenter(c: Vec2, viewW: number, viewH: number, zoom: number, bounds: Rect): Vec2 {
  const hw = viewW / 2 / zoom, hh = viewH / 2 / zoom;
  const x = hw * 2 >= bounds.w ? bounds.x + bounds.w / 2 : clamp(c.x, bounds.x + hw, bounds.x + bounds.w - hw);
  const y = hh * 2 >= bounds.h ? bounds.y + bounds.h / 2 : clamp(c.y, bounds.y + hh, bounds.y + bounds.h - hh);
  return { x, y };
}

/** World rect visible through a viewport of size viewW×viewH centered on `c` at `zoom`. */
export function worldRect(c: Vec2, viewW: number, viewH: number, zoom: number): Rect {
  const w = viewW / zoom, h = viewH / zoom;
  return { x: c.x - w / 2, y: c.y - h / 2, w, h };
}

/**
 * Viewports for split amount `e` (0 = merged, 1 = split, already eased). Main (P0) shrinks
 * from the full screen to the left half; the second camera (P1) grows from the right edge.
 * Widths are integers and the two rects always abut exactly (no gap, no overlap).
 */
export function splitViewports(e: number, screenW: number, screenH: number): { main: Rect; second: Rect } {
  const w1 = Math.round(lerp(screenW, screenW / 2, clamp(e, 0, 1)));
  return {
    main: { x: 0, y: 0, w: w1, h: screenH },
    second: { x: w1, y: 0, w: screenW - w1, h: screenH },
  };
}

/**
 * Center for a camera with `viewport` that renders exactly the same world→screen mapping as a
 * full-screen camera centered on `mergedCenter` at `zoom`. Used as the transition start so the
 * first frame of a split is pixel-identical to the merged view.
 */
export function screenConsistentCenter(mergedCenter: Vec2, viewport: Rect, zoom: number, screenW: number, screenH: number): Vec2 {
  return {
    x: mergedCenter.x + (viewport.x + viewport.w / 2 - screenW / 2) / zoom,
    y: mergedCenter.y + (viewport.y + viewport.h / 2 - screenH / 2) / zoom,
  };
}

/** Shake strength multiplier for a camera centered `dist` px from the event: 1 at center, 0 at radius. */
export function shakeFalloff(dist: number, radius: number): number {
  return radius <= 0 ? 0 : clamp(1 - dist / radius, 0, 1);
}

/** True when `count` players use the fixed 2x2 quadrant layout (3 or 4 players). */
export const isQuadCount = (count: number): boolean => count >= 3;

/** The four quadrant rects: P1 top-left, P2 top-right, P3 bottom-left, P4 bottom-right (integers, abutting). */
export function quadrantRects(screenW: number, screenH: number): Rect[] {
  const w0 = Math.floor(screenW / 2), h0 = Math.floor(screenH / 2);
  return [
    { x: 0, y: 0, w: w0, h: h0 },
    { x: w0, y: 0, w: screenW - w0, h: h0 },
    { x: 0, y: h0, w: w0, h: screenH - h0 },
    { x: w0, y: h0, w: screenW - w0, h: screenH - h0 },
  ];
}

/** Bottom-right quadrant when it is free for the HUD team panel (exactly 3 players), else null. */
export function teamPanelRect(count: number, screenW: number, screenH: number): Rect | null {
  return count === 3 ? quadrantRects(screenW, screenH)[3] : null;
}

/** Camera mode for a player count when the 1-2 player split/merge machine is not involved. */
export const modeForCount = (count: number): CameraMode => (count >= 3 ? 'quad' : count === 2 ? 'split' : 'single');

/** HUD player views: full screen for 1 player, left/right halves for 2, quadrants for 3-4 (stable in every mode). */
export function playerViewsFor(count: number, screenW: number, screenH: number): Rect[] {
  if (count <= 1) return [{ x: 0, y: 0, w: screenW, h: screenH }];
  if (count >= 3) return quadrantRects(screenW, screenH).slice(0, Math.min(4, count));
  return [
    { x: 0, y: 0, w: screenW / 2, h: screenH },
    { x: screenW / 2, y: 0, w: screenW / 2, h: screenH },
  ];
}

/**
 * Split/merge state machine with hysteresis and a timed transition.
 * `amount` goes 0 (merged) → 1 (split) linearly over transitionSec; use `eased` for rendering.
 * The reported mode is 'split' only once fully split (so the HUD divider only appears when the
 * boundary has settled at the screen center) and 'merged' as soon as a merge starts.
 */
export class SplitController {
  split = false;
  amount = 0;

  constructor(readonly players: number, private cfg: Pick<CameraTuning, 'minMergedZoom' | 'splitHysteresis' | 'transitionSec'>) {}

  /** Snap to the right state without animating (race start). */
  reset(neededZoom: number): void {
    this.split = this.players >= 2 && neededZoom < this.cfg.minMergedZoom;
    this.amount = this.split ? 1 : 0;
  }

  step(neededZoom: number, dtSec: number): void {
    if (this.players < 2) { this.split = false; this.amount = 0; return; }
    this.split = nextSplit(this.split, neededZoom, this.cfg);
    const target = this.split ? 1 : 0;
    const d = this.cfg.transitionSec > 0 ? dtSec / this.cfg.transitionSec : 1;
    this.amount = this.amount < target ? Math.min(target, this.amount + d) : Math.max(target, this.amount - d);
  }

  get eased(): number { return ease(this.amount); }
  get transitioning(): boolean { return this.amount > 0 && this.amount < 1; }

  get mode(): CameraMode {
    if (this.players < 2) return 'single';
    return this.split && this.amount >= 1 ? 'split' : 'merged';
  }
}

// ───────────── facing-up (car-relative, rotating) view ─────────────

export interface FacingTuning {
  /** Fraction of view height (from the top) where the car sits. */
  carScreenY: number;
  /** Time constant (s) of the view-angle follow. */
  rotTau: number;
  /** Cap on the view's angular speed (rad/s). */
  maxAngVel: number;
  /** Below this speed the view follows heading only (no velocity blend). */
  velBlendMinSpeed: number;
  /** 0..1 share of the (velocity dir - heading) difference the view follows while moving forward. */
  velBlend: number;
}

const TAU = Math.PI * 2;

/** Wrap an angle to (-PI, PI]. */
export function wrapAngle(a: number): number {
  const w = ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return w <= -Math.PI ? Math.PI : w;
}

/** Signed shortest rotation from `from` to `to`. */
export const shortestAngle = (from: number, to: number): number => wrapAngle(to - from);

/** Phaser camera rotation (radians) that makes a car with `heading` point UP the screen. */
export const cameraRotationFor = (heading: number): number => -Math.PI / 2 - heading;

/**
 * Heading the view should follow: the car heading, blended toward the velocity direction while
 * moving FORWARD fast (so a brief slide/spin does not whip the view). Reversing → pure heading.
 */
export function viewTargetHeading(heading: number, vel: Vec2, cfg: Pick<FacingTuning, 'velBlendMinSpeed' | 'velBlend'>): number {
  const speed = Math.hypot(vel.x, vel.y);
  if (speed < cfg.velBlendMinSpeed) return heading;
  const fwd = vel.x * Math.cos(heading) + vel.y * Math.sin(heading);
  if (fwd <= 0) return heading;
  return heading + shortestAngle(heading, Math.atan2(vel.y, vel.x)) * cfg.velBlend;
}

/** Shortest-angle exponential follow (time constant `tau`) with an angular-speed cap. */
export function followAngle(cur: number, target: number, dtSec: number, tau: number, maxRate: number): number {
  const diff = shortestAngle(cur, target);
  let step = diff * smoothFactor(1 / Math.max(tau, 1e-4), dtSec);
  const cap = maxRate * dtSec;
  step = clamp(step, -cap, cap);
  return wrapAngle(cur + step);
}

/** Camera center (world) so the car lands `carScreenY` of the way down the view, car pointing up. */
export function facingCenter(car: Vec2, viewHeading: number, viewH: number, zoom: number, carScreenY: number): Vec2 {
  const d = (carScreenY - 0.5) * viewH / zoom;
  return { x: car.x + Math.cos(viewHeading) * d, y: car.y + Math.sin(viewHeading) * d };
}

/** Exact world→screen for a camera centered on `center` with `zoom`, `rotation` (Phaser sign) and `viewport`. */
export function worldToScreenRot(p: Vec2, center: Vec2, zoom: number, rotation: number, viewport: Rect): Vec2 {
  const dx = p.x - center.x, dy = p.y - center.y;
  const c = Math.cos(rotation), s = Math.sin(rotation);
  return {
    x: viewport.x + viewport.w / 2 + (dx * c - dy * s) * zoom,
    y: viewport.y + viewport.h / 2 + (dx * s + dy * c) * zoom,
  };
}

/** Axis-aligned world bounding box of a (possibly rotated) camera view. */
export function rotatedWorldAabb(center: Vec2, viewW: number, viewH: number, zoom: number, rotation: number): Rect {
  const hw = viewW / 2 / zoom, hh = viewH / 2 / zoom;
  const c = Math.abs(Math.cos(rotation)), s = Math.abs(Math.sin(rotation));
  const ex = c * hw + s * hh, ey = s * hw + c * hh;
  return { x: center.x - ex, y: center.y - ey, w: ex * 2, h: ey * 2 };
}
