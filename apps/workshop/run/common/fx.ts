/**
 * Run scene kit: particle presets, cosmetic physics bits, shake and small cartoon helpers.
 *
 *   const fx = new Fx(ctx);                         // one per stage, everything is parented to ctx.layer
 *   fx.burst(world, 'mud', x, y);                   // one-shot (auto cleaned): mud splash dust sparkle snow confetti smoke stars drops leaves hay hearts
 *   const s = fx.stream(world, 'mud', rig.root, -60, 0);  s.stop();   // continuous, follows an object
 *   fx.bits.add(obj, { vx, vy, floorY })           // bouncing box / hubcap / hay, simple integrator (never decides pass/fail)
 *   fx.dizzy(parent, x, y)                          // stars circling a head; returns a stopper
 *
 * Counts are deliberately small (weak Android TV box). Stages can opt into seeded cosmetic jitter.
 */
import Phaser from 'phaser';
import type { Rng } from '../../core/rng';
import type { StageContext } from '../types';
import { OUTLINE, bakeKey, circ, fl, ol, poly } from './draw';

export type FxKind = 'mud' | 'splash' | 'dust' | 'sparkle' | 'snow' | 'confetti' | 'smoke' | 'drops' | 'leaves' | 'hay' | 'hearts' | 'notes' | 'bubbles';

/** Soft round puff texture (dust, smoke, transitions). */
export function puffTexture(sc: Phaser.Scene): string {
  return bakeKey(sc, 'fx:puff', 64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 4, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
}

interface Preset { tex: string; cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig; count: number }
type EmitterConfig = Preset['cfg'];

export class Fx {
  readonly bits: Bits;
  private readonly sc: Phaser.Scene;
  private readonly keys: Record<string, string>;
  private rng?: Rng;
  constructor(ctx: Pick<StageContext, 'scene' | 'layer'>) {
    this.sc = ctx.scene;
    this.bits = new Bits(ctx.scene, ctx.layer);
    const sc = this.sc;
    this.keys = {
      dot: bakeKey(sc, 'fx:dot', 24, 24, (g) => { fl(g, '#fff', circ(12, 12, 11)); }),
      puff: puffTexture(sc),
      star: bakeKey(sc, 'fx:star', 32, 32, (g) => { const pts: [number, number][] = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 6 : 14; pts.push([16 + Math.cos(a) * r, 16 + Math.sin(a) * r]); } fl(g, '#fff', poly(pts)); }),
      conf: bakeKey(sc, 'fx:conf', 14, 22, (g) => { g.fillStyle = '#fff'; g.fillRect(1, 1, 12, 20); }),
      flake: bakeKey(sc, 'fx:flake', 16, 16, (g) => { fl(g, '#fff', circ(8, 8, 6)); }),
      leaf: bakeKey(sc, 'fx:leaf', 24, 16, (g) => { fl(g, '#fff', (c) => c.ellipse(12, 8, 11, 6, 0.4, 0, 7)); }),
      heart: bakeKey(sc, 'fx:heart', 32, 30, (g) => { fl(g, '#fff', (c) => { c.moveTo(16, 28); c.bezierCurveTo(-4, 14, 4, -2, 16, 8); c.bezierCurveTo(28, -2, 36, 14, 16, 28); c.closePath(); }); }),
      note: bakeKey(sc, 'fx:note', 28, 36, (g) => { ol(g, '#fff', (c) => c.ellipse(9, 28, 7, 5, -0.4, 0, 7), 2); g.fillStyle = '#fff'; g.fillRect(14, 4, 3, 24); fl(g, '#fff', poly([[16, 4], [26, 10], [16, 16]])); }),
      drop: bakeKey(sc, 'fx:drop', 16, 24, (g) => { fl(g, '#fff', (c) => { c.moveTo(8, 1); c.quadraticCurveTo(16, 14, 8, 22); c.quadraticCurveTo(0, 14, 8, 1); }); }),
      bub: bakeKey(sc, 'fx:bub', 32, 32, (g) => { g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(16, 16, 12, 0, 7); g.stroke(); }),
    };
  }

  seed(rng: Rng): void { this.rng = rng.fork(1); }

  private emitterConfig(cfg: EmitterConfig): EmitterConfig {
    if (!this.rng) return cfg;
    // Each emitter has its own sequence so stream length cannot change the next burst.
    const rng = this.rng.fork(1);
    const opts = { ...cfg };
    for (const key of ['speed', 'angle', 'rotate', 'tint'] as const) {
      const value = opts[key];
      if (Array.isArray(value)) opts[key] = () => rng.pick(value);
      else if (value && typeof value === 'object' && 'min' in value && 'max' in value) {
        const { min, max } = value;
        opts[key] = () => rng.range(min, max);
      }
    }
    return opts;
  }

  private preset(kind: FxKind): Preset {
    const k = this.keys;
    switch (kind) {
      case 'mud': return { tex: k.dot, count: 16, cfg: { speed: { min: 260, max: 620 }, angle: { min: -135, max: -45 }, gravityY: 1500, lifespan: 800, scale: { start: 1.4, end: 0.6 }, tint: [0x7a4a24, 0x5a3418, 0x8a5a30], rotate: { min: 0, max: 360 } } };
      case 'splash': return { tex: k.drop, count: 16, cfg: { speed: { min: 260, max: 620 }, angle: { min: -115, max: -65 }, gravityY: 1500, lifespan: 900, scale: { start: 1.2, end: 0.5 }, tint: [0x4fb8ff, 0xbfe6ff, 0x2b8cff] } };
      case 'drops': return { tex: k.dot, count: 8, cfg: { speed: { min: 60, max: 220 }, angle: { min: -150, max: -30 }, gravityY: 900, lifespan: 700, scale: { start: 0.7, end: 0.2 }, tint: 0xbfe6ff } };
      case 'dust': return { tex: k.puff, count: 6, cfg: { speed: { min: 30, max: 120 }, angle: { min: 180, max: 360 }, lifespan: 700, scale: { start: 1.2, end: 3 }, alpha: { start: 0.8, end: 0 }, tint: 0xe8dcc2 } };
      case 'sparkle': return { tex: k.star, count: 14, cfg: { speed: { min: 140, max: 380 }, angle: { min: 0, max: 360 }, gravityY: 120, lifespan: 900, scale: { start: 1.3, end: 0 }, rotate: { min: 0, max: 360 }, tint: [0xffd23f, 0xffffff, 0xffa8e0] } };
      case 'snow': return { tex: k.flake, count: 8, cfg: { speed: { min: 40, max: 160 }, angle: { min: 180, max: 360 }, gravityY: 300, lifespan: 900, scale: { start: 1.4, end: 0.4 }, alpha: { start: 1, end: 0 }, tint: 0xf4fbff } };
      case 'confetti': return { tex: k.conf, count: 36, cfg: { speed: { min: 200, max: 640 }, angle: { min: -130, max: -50 }, gravityY: 700, lifespan: 2200, scale: { start: 1, end: 0.8 }, rotate: { min: 0, max: 360 }, tint: [0xe8434a, 0xffd23f, 0x2fb84f, 0x2b8cff, 0xa35cff, 0xff7eb6] } };
      case 'smoke': return { tex: k.puff, count: 4, cfg: { speed: { min: 20, max: 80 }, angle: { min: 200, max: 340 }, gravityY: -60, lifespan: 900, scale: { start: 0.8, end: 2.2 }, alpha: { start: 0.7, end: 0 }, tint: 0xcfd3da } };
      case 'leaves': return { tex: k.leaf, count: 8, cfg: { speed: { min: 20, max: 90 }, angle: { min: 60, max: 120 }, gravityY: 120, lifespan: 2000, scale: { start: 1.2, end: 1 }, rotate: { min: 0, max: 360 }, tint: [0x4cb34f, 0x8ad24a, 0xf2c14a] } };
      case 'hay': return { tex: k.conf, count: 18, cfg: { speed: { min: 100, max: 420 }, angle: { min: -150, max: -30 }, gravityY: 800, lifespan: 1500, scale: { start: 0.8, end: 0.6 }, rotate: { min: 0, max: 360 }, tint: [0xf2cf5a, 0xd4a933, 0xe8c040] } };
      case 'hearts': return { tex: k.heart, count: 4, cfg: { speed: { min: 40, max: 110 }, angle: { min: 250, max: 290 }, gravityY: -40, lifespan: 1400, scale: { start: 1, end: 0.4 }, alpha: { start: 1, end: 0 }, tint: 0xff7eb6 } };
      case 'notes': return { tex: k.note, count: 3, cfg: { speed: { min: 60, max: 140 }, angle: { min: 240, max: 300 }, lifespan: 1100, scale: { start: 1, end: 0.6 }, alpha: { start: 1, end: 0 }, rotate: { min: -20, max: 20 }, tint: 0x1b1b3a } };
      case 'bubbles': return { tex: k.bub, count: 6, cfg: { speed: { min: 30, max: 90 }, angle: { min: 250, max: 290 }, gravityY: -200, lifespan: 1100, scale: { start: 0.6, end: 1.2 }, alpha: { start: 1, end: 0 }, tint: 0xffffff } };
    }
  }

  /** One-shot burst at (x, y) in `parent` coordinates. */
  burst(parent: Phaser.GameObjects.Container, kind: FxKind, x: number, y: number, count?: number, over: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {}): void {
    const p = this.preset(kind);
    const em = this.sc.add.particles(x, y, p.tex, this.emitterConfig({ ...p.cfg, ...over, emitting: false }));
    parent.add(em);
    em.explode(count ?? p.count);
    this.sc.time.delayedCall(((typeof p.cfg.lifespan === 'number' ? p.cfg.lifespan : 1500) + 200), () => { if (em.scene) em.destroy(); });
  }

  /** Continuous emitter (frequency ms), optionally following an object with an offset. */
  stream(parent: Phaser.GameObjects.Container, kind: FxKind, follow: { x: number; y: number } | null, ox = 0, oy = 0, frequency = 60, over: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {}): { stop(): void; setPos(x: number, y: number): void } {
    const p = this.preset(kind);
    const em = this.sc.add.particles(ox, oy, p.tex, this.emitterConfig({ ...p.cfg, quantity: 1, frequency, ...over }));
    parent.add(em);
    if (follow) em.startFollow(follow, ox, oy);
    return {
      stop: () => { if (em.scene) { em.stop(); this.sc.time.delayedCall(2500, () => { if (em.scene) em.destroy(); }); } },
      setPos: (x, y) => em.setPosition(x, y),
    };
  }

  /** Stars circling a head (dizzy). Returns a stopper that fades them out. */
  dizzy(parent: Phaser.GameObjects.Container, x: number, y: number, r = 60): { stop(): void; follow(obj: { x: number; y: number }, dy: number): void } {
    const c = this.sc.add.container(x, y);
    parent.add(c);
    const stars: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < 3; i++) stars.push(this.sc.add.image(0, 0, this.keys.star).setScale(1.4).setTint(0xffd23f));
    c.add(stars);
    const st = { a: 0 };
    const tw = this.sc.tweens.add({
      targets: st, a: Math.PI * 2, duration: 1100, repeat: -1,
      onUpdate: () => { stars.forEach((s, i) => { const a = st.a + (i * Math.PI * 2) / 3; s.setPosition(Math.cos(a) * r, Math.sin(a) * r * 0.32); s.setDepth(Math.sin(a)); s.setScale(1.1 + Math.sin(a) * 0.3); }); },
    });
    let fol: { o: { x: number; y: number }; dy: number } | null = null;
    const upd = (): void => { if (fol) c.setPosition(fol.o.x, fol.o.y + fol.dy); };
    this.sc.events.on('update', upd);
    c.once('destroy', () => { tw.stop(); this.sc.events.off('update', upd); });
    return {
      stop: () => { tw.stop(); this.sc.events.off('update', upd); this.sc.tweens.add({ targets: c, alpha: 0, duration: 250, onComplete: () => { if (c.scene) c.destroy(); } }); },
      follow: (o, dy) => { fol = { o, dy }; },
    };
  }
}

// ------------------------------------------------------------------------------------------ cosmetic physics

export interface Bit {
  obj: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject;
  vx: number; vy: number; vr?: number;
  /** Gravity px/s^2 (default 1800). */
  g?: number;
  /** y where it lands (parent coordinates). */
  floorY: number;
  bounce?: number;
  /** Called once when it has settled. */
  onSettle?: () => void;
  settled?: boolean;
}

/** Tiny integrator for flying/bouncing props. Time-scaled with scene.tweens.timeScale so fast-forward works. */
export class Bits {
  private readonly list: Bit[] = [];
  private readonly fn: (t: number, dt: number) => void;
  constructor(private readonly scene: Phaser.Scene, layer: Phaser.GameObjects.Container) {
    this.fn = (_t, dtMs) => this.step(Math.min(dtMs, 50) / 1000 * (this.scene.tweens.timeScale || 1));
    scene.events.on('update', this.fn);
    layer.once('destroy', () => scene.events.off('update', this.fn));
  }
  add(b: Bit): Bit { this.list.push(b); return b; }
  private step(dt: number): void {
    for (const b of this.list) {
      if (b.settled || !b.obj.scene) continue;
      b.vy += (b.g ?? 1800) * dt;
      b.obj.x += b.vx * dt; b.obj.y += b.vy * dt;
      b.obj.rotation += (b.vr ?? 0) * dt;
      if (b.obj.y >= b.floorY) {
        b.obj.y = b.floorY;
        const bo = b.bounce ?? 0.45;
        b.vy = -b.vy * bo; b.vx *= 0.75; if (b.vr) b.vr *= 0.6;
        if (Math.abs(b.vy) < 120) { b.vy = 0; b.vx = 0; b.vr = 0; b.settled = true; b.onSettle?.(); }
      }
    }
  }
}

// ------------------------------------------------------------------------------------------ small helpers

/** Decaying sine shake of any container (deterministic). Resolves when done. */
export function shake(ctx: Pick<StageContext, 'tween'>, target: { x: number; y: number }, amp = 14, ms = 450, axis: 'x' | 'y' | 'xy' = 'xy'): Promise<void> {
  const bx = target.x, by = target.y, st = { t: 0 };
  return ctx.tween({
    targets: st, t: 1, duration: ms, ease: 'Linear',
    onUpdate: () => { const f = (1 - st.t) * amp * Math.sin(st.t * 38); if (axis !== 'y') target.x = bx + f; if (axis !== 'x') target.y = by + f * 0.6; },
    onComplete: () => { target.x = bx; target.y = by; },
  });
}

/** Drive an object along a function of progress 0..1 (arcs, paths); resolves at the end. */
export function along(ctx: Pick<StageContext, 'tween'>, ms: number, fn: (t: number) => void, ease = 'Linear'): Promise<void> {
  const st = { t: 0 };
  return ctx.tween({ targets: st, t: 1, duration: ms, ease, onUpdate: () => fn(st.t) });
}

export const INK = OUTLINE;
