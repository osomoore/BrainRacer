/**
 * Run scene kit: side-view stage.
 *
 *   const S = new SideStage(ctx, { worldW: 3400, sky: [..], hills: [...] });
 *   S.place(300);                       // car (ctx.rig) on the ground at world x=300
 *   await S.driveTo(1200, 2000);        // tween + camera follow
 *   S.add('back' | 'mid' | 'front', img)  // world layers (back < car < front)
 *   S.pool({ x0, x1, depth, kind })     // mud / water / snow pit with a back part and a translucent/opaque front part
 *
 * World coordinates: origin at the ground line at camera x=0; +y is DOWN, so things stand at y=0 and rise to negative y.
 * The world is scaled by `k` (1 on a wide pane, ~0.64 in a 960 px pane) so the visible width in world units is `viewW`.
 * The backdrop (sky, parallax hills, clouds) is in screen space; `overlay` is screen space above everything (fog, night).
 */
import Phaser from 'phaser';
import type { StageContext } from '../types';
import { Fx, along } from './fx';
import { type Ctx2D, PAL, bakeKey, bakeTemp, circ, darken, fl, ol, prop, spec } from './draw';
import { P } from './props';

export interface HillLayer { color: string; h: number; f: number; waves?: number; seed?: number; dy?: number }
export interface SideOpts {
  worldW: number;
  sky?: [string, string];
  /** [top, body, dark] */
  ground?: [string, string, string];
  hills?: HillLayer[];
  clouds?: number;
  sun?: boolean;
  /** Ground segments (world x ranges). Default: one long strip. Terrain given -> ignored. */
  segments?: [number, number][];
  /** Rolling terrain: y(x) in world units (negative = higher). Replaces the flat ground. */
  terrain?: (x: number) => number;
  /** Ground line as a fraction of the area height (default: ctx.groundY). Lower values leave more room below, e.g. for canyons. */
  groundFrac?: number;
  /** Start camera x. */
  cam?: number;
}

export type Layer = 'back' | 'mid' | 'front';

export class SideStage {
  readonly scene: Phaser.Scene;
  readonly k: number;
  readonly viewW: number;
  readonly viewH: number;
  readonly groundY: number;
  readonly worldW: number;
  readonly fx: Fx;
  readonly backdrop: Phaser.GameObjects.Container;
  readonly world: Phaser.GameObjects.Container;
  readonly overlay: Phaser.GameObjects.Container;
  readonly layers: Record<Layer, Phaser.GameObjects.Container>;
  readonly car: Phaser.GameObjects.Container;
  camX = 0;
  /** Vertical camera (world units, positive = camera moved up); follows the car when followY is on (hills). */
  camY = 0;
  followY = false;
  /** Camera follows this x when set. */
  follow: { x: number } | null = null;
  lead = 0.36;
  terrain: ((x: number) => number) | null = null;
  private hills: { imgs: Phaser.GameObjects.Image[]; f: number; w: number }[] = [];
  private clouds: { img: Phaser.GameObjects.Image; base: number; speed: number }[] = [];
  private time = 0;
  private readonly upd: (t: number, dt: number) => void;
  private dead = false;

  constructor(readonly ctx: StageContext, readonly opts: SideOpts) {
    this.scene = ctx.scene;
    const { w, h } = ctx.size;
    this.k = Math.min(1, w / 1500);
    this.viewW = w / this.k;
    this.viewH = h / this.k;
    this.groundY = opts.groundFrac ? Math.round(h * opts.groundFrac) : ctx.groundY;
    this.worldW = opts.worldW;
    this.terrain = opts.terrain ?? null;
    const sc = this.scene;
    this.backdrop = sc.add.container(0, 0);
    this.world = sc.add.container(0, this.groundY).setScale(this.k);
    this.overlay = sc.add.container(0, 0);
    ctx.layer.add([this.backdrop, this.world, this.overlay]);
    this.layers = { back: sc.add.container(0, 0), mid: sc.add.container(0, 0), front: sc.add.container(0, 0) };
    this.world.add([this.layers.back, this.layers.mid, this.layers.front]);
    this.car = ctx.rig.root;
    this.layers.mid.add(this.car);
    this.fx = new Fx(ctx);
    this.buildBackdrop();
    this.buildGround();
    this.camX = opts.cam ?? 0;
    this.apply();
    this.upd = (_t, dtMs) => this.tick(Math.min(dtMs, 50) / 1000 * (sc.tweens.timeScale || 1));
    sc.events.on('update', this.upd);
    ctx.layer.once('destroy', () => { this.dead = true; sc.events.off('update', this.upd); });
  }

  add<T extends Phaser.GameObjects.GameObject>(layer: Layer, obj: T): T { this.layers[layer].add(obj); return obj; }

  /** Bake + add a prop to a world layer at (x, y). y defaults to the ground height at x. */
  put(layer: Layer, s: ReturnType<typeof spec>, x: number, y?: number, scale = 1): Phaser.GameObjects.Image {
    return prop(this.scene, this.layers[layer], s, x, y ?? this.groundAt(x), scale);
  }

  groundAt(x: number): number { return this.terrain ? this.terrain(x) : 0; }
  angleAt(x: number): number { const t = this.terrain; return t ? Math.atan2(t(x + 30) - t(x - 30), 60) : 0; }

  /** Put the car on the ground at world x (and make the camera follow it). */
  place(x: number): void {
    this.car.setPosition(x, this.groundAt(x)).setRotation(0);
    this.follow = this.car;
    this.camX = this.targetCam();
    this.apply();
  }

  private targetCam(): number {
    const f = this.follow;
    if (!f) return this.camX;
    return Math.max(0, Math.min(this.worldW - this.viewW, f.x - this.viewW * this.lead));
  }

  /** Smooth camera pan to world x (stops following). */
  async camTo(x: number, ms: number): Promise<void> {
    this.follow = null;
    const st = { c: this.camX };
    const to = Math.max(0, Math.min(this.worldW - this.viewW, x));
    await this.ctx.tween({ targets: st, c: to, duration: ms, ease: 'Sine.easeInOut', onUpdate: () => { this.camX = st.c; this.apply(); } });
  }

  /** Pan so that world x sits at screen fraction `frac` of the width. */
  camFocus(x: number, ms: number, frac = 0.5): Promise<void> { return this.camTo(x - this.viewW * frac, ms); }

  /** Visible world x range. */
  get left(): number { return this.camX; }
  get right(): number { return this.camX + this.viewW; }

  /** Drive the car to x (follows terrain if any). */
  async driveTo(x: number, ms: number, ease = 'Sine.easeInOut', anim: 'drive' | 'spinWheels' = 'drive'): Promise<void> {
    this.ctx.rig.play(anim);
    const x0 = this.car.x;
    await along(this.ctx, ms, (t) => this.setCarX(x0 + (x - x0) * t), ease);
  }

  setCarX(x: number): void {
    this.car.x = x;
    if (this.terrain) {
      const a = this.ctx.rig.anchor('wheelRear'), b = this.ctx.rig.anchor('wheelFront');
      const yr = this.terrain(x + a.x), yf = this.terrain(x + b.x);
      this.car.y = (yr + yf) / 2;
      this.car.rotation = Math.atan2(yf - yr, b.x - a.x);
    }
  }

  /** Leave to the right (success exit). */
  async exit(ms = 1300): Promise<void> {
    this.follow = null;
    this.ctx.rig.play('drive');
    const x0 = this.car.x, x1 = this.right + 700;
    await along(this.ctx, ms, (t) => this.setCarX(x0 + (x1 - x0) * t), 'Quad.easeIn');
  }

  /** Happy stop: celebrate with sparkles. */
  async cheer(ms = 900, sound = true): Promise<void> {
    this.ctx.rig.play('celebrate');
    if (sound) this.ctx.audio.sfx('cheer', { volume: 0.7 });
    const p = this.ctx.rig.anchor('roof');
    this.fx.burst(this.layers.front, 'sparkle', this.car.x + p.x, this.car.y + p.y - 20);
    this.ctx.audio.sfx('sparkle');
    await this.ctx.wait(ms);
  }

  /** Dust puffs at the wheels. */
  dust(n = 6): void {
    const a = this.ctx.rig.anchor('wheelRear');
    this.fx.burst(this.layers.front, 'dust', this.car.x + a.x, this.car.y, n);
  }

  /** Squash the car (spring-y). */
  squash(sx: number, sy: number, ms = 120): Promise<void> {
    const r = this.ctx.rig.root;
    return this.ctx.tween({ targets: r, scaleX: sx, scaleY: sy, duration: ms, yoyo: true, ease: 'Sine.easeOut', onComplete: () => r.setScale(1) });
  }

  /** Dizzy stars above the roof. */
  dizzy(): { stop(): void } {
    const roof = this.ctx.rig.anchor('roof');
    const d = this.fx.dizzy(this.layers.front, this.car.x, this.car.y + roof.y - 50, 70);
    d.follow(this.car, roof.y - 50);
    return d;
  }

  /** Particle stream that follows a rig anchor (mud from the rear wheel, snow puffs, smoke from the exhaust...). Returns a stopper. */
  spray(kind: 'mud' | 'drops' | 'splash' | 'snow' | 'smoke' | 'dust' | 'bubbles' | 'sparkle', anchor = 'wheelRear', over: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {}, freq = 60, layer: Layer = 'front'): { stop(): void } {
    const a = this.ctx.rig.anchor(anchor);
    const em = this.fx.stream(this.layers[layer], kind, null, 0, 0, freq, over);
    const upd = (): void => em.setPos(this.car.x + a.x, this.car.y + a.y);
    this.scene.events.on('update', upd);
    upd();
    return { stop: () => { this.scene.events.off('update', upd); em.stop(); } };
  }

  /** Arc an object to (tx, ty) (parent coordinates) with a given hop height. */
  hop(obj: { x: number; y: number }, tx: number, ty: number, ms: number, height: number, ease = 'Sine.easeOut'): Promise<void> {
    const x0 = obj.x, y0 = obj.y;
    return along(this.ctx, ms, (t) => { obj.x = x0 + (tx - x0) * t; obj.y = y0 + (ty - y0) * t - Math.sin(t * Math.PI) * height; }, ease);
  }

  /** Dots of mud/paint stuck to the car body (children of the rig root). */
  splatter(n: number, color = 0x6a3c1a): void {
    const rig = this.ctx.rig, r = this.ctx.rng;
    for (let i = 0; i < n; i++) {
      const dot = this.scene.add.circle(r.range(-rig.width * 0.38, rig.width * 0.38), -r.range(rig.height * 0.1, rig.height * 0.55), r.range(7, 16), color).setStrokeStyle(2, 0x1b1b3a);
      rig.root.add(dot);
    }
  }

  // ------------------------------------------------------------------ pools (mud, water, snow)

  pool(o: { x0: number; x1: number; depth: number; kind: 'mud' | 'water' | 'snow' | 'creek'; frontAlpha?: number; surface?: number }): { back: Phaser.GameObjects.Image; front: Phaser.GameObjects.Image; surface: number; kind: string } {
    const w = Math.round(o.x1 - o.x0), d = Math.round(o.depth);
    const col = { mud: [PAL.mud, PAL.mudDark], water: ['#4fb8ff', '#2b8cff'], creek: ['#5fc8ff', '#3b9cff'], snow: ['#f4fbff', '#cfe8f7'] }[o.kind];
    const mk = (front: boolean) => spec(`pool:${o.kind}:${w}:${d}:${front}`, w + 20, d + 30, (g) => {
      const top = 14;
      ol(g, col[0], (c) => {
        c.moveTo(10, top);
        const n = Math.max(4, Math.round(w / 60));
        for (let i = 0; i <= n; i++) { const x = 10 + (w * i) / n; c.lineTo(x, top + (i % 2 ? 5 : -2)); }
        c.lineTo(w + 10, top + d * 0.7); c.quadraticCurveTo(w + 4, top + d + 8, w - 40, top + d + 8); c.lineTo(60, top + d + 8); c.quadraticCurveTo(16, top + d + 8, 10, top + d * 0.7); c.closePath();
      }, 5);
      g.save(); g.beginPath(); g.rect(10, top, w, d + 10); g.clip();
      fl(g, col[1], (c) => c.rect(10, top + d * 0.45, w, d));
      g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(14, top + 4, w - 8, 6);
      if (o.kind === 'mud') for (let i = 0; i < w / 90; i++) { fl(g, darken(PAL.mud, 0.35), circ(40 + ((i * 97) % Math.max(50, w - 80)), top + 22 + ((i * 53) % Math.max(12, d - 40)), 8)); }
      g.restore();
    }, 10, 14);
    const gy = this.groundAt(o.x0);
    const back = prop(this.scene, this.layers.back, mk(false), o.x0, gy);
    const front = prop(this.scene, this.layers.front, mk(true), o.x0, gy + (o.surface ?? 0));
    front.setAlpha(o.frontAlpha ?? (o.kind === 'mud' || o.kind === 'snow' ? 1 : 0.5));
    return { back, front, surface: o.surface ?? 0, kind: o.kind };
  }

  // ------------------------------------------------------------------ backdrop and ground

  private buildBackdrop(): void {
    const o = this.opts, { w, h } = this.ctx.size, sc = this.scene;
    const [a, b] = o.sky ?? [PAL.sky, PAL.skyLow];
    const sky = prop(sc, this.backdrop, P.sky(a, b), 0, 0);
    sky.setOrigin(0, 0).setDisplaySize(w, h);
    if (o.sun) prop(sc, this.backdrop, P.sun(), w * 0.82, this.groundY * 0.3);
    for (const hl of o.hills ?? []) {
      const s = P.hills(hl.color, hl.h, hl.waves ?? 3, hl.seed ?? 1);
      const imgs: Phaser.GameObjects.Image[] = [];
      const n = Math.ceil(w / 1024) + 2;
      for (let i = 0; i < n; i++) { const im = prop(sc, this.backdrop, s, 0, this.groundY - (hl.dy ?? 0) + 4); im.setOrigin(0, 1); imgs.push(im); }
      this.hills.push({ imgs, f: hl.f, w: 1024 });
    }
    for (let i = 0; i < (o.clouds ?? 0); i++) {
      const r = this.ctx.rng;
      const img = prop(sc, this.backdrop, P.cloud(), 0, 80 + r.next() * this.groundY * 0.35, 0.8 + r.next() * 0.7);
      img.setAlpha(0.95);
      this.clouds.push({ img, base: r.next() * (w + 500), speed: 8 + r.next() * 14 });
    }
  }

  private buildGround(): void {
    const o = this.opts, sc = this.scene;
    const [top, body, dark] = o.ground ?? [PAL.grass, PAL.dirt, PAL.dirtDark];
    if (this.terrain) { this.buildTerrain(top, body); return; }
    const gs = P.ground(top, body, dark);
    const key = bakeKey(sc, gs.key, 256, 256, (g) => gs.draw(g));
    const segs = o.segments ?? [[-800, this.worldW + 800]];
    for (const [x0, x1] of segs) {
      const ts = sc.add.tileSprite(x0, -34, x1 - x0, 256, key).setOrigin(0, 0);
      const fill = sc.add.rectangle(x0, 200, x1 - x0, 1600, Phaser.Display.Color.HexStringToColor(body).color).setOrigin(0, 0);
      this.layers.back.add([fill, ts]);
    }
  }

  private buildTerrain(top: string, body: string): void {
    const f = this.terrain!;
    const x0 = -400, x1 = this.worldW + 600, step = 30;
    let minY = 0;
    for (let x = x0; x <= x1; x += step) minY = Math.min(minY, f(x));
    const bottom = 900, H = bottom - minY + 60, W = x1 - x0, S = 0.5;
    const key = bakeTemp(this.scene, this.layers.back, W * S, H * S, (g: Ctx2D) => {
      g.scale(S, S);
      g.translate(-x0, -minY + 30);
      const path = (c: Ctx2D, dy: number): void => { c.moveTo(x0, bottom); for (let x = x0; x <= x1; x += step) c.lineTo(x, f(x) + dy); c.lineTo(x1, bottom); c.closePath(); };
      g.beginPath(); path(g, 0); g.fillStyle = body; g.fill();
      // grass skin
      g.beginPath(); g.moveTo(x0, f(x0)); for (let x = x0; x <= x1; x += step) g.lineTo(x, f(x));
      for (let x = x1; x >= x0; x -= step) g.lineTo(x, f(x) + 34); g.closePath(); g.fillStyle = top; g.fill();
      g.beginPath(); for (let x = x0; x <= x1; x += step) g.lineTo(x, f(x) + 34); g.lineWidth = 6; g.strokeStyle = PAL.ink; g.stroke();
      g.beginPath(); for (let x = x0; x <= x1; x += step) { if (x === x0) g.moveTo(x, f(x)); else g.lineTo(x, f(x)); } g.lineWidth = 4; g.strokeStyle = darken(top, 0.25); g.stroke();
    });
    const img = this.scene.add.image(x0, minY - 30, key).setOrigin(0, 0).setScale(1 / S);
    this.layers.back.add(img);
  }

  // ------------------------------------------------------------------ per-frame

  private tick(dt: number): void {
    if (this.dead) return;
    this.time += dt;
    if (this.follow) {
      const t = this.targetCam();
      this.camX += (t - this.camX) * Math.min(1, dt * 7);
    }
    if (this.followY) this.camY += (Math.max(0, -this.car.y * 0.92) - this.camY) * Math.min(1, dt * 5);
    this.apply();
  }

  apply(): void {
    this.world.x = -this.camX * this.k;
    this.world.y = this.groundY + this.camY * this.k;
    const { w } = this.ctx.size;
    for (const hl of this.hills) {
      const sw = hl.w * 1; // texture is drawn at design scale
      const off = -((this.camX * this.k * hl.f) % sw);
      hl.imgs.forEach((im, i) => im.setX(off + i * sw));
    }
    for (const c of this.clouds) {
      const span = w + 600;
      c.img.x = (((c.base + this.time * c.speed - this.camX * this.k * 0.05) % span) + span) % span - 300;
    }
  }
}


/** A stretched rope/cable between two world points (thin rectangle, updated by set()). */
export class Cable {
  private readonly r: Phaser.GameObjects.Rectangle;
  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, color = 0x7a4a24, width = 9) {
    this.r = scene.add.rectangle(0, 0, 10, width, color).setOrigin(0, 0.5).setStrokeStyle(3, 0x1b1b3a);
    parent.add(this.r);
  }
  set(x1: number, y1: number, x2: number, y2: number): void {
    this.r.setPosition(x1, y1).setSize(Math.hypot(x2 - x1, y2 - y1), this.r.height).setRotation(Math.atan2(y2 - y1, x2 - x1));
  }
  show(v: boolean): void { this.r.setVisible(v); }
  destroy(): void { this.r.destroy(); }
}
