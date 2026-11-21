import Phaser from 'phaser';
import { DEPTH } from '../config/gameConfig';

export interface SpawnOpts {
  key: string;
  x: number; y: number;
  vx?: number; vy?: number;
  life: number;
  s0?: number; s1?: number;       // scale over life
  a0?: number; a1?: number;       // alpha over life
  rot?: number; spin?: number;
  tint?: number;
  add?: boolean;                  // additive blend
  drag?: number;                  // per-second velocity decay (0..)
  depth?: number;
  cameraFilter?: number;
  sx?: number;                    // extra x-stretch multiplier
}

interface P {
  img: Phaser.GameObjects.Image;
  alive: boolean;
  vx: number; vy: number; t: number; life: number;
  s0: number; s1: number; a0: number; a1: number; spin: number; drag: number; sx: number;
}

const ADD_DEPTH_OFFSET = 0.5;
const layerDepth = (depth: number, add: boolean) => depth + (add ? ADD_DEPTH_OFFSET : 0);

export interface PrewarmLayer { depth: number; add: boolean; count: number }

/** Fixed-size pool of image particles. When full, the oldest slot is recycled. */
export class ParticlePool {
  private readonly items: P[] = [];
  private cursor = 0;
  alive = 0;

  constructor(private readonly scene: Phaser.Scene, readonly max: number) {}

  /**
   * Create hidden slots up front on the layer they will be used on: adding an image or changing a
   * depth mid-race re-sorts the whole display list.
   */
  prewarm(key: string, layers: readonly PrewarmLayer[]): this {
    for (const l of layers) {
      const depth = layerDepth(l.depth, l.add);
      const blend = l.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL;
      for (let i = 0; i < l.count && this.items.length < this.max; i++) {
        this.make(key).img.setDepth(depth).setBlendMode(blend);
      }
    }
    return this;
  }

  private make(key: string): P {
    const p: P = { img: this.scene.add.image(0, 0, key).setVisible(false), alive: false, vx: 0, vy: 0, t: 0, life: 1, s0: 1, s1: 1, a0: 1, a1: 0, spin: 0, drag: 0, sx: 1 };
    this.items.push(p);
    return p;
  }

  spawn(o: SpawnOpts): void {
    const depth = layerDepth(o.depth ?? DEPTH.fx, !!o.add);
    // Prefer a free slot already on this layer (no depth change -> no display-list sort).
    let p: P | undefined;
    let free: P | undefined;
    const n = this.items.length;
    for (let i = 0; i < n; i++) {
      const c = this.items[(this.cursor + i) % n];
      if (c.alive) continue;
      if (c.img.depth === depth) { p = c; break; }
      free ??= c;
    }
    p ??= free;
    if (!p) {
      if (n < this.max) p = this.make(o.key);
      else {
        p = this.items[this.cursor];
        this.cursor = (this.cursor + 1) % n;
      }
    }
    if (!p.alive) this.alive++;
    p.alive = true;
    p.t = 0; p.life = o.life; p.vx = o.vx ?? 0; p.vy = o.vy ?? 0;
    p.s0 = o.s0 ?? 1; p.s1 = o.s1 ?? p.s0; p.a0 = o.a0 ?? 1; p.a1 = o.a1 ?? 0;
    p.spin = o.spin ?? 0; p.drag = o.drag ?? 0; p.sx = o.sx ?? 1;
    // Additive particles sit on their own half-step sub-layer so they batch together instead of
    // alternating with normal ones (each blend switch is a GPU flush, per camera). Depth and blend
    // are only touched when they change: setDepth always queues a full display-list sort.
    const blend = o.add ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL;
    if (p.img.depth !== depth) p.img.setDepth(depth);
    if (p.img.blendMode !== blend) p.img.setBlendMode(blend);
    if (p.img.texture.key !== o.key) p.img.setTexture(o.key);
    p.img.setPosition(o.x, o.y).setRotation(o.rot ?? 0).setVisible(true);
    p.img.cameraFilter = o.cameraFilter ?? 0;
    if (o.tint !== undefined) p.img.setTint(o.tint); else p.img.clearTint();
    p.img.setScale(p.s0 * p.sx, p.s0).setAlpha(p.a0);
  }

  update(dt: number): void {
    for (const p of this.items) {
      if (!p.alive) continue;
      p.t += dt;
      if (p.t >= p.life) { p.alive = false; p.img.setVisible(false); this.alive--; continue; }
      const k = p.t / p.life;
      if (p.drag) { const d = Math.exp(-p.drag * dt); p.vx *= d; p.vy *= d; }
      const s = p.s0 + (p.s1 - p.s0) * k;
      p.img.x += p.vx * dt; p.img.y += p.vy * dt;
      p.img.rotation += p.spin * dt;
      p.img.setScale(s * p.sx, s).setAlpha(p.a0 + (p.a1 - p.a0) * k);
    }
  }

  destroy(): void {
    for (const p of this.items) p.img.destroy();
    this.items.length = 0;
    this.alive = 0;
  }
}
