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
import Phaser from 'phaser';
import { Fx, along } from './fx';
import { type Ctx2D, PAL, bakeTemp, circ, darken, fl, hashKey, line, ol, poly, prop, rr, spec } from './draw';
import type { PathPose, RoundedPath } from './path';
import type { StageContext } from '../types';

export type TopLayer = 'back' | 'mid' | 'front';

/** Top-view props (origin centre). */
export const T = {
  hayTop: () => spec('t:hay', 130, 84, (g) => { ol(g, PAL.hay, rr(6, 6, 118, 72, 16)); line(g, 44, 8, 44, 76, 4, PAL.hayDark); line(g, 86, 8, 86, 76, 4, PAL.hayDark); fl(g, 'rgba(255,255,255,0.35)', rr(14, 12, 40, 8, 4)); }, 65, 42),
  cone: () => spec('t:cone', 56, 56, (g) => { ol(g, PAL.orange, circ(28, 28, 22), 4); fl(g, '#fff', circ(28, 28, 13)); ol(g, PAL.orange, circ(28, 28, 7), 3); }, 28, 28),
  treeTop: (d: number, c: string = '#3fae4a') => spec(`t:tree:${d}:${c}`, d + 30, d + 30, (g) => {
    fl(g, 'rgba(0,0,0,0.18)', circ(d / 2 + 22, d / 2 + 22, d / 2));
    ol(g, c, circ(d / 2 + 12, d / 2 + 12, d / 2)); fl(g, darken(c, 0.15), circ(d / 2 + 24, d / 2 + 26, d * 0.3)); fl(g, '#6ed46c', circ(d * 0.36, d * 0.34, d * 0.14)); fl(g, '#8fe48a', circ(d * 0.62, d * 0.3, d * 0.07));
  }, (d + 30) / 2 - 4, (d + 30) / 2 - 4),
  wall: (len: number, th: number) => spec(`t:wall:${len}:${th}`, len + 16, th + 16, (g) => { ol(g, '#c97b5a', rr(8, 8, len, th, 8)); for (let i = 1; i < len / 50; i++) line(g, 8 + i * 50, 10, 8 + i * 50, th + 6, 2, '#a85c40'); }, (len + 16) / 2, (th + 16) / 2),
  squirrelTop: () => spec('t:squirrel', 60, 60, (g) => { ol(g, '#c0703a', circ(30, 30, 14), 3); ol(g, '#c0703a', circ(44, 30, 9), 3); ol(g, '#c0703a', (c) => c.ellipse(14, 34, 14, 8, 0.4, 0, 7), 3); }, 30, 30),
  duckTop: (s = 1) => spec(`t:duck:${s}`, 60 * s, 60 * s, (g) => { g.scale(s, s); ol(g, PAL.yellow, (c) => c.ellipse(28, 30, 20, 14, 0, 0, 7), 3); ol(g, PAL.yellow, circ(46, 30, 10), 3); fl(g, PAL.orange, poly([[54, 27], [62, 30], [54, 33]])); fl(g, PAL.ink, circ(48, 26, 2)); fl(g, PAL.ink, circ(48, 34, 2)); }, 30 * s, 30 * s),
  puddle: (w: number, h: number) => spec(`t:pond:${w}:${h}`, w + 16, h + 16, (g) => { ol(g, '#5fc8ff', (c) => c.ellipse((w + 16) / 2, (h + 16) / 2, w / 2, h / 2, 0, 0, 7), 4); fl(g, 'rgba(255,255,255,0.4)', (c) => c.ellipse((w + 16) / 2 - w * 0.2, (h + 16) / 2 - h * 0.15, w * 0.15, h * 0.06, -0.3, 0, 7)); }, (w + 16) / 2, (h + 16) / 2),
};

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
