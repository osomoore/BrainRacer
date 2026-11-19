/**
 * Split-screen / merged camera rig (package H). Implements ICameraRig.
 *
 *  - 1 target  → 'single': main camera full screen, look-ahead + speed/turbo zoom-out.
 *  - 2 targets → 'merged' (one full-screen camera framing both) or 'split' (left half = P0,
 *    right half = P1), switched with hysteresis on the zoom needed to fit both cars.
 *  - Transition: the viewports animate (main 1920→960 wide, second camera grows from the right
 *    edge) while each camera's center lerps from the screen-consistent merged framing to its
 *    own car, so the first frame of a split is identical to the merged view (and vice versa).
 *
 * All math lives in ./cameraMath (pure, unit-tested).
 */
import Phaser from 'phaser';
import { CAMERA, GAME_HEIGHT, GAME_WIDTH } from '../config/gameConfig';
import type { EventBus } from '../core/events';
import type { ICameraRig } from '../core/race';
import type { CameraLayout, CameraMode, PlayerId, Rect, Vec2 } from '../core/types';
import {
  SplitController, clampCenter, clampLookToSlack, fitZoom, lerp, lerpVec, lookTarget, playerViewsFor,
  screenConsistentCenter, shakeFalloff, smoothFactor, speedZoomOut, splitViewports, worldRect,
  type CameraTuning,
} from './cameraMath';

/** Anything the camera can follow (IPlayerCar satisfies this). */
export interface CameraTarget {
  readonly x: number;
  readonly y: number;
  readonly velocity: Vec2;
  readonly turbo?: boolean;
}

export interface CameraRigOptions {
  targets: CameraTarget[];
  worldBounds: Rect;
  bus: EventBus;
  /** Override tunables (defaults: CAMERA from gameConfig). */
  tuning?: Partial<CameraTuning>;
}

interface CamState { center: Vec2; zoom: number; viewport: Rect; visible: boolean }

const W = GAME_WIDTH, H = GAME_HEIGHT;
const FULL: Rect = { x: 0, y: 0, w: W, h: H };

export class CameraRig implements ICameraRig {
  readonly cfg: CameraTuning;
  private readonly scene: Phaser.Scene;
  private readonly targets: CameraTarget[];
  private readonly bounds: Rect;
  private readonly bus: EventBus;
  private readonly main: Phaser.Cameras.Scene2D.Camera;
  private readonly second: Phaser.Cameras.Scene2D.Camera | null = null;
  private readonly ctrl: SplitController;
  private readonly look: Vec2[];
  private readonly zoomOut: number[];
  private readonly views: Rect[];
  private readonly cams: CamState[];
  private lastMode: CameraMode | null = null;
  private destroyed = false;

  /** Debug/diagnostic: zoom needed to fit both cars in one view (1 player: baseZoom). */
  neededZoom: number;

  constructor(scene: Phaser.Scene, opts: CameraRigOptions) {
    if (opts.targets.length < 1 || opts.targets.length > 2) throw new Error('CameraRig needs 1 or 2 targets');
    this.scene = scene;
    this.cfg = { ...CAMERA, ...opts.tuning };
    this.targets = opts.targets;
    this.bounds = opts.worldBounds;
    this.bus = opts.bus;
    this.main = scene.cameras.main;
    this.main.setRoundPixels(true);
    if (this.targets.length === 2) {
      this.second = scene.cameras.add(W, 0, 1, H, false, 'p1');
      this.second.setRoundPixels(true);
      this.second.setVisible(false);
    }
    this.look = this.targets.map(() => ({ x: 0, y: 0 }));
    this.zoomOut = this.targets.map(() => 0);
    this.views = playerViewsFor(this.targets.length, W, H);
    this.cams = [0, 1].map(() => ({ center: { x: 0, y: 0 }, zoom: this.cfg.baseZoom, viewport: { ...FULL }, visible: false }));
    this.ctrl = new SplitController(this.targets.length, this.cfg);
    this.neededZoom = this.computeNeeded();
    this.ctrl.reset(this.neededZoom);
    this.update(0);
  }

  // ───────────── ICameraRig ─────────────

  layout(): CameraLayout {
    return { mode: this.ctrl.mode, playerViews: this.views.map((r) => ({ ...r })) };
  }

  worldView(player: PlayerId): Rect {
    const c = this.cams[this.camIndexFor(player)];
    return worldRect(c.center, c.viewport.w, c.viewport.h, c.zoom);
  }

  shake(player: PlayerId | null, intensity: number, ms: number): void {
    const idx = player === null ? this.visibleCamIndices() : [this.camIndexFor(player)];
    for (const i of new Set(idx)) this.shakeCam(i, intensity, ms);
  }

  shakeAt(x: number, y: number, radius: number, intensity: number, ms: number): void {
    for (const i of this.visibleCamIndices()) {
      const c = this.cams[i].center;
      const k = shakeFalloff(Math.hypot(x - c.x, y - c.y), radius);
      if (k > 0) this.shakeCam(i, intensity * k, ms);
    }
  }

  // ───────────── per frame ─────────────

  update(dtSec: number): void {
    if (this.destroyed) return;
    const cfg = this.cfg;
    const kLook = smoothFactor(cfg.lookSmoothing, dtSec);
    const kZoom = smoothFactor(cfg.zoomSmoothing, dtSec);
    const pos = this.targets.map((t) => ({ x: t.x, y: t.y }));
    this.targets.forEach((t, i) => {
      const lt = lookTarget(t.velocity, cfg);
      this.look[i].x += (lt.x - this.look[i].x) * kLook;
      this.look[i].y += (lt.y - this.look[i].y) * kLook;
      const zt = speedZoomOut(Math.hypot(t.velocity.x, t.velocity.y), !!t.turbo, cfg);
      this.zoomOut[i] += (zt - this.zoomOut[i]) * kZoom;
    });

    if (this.targets.length === 1) {
      const zoom = cfg.baseZoom - this.zoomOut[0];
      const c = clampCenter(add(pos[0], this.look[0]), W, H, zoom, this.bounds);
      this.setCam(0, FULL, c, zoom);
      this.emitIfChanged();
      return;
    }

    this.neededZoom = this.computeNeeded();
    this.ctrl.step(this.neededZoom, dtSec);

    // merged framing (also the start/end framing of every transition)
    const mergedZoom = Math.min(cfg.baseZoom - Math.max(this.zoomOut[0], this.zoomOut[1]), this.neededZoom);
    const mid = lerpVec(pos[0], pos[1], 0.5);
    const avgLook = lerpVec(this.look[0], this.look[1], 0.5);
    const mLook = clampLookToSlack(avgLook, pos[0], pos[1], cfg.mergePadding, mergedZoom, W, H);
    const mergedCenter = clampCenter(add(mid, mLook), W, H, mergedZoom, this.bounds);

    const e = this.ctrl.eased;
    if (e <= 0) {
      this.setCam(0, FULL, mergedCenter, mergedZoom);
      this.hideSecond();
    } else {
      const vp = splitViewports(e, W, H);
      const vps = [vp.main, vp.second];
      for (const i of [0, 1]) {
        const ownZoom = cfg.splitZoom - this.zoomOut[i];
        const own = clampCenter(add(pos[i], this.look[i]), W / 2, H, ownZoom, this.bounds);
        const start = screenConsistentCenter(mergedCenter, vps[i], mergedZoom, W, H);
        const zoom = lerp(mergedZoom, ownZoom, e);
        const center = clampCenter(lerpVec(start, own, e), vps[i].w, vps[i].h, zoom, this.bounds);
        if (vps[i].w >= 1) this.setCam(i, vps[i], center, zoom);
        else if (i === 1) this.hideSecond();
      }
    }
    this.emitIfChanged();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.second) this.scene.cameras?.remove(this.second, true);
    if (this.main.scene) this.main.setViewport(0, 0, W, H).setZoom(1);
  }

  // ───────────── debug getters (CameraTest) ─────────────

  get mode(): CameraMode { return this.ctrl.mode; }
  /** 0 = merged … 1 = split (eased). */
  get splitAmount(): number { return this.ctrl.eased; }
  camZoom(i: 0 | 1): number { return this.cams[i].zoom; }
  camVisible(i: 0 | 1): boolean { return this.cams[i].visible; }

  // ───────────── internals ─────────────

  private computeNeeded(): number {
    if (this.targets.length < 2) return this.cfg.baseZoom;
    const [a, b] = this.targets;
    return fitZoom(a, b, this.cfg.mergePadding, W, H, this.cfg.baseZoom);
  }

  /** Index of the camera currently showing `player` (0 = main). */
  private camIndexFor(player: PlayerId): 0 | 1 {
    if (player === 1 && this.second && this.ctrl.eased >= 0.5) return 1;
    return 0;
  }

  private visibleCamIndices(): (0 | 1)[] {
    return this.cams[1].visible ? [0, 1] : [0];
  }

  private camera(i: number): Phaser.Cameras.Scene2D.Camera | null {
    return i === 0 ? this.main : this.second;
  }

  private shakeCam(i: number, intensity: number, ms: number): void {
    const cam = this.camera(i);
    if (!cam || intensity <= 0 || ms <= 0) return;
    const fx = cam.shakeEffect;
    // never let a weak shake cancel a stronger one already running
    if (fx.isRunning && fx.intensity.x >= intensity) return;
    cam.shake(ms, intensity, true);
  }

  private setCam(i: number, vp: Rect, center: Vec2, zoom: number): void {
    const cam = this.camera(i);
    const s = this.cams[i];
    s.center = center; s.zoom = zoom; s.viewport = { ...vp }; s.visible = true;
    if (!cam) return;
    if (cam.x !== vp.x || cam.y !== vp.y || cam.width !== vp.w || cam.height !== vp.h) cam.setViewport(vp.x, vp.y, vp.w, vp.h);
    cam.setVisible(true);
    cam.setZoom(zoom);
    cam.centerOn(center.x, center.y);
  }

  private hideSecond(): void {
    this.cams[1].visible = false;
    this.cams[1].viewport = { x: W, y: 0, w: 0, h: H };
    this.second?.setVisible(false);
  }

  private emitIfChanged(): void {
    const mode = this.ctrl.mode;
    if (mode === this.lastMode) return;
    this.lastMode = mode;
    this.bus.emit('camera:layout', { layout: this.layout() });
  }
}

const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
