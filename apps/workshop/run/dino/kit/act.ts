/**
 * Dino Lab scene kit, layer 3: `Act`, the per-stage helper every scenario player uses.
 *
 * An Act wraps a StageContext: it puts a scaled `world` container inside `ctx.layer` (scale 1 on the wide
 * 1920x1080 area, 0.75 on the 960x1080 split pane, so scenes are laid out in a virtual width `W` of 1920 or
 * 1280), re-parents the rig into it, and offers small promise-based actions (move, hop, walk, tween, burst
 * of particles...). All tweens are recorded so `dispose()` can stop loops; nothing outlives play().
 *
 * Coordinates everywhere are virtual world px: x in 0..W, ground line at `gy` (side view), y grows downward.
 * Deterministic: all randomness comes from ctx.rng; pass/fail is never decided here.
 */
import type Phaser from 'phaser';
import { playWorkshopSfx, type WsAudioSfx } from '../../../audio/manifest';
import { WS_AUDIO } from '../../../config';
import type { ModelRig, RigAnim } from '../../../core/runtime';
import type { StageContext } from '../../types';
import { facetLevel, failedFacet, stageFacets } from './layout';
import { ensure, image } from './paint';

type Go = Phaser.GameObjects.GameObject;
type Img = Phaser.GameObjects.Image;
type Cont = Phaser.GameObjects.Container;
type Xf = Go & Phaser.GameObjects.Components.Transform;

export type FxKind = 'leaf' | 'dust' | 'drop' | 'snow' | 'spark' | 'star' | 'heart' | 'feather' | 'bubble' | 'sweat' | 'pebble' | 'twig';

export interface BurstOpts {
  n?: number;
  /** Horizontal spread speed (px/s), upward speed (px/s) and gravity (px/s^2). */
  spread?: number; up?: number; gravity?: number;
  ms?: number; scale?: number;
  /** Direction bias: -1 left, 0 both, 1 right. */
  dir?: number;
  tint?: number;
}

export class Act {
  readonly ctx: StageContext;
  readonly scene: Phaser.Scene;
  readonly rig: ModelRig;
  /** Scaled container holding three layers: `world` (scenery behind the dino, the default parent), `mid` (the rig) and `fore` (foreground props). */
  readonly scaler: Cont;
  readonly world: Cont;
  readonly mid: Cont;
  readonly fore: Cont;
  /** Virtual width of the area, ground y, top and bottom of the visible virtual rectangle. */
  readonly W: number;
  readonly gy: number;
  readonly top: number;
  readonly bottom: number;
  readonly s: number;
  /** Rig display scale (fits the dino into the scene) and facing (1 right, -1 left). */
  readonly rs: number;
  dir = 1;
  /** Facets present, the facet whose requirement failed first, and whether the whole stage passed. */
  readonly facets: string[];
  readonly fail: string | undefined;
  readonly pass: boolean;
  private tweens: Phaser.Tweens.Tween[] = [];
  private loops: Array<() => void> = [];
  private done = false;

  constructor(ctx: StageContext, opts: { topView?: boolean } = {}) {
    this.ctx = ctx;
    this.scene = ctx.scene;
    this.rig = ctx.rig;
    this.s = ctx.size.w >= 1600 ? 1 : 0.75;
    this.W = ctx.size.w / this.s;
    const pivotY = opts.topView ? ctx.size.h / 2 : ctx.groundY;
    this.gy = opts.topView ? ctx.size.h / 2 : ctx.groundY;
    const wy = pivotY * (1 - this.s);
    this.top = -wy / this.s;
    this.bottom = (ctx.size.h - wy) / this.s;
    this.scaler = ctx.scene.add.container(0, wy).setScale(this.s);
    this.world = ctx.scene.add.container(0, 0);
    this.mid = ctx.scene.add.container(0, 0);
    this.fore = ctx.scene.add.container(0, 0);
    this.scaler.add([this.world, this.mid, this.fore]);
    ctx.layer.add(this.scaler);
    this.facets = stageFacets(ctx.stage);
    this.fail = failedFacet(ctx.stage, ctx.result);
    this.pass = ctx.result.passed;
    const h = Math.max(ctx.rig.height, 1), w = Math.max(ctx.rig.width, 1);
    this.rs = Math.min(1, opts.topView ? 260 / w : 400 / h, (this.W * 0.3) / w);
    this.mid.add(ctx.rig.root);
    ctx.rig.root.setScale(this.rs, this.rs);
  }

  // ------------------------------------------------------------ levels / flags
  has(facet: string): boolean { return this.facets.includes(facet); }
  lv(facet: string, dflt = 1): number { return facetLevel(this.ctx.stage, facet, dflt); }
  /** True when `facet` is shown and its requirement failed (the first failure drives the gag). */
  failed(facet: string): boolean { return this.fail === facet; }
  /** Facets whose requirement passed in this stage (shown on a failing stage too, before the gag). */
  get rng(): StageContext['rng'] { return this.ctx.rng; }

  // ------------------------------------------------------------ building
  add<T extends Go>(o: T, parent: Cont = this.world): T { parent.add(o); return o; }

  img(key: string, x: number, y: number, scale = 1, parent: Cont = this.world): Img {
    const im = image(this.scene, key, x, y, scale);
    parent.add(im);
    return im;
  }

  /** Solid colour rectangle (cheap: a stretched 4x4 texture). */
  rect(color: number, x: number, y: number, w: number, h: number, alpha = 1, parent: Cont = this.world): Img {
    const k = ensure(this.scene, 'px').key;
    const im = this.scene.add.image(x, y, k).setOrigin(0, 0).setDisplaySize(w, h).setTint(color).setAlpha(alpha);
    parent.add(im);
    return im;
  }

  /**
   * Horizontal strip of a baked tile (tile `tileW` design px wide) covering [x, x+w), the last tile cropped.
   * Returns the tiles (so they can be animated) inside a container.
   */
  strip(key: string, x: number, y: number, w: number, tileW: number, parent: Cont = this.world, scale = 1): { box: Cont; tiles: Img[] } {
    const box = this.scene.add.container(0, 0);
    const tiles: Img[] = [];
    const sp = ensure(this.scene, key);
    const n = Math.ceil(w / (tileW * scale));
    for (let i = 0; i < n; i++) {
      const im = image(this.scene, key, x + i * tileW * scale, y, scale);
      const rest = w - i * tileW * scale;
      if (rest < tileW * scale) im.setCrop(0, 0, (rest / scale) * 1.5, sp.h * 1.5);
      box.add(im); tiles.push(im);
    }
    parent.add(box);
    return { box, tiles };
  }

  // ------------------------------------------------------------ time
  wait(ms: number): Promise<void> { return this.ctx.wait(ms); }

  /** Run a tween and resolve when it completes. Recorded so dispose() can stop it. */
  tw(config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise<void>((resolve) => {
      const t = this.scene.tweens.add({ ...config, onComplete: (...a: unknown[]) => { (config.onComplete as ((...x: unknown[]) => void) | undefined)?.(...a); resolve(); } });
      this.tweens.push(t);
    });
  }

  /** Fire-and-forget tween (e.g. a parallel wobble). */
  go(config: Phaser.Types.Tweens.TweenBuilderConfig): Phaser.Tweens.Tween {
    const t = this.scene.tweens.add(config);
    this.tweens.push(t);
    return t;
  }

  /** Looping tween (repeat forever); stopped by the returned function or dispose(). */
  loop(config: Phaser.Types.Tweens.TweenBuilderConfig): () => void {
    const t = this.scene.tweens.add({ repeat: -1, ...config });
    this.tweens.push(t);
    const stop = (): void => { try { t.stop(); } catch { /* gone */ } };
    this.loops.push(stop);
    return stop;
  }

  /** Move a display object. */
  move(o: Xf, x: number, y: number, ms: number, ease = 'Sine.easeInOut'): Promise<void> {
    return this.tw({ targets: o, x, y, duration: ms, ease });
  }

  /** Wiggle left-right a few times (rotation, radians). */
  wobble(o: Xf, amp = 0.15, ms = 120, times = 3): Promise<void> {
    return this.tw({ targets: o, rotation: { from: -amp, to: amp }, duration: ms, yoyo: true, repeat: times, ease: 'Sine.easeInOut', onComplete: () => { o.rotation = 0; } });
  }

  /** Jiggle sideways. */
  shake(o: Xf, amp = 8, ms = 50, times = 5): Promise<void> {
    const x0 = o.x;
    return this.tw({ targets: o, x: { from: x0 - amp, to: x0 + amp }, duration: ms, yoyo: true, repeat: times, onComplete: () => { o.x = x0; } });
  }

  sfx(name: WsAudioSfx, opts?: { volume?: number; rate?: number; pan?: number }): void {
    playWorkshopSfx(this.ctx.audio, name, opts);
  }

  // ------------------------------------------------------------ the dino
  get root(): Phaser.GameObjects.Container { return this.rig.root; }
  play(anim: RigAnim): void { this.rig.play(anim); }

  /** Put the dino at x on the ground facing dir. */
  place(x: number, dir = 1, y = this.gy): void {
    this.dir = dir;
    this.root.setPosition(x, y).setScale(dir * this.rs, this.rs);
  }
  face(dir: number): void { this.dir = dir; this.root.scaleX = dir * this.rs; }

  /** World position of a rig anchor ('mouth', 'headTop', 'belly', 'tail', 'front', 'feet'...). */
  pt(name: string): { x: number; y: number } {
    const a = this.rig.anchor(name);
    const r = this.root.rotation, c = Math.cos(r), sn = Math.sin(r);
    const ax = a.x * this.root.scaleX, ay = a.y * this.root.scaleY;
    return { x: this.root.x + ax * c - ay * sn, y: this.root.y + ax * sn + ay * c };
  }

  /** Walk / run to x (and face the way it goes). The gait keeps going until another play(). */
  async walkTo(x: number, ms: number, anim: RigAnim = 'walk', ease = 'Linear'): Promise<void> {
    const moving = x !== this.root.x;
    this.face(x >= this.root.x ? 1 : -1);
    this.play(anim);
    const gait = anim === 'walk' || anim === 'run' ? anim : undefined;
    const stepMs = gait && WS_AUDIO.dinoStepMs[gait];
    let lastContact = 0;
    await this.tw({
      targets: this.root, x, duration: ms, ease,
      onUpdate: moving && stepMs ? (tween) => {
        const contact = Math.floor(tween.elapsed / stepMs);
        if (contact === lastContact) return;
        lastContact = contact;
        this.sfx('step', { volume: 0.56, rate: (gait === 'run' ? 1.12 : 0.86) + (contact % 2) * 0.08 });
      } : undefined,
    });
  }

  /** Squash, spring up `h` px (ground-relative) and land; optionally travelling to x. Cosmetic only. */
  async hop(h: number, ms = 600, toX?: number, landY = this.gy): Promise<void> {
    const r = this.root, d = this.dir, rs = this.rs;
    await this.tw({ targets: r, scaleX: d * rs * 1.15, scaleY: rs * 0.8, duration: 130, ease: 'Quad.easeOut' });
    const x0 = r.x;
    const up = this.tw({ targets: r, y: landY - h, scaleX: d * rs * 0.9, scaleY: rs * 1.15, duration: ms * 0.5, ease: 'Quad.easeOut' });
    if (toX !== undefined) this.go({ targets: r, x: toX, duration: ms, ease: 'Linear' });
    await up;
    await this.tw({ targets: r, y: landY, scaleX: d * rs, scaleY: rs, duration: ms * 0.5, ease: 'Quad.easeIn' });
    await this.tw({ targets: r, scaleX: d * rs * 1.12, scaleY: rs * 0.86, duration: 80, yoyo: true });
    r.setScale(d * rs, rs);
    void x0;
  }

  /**
   * Fly the dino along a parabola from where it is to (x1, y1); `peak` px above the straight line. `tilt` (radians) pitches the nose
   * up on take-off and down on landing. Pure tween, never physics.
   */
  arc(x1: number, y1: number, peak: number, ms: number, tilt = 0): Promise<void> {
    const r = this.root, x0 = r.x, y0 = r.y, d = this.dir;
    const t = { v: 0 };
    return this.tw({
      targets: t, v: 1, duration: ms, ease: 'Linear',
      onUpdate: () => { r.x = x0 + (x1 - x0) * t.v; r.y = y0 + (y1 - y0) * t.v - 4 * peak * t.v * (1 - t.v); r.rotation = -d * tilt * (1 - 2 * t.v); },
      onComplete: () => { r.rotation = 0; },
    });
  }

  /** Parabolic flight of any display object from (x0, y0) to (x1, y1), `peak` px above the line. */
  arc2(o: Xf, x0: number, y0: number, x1: number, y1: number, peak: number, ms: number, spin = 0): Promise<void> {
    const t = { v: 0 };
    o.setPosition(x0, y0);
    return this.tw({
      targets: t, v: 1, duration: ms, ease: 'Linear',
      onUpdate: () => { o.x = x0 + (x1 - x0) * t.v; o.y = y0 + (y1 - y0) * t.v - 4 * peak * t.v * (1 - t.v); if (spin) o.rotation = spin * t.v; },
    });
  }

  /** Big comic ROAR text (the one word rule 14 allows), pops and fades. */
  roarText(x: number, y: number, word = 'ROAR!', size = 96): Promise<void> {
    const t = this.scene.add.text(x, y, word, { fontFamily: '"Trebuchet MS", Arial, sans-serif', fontSize: `${size}px`, fontStyle: 'bold', color: '#ffe14a', stroke: '#1b1b3a', strokeThickness: 12 }).setOrigin(0.5).setScale(0.3);
    this.fore.add(t);
    this.go({ targets: t, scale: 1.2, duration: 220, ease: 'Back.easeOut' });
    return this.tw({ targets: t, y: y - 40, alpha: { from: 1, to: 0 }, delay: 650, duration: 450, onComplete: () => t.destroy() });
  }

  /** Cartoon pop: scale pulse on any object. */
  pop(o: Xf, k = 1.25, ms = 120): Promise<void> {
    const sx = o.scaleX, sy = o.scaleY;
    return this.tw({ targets: o, scaleX: sx * k, scaleY: sy * k, duration: ms, yoyo: true, ease: 'Sine.easeOut', onComplete: () => { o.setScale(sx, sy); } });
  }

  // ------------------------------------------------------------ particles / icons
  /** Parabolic burst of small baked sprites. Modest counts by default; one tween drives them all. */
  burst(kind: FxKind, x: number, y: number, o: BurstOpts = {}): Promise<void> {
    const n = o.n ?? 8, spread = o.spread ?? 220, up = o.up ?? 260, g = o.gravity ?? 900, ms = o.ms ?? 800, sc = o.scale ?? 1;
    const key = kind === 'pebble' ? 'pebble' : `p:${kind}`;
    const ps: { im: Img; vx: number; vy: number; spin: number }[] = [];
    for (let i = 0; i < n; i++) {
      const im = image(this.scene, key, x, y, sc * this.rng.range(0.7, 1.15));
      if (o.tint !== undefined) im.setTint(o.tint);
      this.world.add(im);
      const vx = (o.dir ? Math.abs(this.rng.range(0.1, 1)) * o.dir : this.rng.range(-1, 1)) * spread;
      ps.push({ im, vx, vy: -up * this.rng.range(0.55, 1.1), spin: this.rng.range(-4, 4) });
    }
    const t = { v: 0 };
    return this.tw({
      targets: t, v: 1, duration: ms, ease: 'Linear',
      onUpdate: () => {
        const sec = t.v * (ms / 1000);
        for (const p of ps) { p.im.x = x + p.vx * sec; p.im.y = y + p.vy * sec + 0.5 * g * sec * sec; p.im.rotation = p.spin * sec; p.im.alpha = t.v < 0.65 ? 1 : (1 - t.v) / 0.35; }
      },
      onComplete: () => { for (const p of ps) p.im.destroy(); },
    });
  }

  /** Soft cloud puff that grows and fades (dust landing, "nom", poof). */
  puff(x: number, y: number, scale = 1, ms = 520): Promise<void> {
    const im = image(this.scene, 'p:puff', x, y, scale * 0.5);
    this.world.add(im);
    return this.tw({ targets: im, scaleX: scale / 1.5 * 1.3, scaleY: scale / 1.5 * 1.3, y: y - 26 * scale, alpha: { from: 1, to: 0 }, duration: ms, ease: 'Quad.easeOut', onComplete: () => im.destroy() });
  }

  /** Brown dust cloud at the feet (landing / skid). */
  dust(x: number, y: number, n = 4, scale = 1): Promise<void> {
    const ps: Img[] = [];
    for (let i = 0; i < n; i++) { const im = image(this.scene, 'p:dust', x + (i - n / 2) * 30 * scale, y - 10, 0.8 * scale); this.world.add(im); ps.push(im); }
    return this.tw({ targets: ps, scale: { from: 0.45 * scale, to: 1.05 * scale }, y: `-=${30 * scale}`, alpha: { from: 0.95, to: 0 }, duration: 620, ease: 'Quad.easeOut', onComplete: () => ps.forEach((p) => p.destroy()) });
  }

  /** Icon that floats up and fades (heart, question mark...). Resolves when gone. */
  floatIcon(key: string, x: number, y: number, scale = 1, rise = 90, ms = 1100): Promise<void> {
    const im = image(this.scene, key, x, y, scale * 0.4);
    this.world.add(im);
    this.go({ targets: im, scaleX: scale / 1.5, scaleY: scale / 1.5, duration: 220, ease: 'Back.easeOut' });
    return this.tw({ targets: im, y: y - rise, alpha: { from: 1, to: 0 }, delay: 300, duration: ms - 300, ease: 'Sine.easeIn', onComplete: () => im.destroy() });
  }

  /** Little stars circling around a point; call the returned function to remove them. */
  stars(x: number, y: number, n = 3, rx = 54, ry = 14): () => void {
    const holder = this.scene.add.container(x, y);
    const ims: Img[] = [];
    for (let i = 0; i < n; i++) { const im = image(this.scene, 'p:star', 0, 0, 0.7); holder.add(im); ims.push(im); }
    this.world.add(holder);
    const t = { a: 0 };
    const stop = this.loop({
      targets: t, a: Math.PI * 2, duration: 1100, ease: 'Linear',
      onUpdate: () => ims.forEach((im, i) => { const a = t.a + (i * Math.PI * 2) / n; im.setPosition(Math.cos(a) * rx, Math.sin(a) * ry); im.setDepth(Math.sin(a)); im.rotation = a; }),
    });
    return () => { stop(); holder.destroy(); };
  }

  /** Sparkles around the rig (success decoration). */
  sparkle(n = 8): Promise<void> {
    const p = this.pt('belly');
    return this.burst('spark', p.x, p.y - this.rig.height * this.rs * 0.1, { n, spread: 260, up: 330, gravity: 520, ms: 1100, scale: 0.9 });
  }

  /** Standard celebration at the end of a success. */
  async celebrate(ms = 1100): Promise<void> {
    this.play('celebrate');
    this.sfx('cheer');
    void this.sparkle(9);
    await this.wait(ms);
  }

  /** Hold a failure pose for ~1.5 s at the end. */
  hold(ms = 1500): Promise<void> { return this.wait(ms); }

  // ------------------------------------------------------------ cleanup
  /** Stop every loop and tween (called by `runScenario` when play() finishes or fails). */
  dispose(): void {
    if (this.done) return;
    this.done = true;
    for (const s of this.loops) s();
    for (const t of this.tweens) { try { t.stop(); } catch { /* already finished */ } }
    this.tweens = []; this.loops = [];
  }
}
