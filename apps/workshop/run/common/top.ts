/**
 * Run scene kit: top-view stage (fixed camera, everything in screen coordinates of the run area).
 *
 *   const S = new TopStage(ctx, { carMaxLateral: 120 });   // scales the car so it is <= 120 px wide sideways
 *   S.bg((g, w, h) => { ... draw road/props into the one big ground texture ... });
 *   S.setPose({ x, y, a });                                  // car position + heading (rig faces +x at angle 0)
 *   await S.driveAlong(path, 0, path.length, 3000);          // follow a RoundedPath
 *   S.put('mid', T.hayTop(), x, y, scale, rotation)          // props: layers back < mid (car) < front
 * `S.cs` is the car scale (rig size in pixels = rig.width * S.cs).
 */
import type Phaser from 'phaser';
import { Fx, along } from './fx';
import { type Ctx2D, bakeTemp, circ, darken, fl, hashKey, prop, spec } from './draw';
import type { PathPose, RoundedPath } from './path';
import type { StageContext } from '../types';

export type TopLayer = 'back' | 'mid' | 'front';

export { T } from './props';

export interface TopOpts {
  /** The car is scaled down so its sideways size is at most this many px (and never above the base scale). */
  carMaxLateral: number;
  baseScale?: number;
}

export class TopStage {
  readonly scene: Phaser.Scene;
  readonly w: number;
  readonly h: number;
  readonly fx: Fx;
  readonly layers: Record<TopLayer, Phaser.GameObjects.Container>;
  readonly car: Phaser.GameObjects.Container;
  /** Car scale. */
  readonly cs: number;
  /** Car size on screen (length, sideways) after scaling. */
  readonly carLen: number;
  readonly carWid: number;

  constructor(readonly ctx: StageContext, opts: TopOpts) {
    this.scene = ctx.scene;
    this.w = ctx.size.w; this.h = ctx.size.h;
    const sc = this.scene;
    this.layers = { back: sc.add.container(0, 0), mid: sc.add.container(0, 0), front: sc.add.container(0, 0) };
    ctx.layer.add([this.layers.back, this.layers.mid, this.layers.front]);
    this.car = ctx.rig.root;
    this.layers.mid.add(this.car);
    const rig = ctx.rig;
    this.cs = Math.min(opts.baseScale ?? 0.7, opts.carMaxLateral / Math.max(rig.height, 1));
    this.car.setScale(this.cs);
    this.carLen = rig.width * this.cs;
    this.carWid = rig.height * this.cs;
    this.fx = new Fx(ctx);
  }

  /** Bake the whole ground (grass + whatever `draw` adds) into one texture and show it. */
  bg(draw: (g: Ctx2D, w: number, h: number) => void, grass: [string, string] = ['#6fd065', '#63c75a']): void {
    const { w, h } = this;
    const key = bakeTemp(this.scene, this.layers.back, w, h, (g) => {
      g.fillStyle = grass[0]; g.fillRect(0, 0, w, h);
      g.fillStyle = grass[1];
      for (let y = 0; y < h; y += 120) g.fillRect(0, y, w, 60);
      for (let i = 0; i < 70; i++) { const x = (i * 337) % w, y = (i * 211) % h; fl(g, darken(grass[0], 0.1), circ(x, y, 6 + (i % 4) * 2)); }
      draw(g, w, h);
    }, `top:${this.ctx.workshop}:${hashKey(JSON.stringify(this.ctx.stage) + grass.join() + String(draw))}`);
    const img = this.scene.add.image(0, 0, key).setOrigin(0, 0);
    this.layers.back.add(img);
  }

  put(layer: TopLayer, s: ReturnType<typeof spec>, x: number, y: number, scale = 1, rot = 0): Phaser.GameObjects.Image {
    const im = prop(this.scene, this.layers[layer], s, x, y, scale);
    im.setRotation(rot);
    return im;
  }

  setPose(p: PathPose, extra = 0): void { this.car.setPosition(p.x, p.y).setRotation(p.a + extra); }

  /** Drive along a path between distances a..b. */
  async driveAlong(path: RoundedPath, a: number, b: number, ms: number, ease = 'Sine.easeInOut', onTick?: (d: number, p: PathPose) => void): Promise<void> {
    this.ctx.rig.play('drive');
    await along(this.ctx, ms, (t) => { const d = a + (b - a) * t; const p = path.at(d); this.setPose(p); onTick?.(d, p); }, ease);
  }

  async cheer(ms = 800): Promise<void> {
    this.ctx.rig.play('celebrate');
    this.ctx.audio.sfx('cheer', { volume: 0.7 });
    this.fx.burst(this.layers.front, 'sparkle', this.car.x, this.car.y - 20);
    this.ctx.audio.sfx('sparkle');
    await this.ctx.wait(ms);
  }
}
