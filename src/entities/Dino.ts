import Phaser from 'phaser';
import { DINO_RIG, type RigPart } from '../art/dinoRig';
import { DEPTH, DINO } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';

/** Chunkier, friendlier proportions applied on top of the rig (rig is just a starting layout). */
const LOOK = {
  bodyScaleX: 1.0, bodyScaleY: 1.65,
  headScale: 1.75,
  headX: 140,
  tailScaleX: 0.55, tailScaleY: 1.5,
  legScale: 1.55,
  legY: 78,
};

const ROAR_SEC = 1.3;

/** Visual-only giant dino. Position/heading are driven by DinoSystem; no physics body. */
export class Dino {
  readonly root: Phaser.GameObjects.Container;
  private legL: Phaser.GameObjects.Image;
  private legR: Phaser.GameObjects.Image;
  private tail: Phaser.GameObjects.Image;
  private body: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  readonly scale: number;
  private phase = 0;
  private t = 0;
  private roarT = -1;
  private looking = 0;
  private extras = new Set<Phaser.GameObjects.GameObject>();
  private parts: Phaser.GameObjects.Image[] = [];
  private mult = 1;
  private wobble = 0;
  private tintT = 0;
  private stars: Phaser.GameObjects.Image[] = [];
  private bar: Phaser.GameObjects.Container;
  private barFill: Phaser.GameObjects.Rectangle;

  constructor(private scene: Phaser.Scene, x: number, y: number, angle: number) {
    this.scale = DINO.length / DINO_RIG.length;
    this.root = scene.add.container(x, y).setScale(this.scale).setRotation(angle).setDepth(DEPTH.dino);
    const sh = DINO_RIG.shadow;
    this.root.add(scene.add.image(sh.x, sh.y + 20, sh.key).setOrigin(sh.originX, sh.originY).setScale(1.25, 1.35).setAlpha(0.8));

    const made: Record<string, Phaser.GameObjects.Image> = {};
    const parts = Object.entries(DINO_RIG.parts) as [string, RigPart][];
    parts.sort((a, b) => a[1].depth - b[1].depth);
    for (const [name, p] of parts) {
      const img = scene.add.image(p.x, p.y, p.key).setOrigin(p.originX, p.originY).setFlipY(!!p.flipY);
      this.root.add(img);
      made[name] = img;
    }
    this.legL = made.legL; this.legR = made.legR; this.tail = made.tail; this.body = made.body; this.head = made.head;
    this.legL.setScale(LOOK.legScale).setY(-LOOK.legY);
    this.legR.setScale(LOOK.legScale).setY(LOOK.legY);
    this.legL.setFlipY(true);
    this.body.setScale(LOOK.bodyScaleX, LOOK.bodyScaleY);
    this.tail.setScale(LOOK.tailScaleX, LOOK.tailScaleY);
    this.head.setScale(LOOK.headScale).setX(LOOK.headX);
    this.parts = [this.legL, this.legR, this.tail, this.body, this.head];

    const bw = DINO.barWidth, bh = DINO.barHeight;
    const back = scene.add.rectangle(0, 0, bw + 12, bh + 12, 0xffffff).setStrokeStyle(6, 0x222222);
    const hole = scene.add.rectangle(0, 0, bw, bh, 0x333333);
    this.barFill = scene.add.rectangle(-bw / 2, 0, bw, bh, 0x59d84a).setOrigin(0, 0.5);
    this.bar = scene.add.container(x, y - DINO.barOffset, [back, hole, this.barFill]).setDepth(DEPTH.worldUi).setVisible(false);
  }

  /** Health bar (world space, hidden at full HP). */
  setHealth(frac: number): void {
    const f = Math.max(0, Math.min(1, frac));
    this.bar.setVisible(f < 1 && this.mult > 0.05);
    this.barFill.width = Math.max(1, DINO.barWidth * f);
    this.barFill.setFillStyle(f > 0.5 ? 0x59d84a : f > 0.25 ? 0xffc533 : 0xff4d3d);
  }

  /** Visual size multiplier (drop-in / shrink on defeat). */
  setMult(k: number): void { this.mult = k; this.root.setScale(this.scale * k); }
  setWobble(r: number): void { this.wobble = r; }

  /** Red flash when hit. */
  flinch(): void { this.tintT = 0.28; }

  setDizzy(on: boolean): void {
    if (on && this.stars.length === 0) {
      for (let i = 0; i < 4; i++) this.stars.push(this.scene.add.image(0, 0, TEX.fxStar).setDepth(DEPTH.fx).setTint(0xffe14d).setScale(0.9));
    } else if (!on) { for (const s of this.stars) s.destroy(); this.stars = []; }
  }

  /** Cartoon "poof": smoke, confetti and stars. Hides the dino itself. */
  poof(): void {
    this.root.setVisible(false);
    this.bar.setVisible(false);
    this.setDizzy(false);
    const x = this.root.x, y = this.root.y;
    const burst = (key: string, n: number, dist: number, scale: number, ms: number, tints: number[], fall: number) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, r = dist * (0.4 + Math.random() * 0.6);
        const im = this.scene.add.image(x, y, key).setDepth(DEPTH.fx).setScale(scale * (0.6 + Math.random() * 0.6))
          .setTint(tints[i % tints.length]).setRotation(Math.random() * 6);
        this.extras.add(im);
        this.scene.tweens.add({
          targets: im, x: x + Math.cos(a) * r, y: y + Math.sin(a) * r + fall, scale: im.scale * 1.8, alpha: { from: 1, to: 0 },
          rotation: im.rotation + 3, duration: ms, ease: 'Quad.easeOut',
          onComplete: () => { this.extras.delete(im); im.destroy(); },
        });
      }
    };
    burst(TEX.fxSmoke, 12, 220, 3.2, 1100, [0xffffff, 0xe8e8f4], 0);
    burst(TEX.fxConfetti, 36, 420, 1.6, 1500, [0xff5a5a, 0xffd34d, 0x5ad8ff, 0x7cfc5a, 0xff7ae0], 90);
    burst(TEX.fxStar, 10, 340, 1.3, 1300, [0xffe14d, 0xffffff], 0);
  }

  get x() { return this.root.x; }
  get y() { return this.root.y; }
  get angle() { return this.root.rotation; }

  /** World position of the mouth. */
  mouth(): { x: number; y: number } {
    const reach = (LOOK.headX + 0.88 * 140 * LOOK.headScale) * this.scale;
    return { x: this.root.x + Math.cos(this.angle) * reach, y: this.root.y + Math.sin(this.angle) * reach };
  }

  /** World position of a foot (side -1 left, 1 right). */
  foot(side: -1 | 1): { x: number; y: number } {
    const a = this.angle, c = Math.cos(a), s = Math.sin(a);
    const lx = -8 * this.scale, ly = side * LOOK.legY * this.scale;
    return { x: this.root.x + c * lx - s * ly, y: this.root.y + s * lx + c * ly };
  }

  setPose(x: number, y: number, angle: number): void {
    this.root.setPosition(x, y).setRotation(angle + this.wobble);
    this.bar.setPosition(x, y - DINO.barOffset);
  }

  get roaring() { return this.roarT >= 0; }

  roar(text = 'ROAAAR!', color = '#ff5a36'): void {
    this.roarT = 0;
    const m = this.mouth();
    for (let i = 0; i < 3; i++) {
      const ring = this.scene.add.image(m.x, m.y, TEX.fxRing).setDepth(DEPTH.fx).setTint(i === 1 ? 0xffd34d : 0xff9a3c)
        .setScale(0.3).setAlpha(0);
      this.extras.add(ring);
      this.scene.tweens.add({
        targets: ring, scale: 2.8 + i * 0.6, alpha: { from: 0.85, to: 0 },
        delay: i * 220, duration: 900, ease: 'Cubic.easeOut',
        onStart: () => ring.setAlpha(0.85),
        onComplete: () => { this.extras.delete(ring); ring.destroy(); },
      });
    }
    this.popText(m.x, m.y - 40, text, color, 120, 1500, 0.5);
  }

  /** Comic world text that pops and fades. */
  popText(x: number, y: number, text: string, color: string, size: number, ms: number, startScale = 0.4): void {
    const t = this.scene.add.text(x, y, text, {
      fontFamily: 'Arial Black, Impact, sans-serif', fontSize: `${size}px`, color,
      stroke: '#ffffff', strokeThickness: Math.round(size / 8),
    }).setOrigin(0.5).setDepth(DEPTH.worldUi).setScale(startScale);
    this.extras.add(t);
    this.scene.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.scene.tweens.add({
      targets: t, y: y - 120, alpha: 0, delay: ms * 0.45, duration: ms * 0.55,
      onComplete: () => { this.extras.delete(t); t.destroy(); },
    });
  }

  dust(x: number, y: number): void {
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = this.scene.add.image(x, y, TEX.fxDust).setDepth(DEPTH.fx).setAlpha(0.7).setScale(0.6 + Math.random() * 0.4).setTint(0xd8c8a0);
      this.extras.add(d);
      this.scene.tweens.add({
        targets: d, x: x + Math.cos(a) * 60, y: y + Math.sin(a) * 60, scale: d.scale * 2.4, alpha: 0,
        duration: 600, ease: 'Quad.easeOut',
        onComplete: () => { this.extras.delete(d); d.destroy(); },
      });
    }
  }

  /** speedFrac 0..1 (walking vs looking around). */
  update(dt: number, moveDist: number, walking: boolean): void {
    this.t += dt;
    if (this.tintT > 0) {
      this.tintT -= dt;
      for (const p of this.parts) { if (this.tintT > 0) p.setTint(0xff6a6a); else p.clearTint(); }
    }
    if (this.stars.length > 0) {
      const hx = this.root.x + Math.cos(this.angle) * LOOK.headX * this.scale * this.mult;
      const hy = this.root.y + Math.sin(this.angle) * LOOK.headX * this.scale * this.mult;
      this.stars.forEach((st, i) => {
        const a = this.t * 4 + (i * Math.PI) / 2;
        st.setPosition(hx + Math.cos(a) * 110, hy + Math.sin(a) * 110).setRotation(a * 2);
      });
    }
    if (walking) this.phase += moveDist / 55; // one leg frame per ~55 world px of stride
    const frames = DINO_RIG.legs.frames;
    const f = Math.floor(this.phase);
    this.legL.setTexture(frames[((f % 4) + 4) % 4]);
    this.legR.setTexture(frames[((f + DINO_RIG.legs.rightPhaseOffset) % 4 + 4) % 4]);

    this.looking += ((walking ? 0 : 1) - this.looking) * Math.min(1, dt * 5);
    const wag = DINO_RIG.tailWag * (walking ? 1.4 : 0.8);
    this.tail.setRotation(Math.sin(this.t * (walking ? 4.2 : 2.2)) * wag);
    this.body.setScale(LOOK.bodyScaleX * (1 + Math.sin(this.t * 3.1) * 0.015), LOOK.bodyScaleY * (1 + Math.sin(this.t * 3.1) * 0.02));

    let headRot = Math.sin(this.t * 2.6) * 0.06 + Math.sin(this.t * 1.1) * 0.35 * this.looking;
    let headScaleX = LOOK.headScale;
    let headScaleY = LOOK.headScale;
    let headY = Math.sin(this.t * (walking ? 7 : 3)) * 4;
    if (this.roarT >= 0) {
      this.roarT += dt;
      const k = this.roarT / ROAR_SEC;
      if (k >= 1) this.roarT = -1;
      else {
        const env = Math.sin(Math.min(1, k * 1.2) * Math.PI);
        headRot = Math.sin(this.roarT * 55) * 0.16 * env;
        const lift = Math.min(1, k * 6) * (1 - Math.max(0, (k - 0.75) / 0.25));
        headScaleX = LOOK.headScale * (1 + lift * 0.28 + Math.sin(this.roarT * 30) * 0.06 * env); // jaw "opens"
        headScaleY = LOOK.headScale * (1 + lift * 0.22);
        headY = 0;
      }
    }
    this.head.setRotation(headRot).setScale(headScaleX, headScaleY).setY(headY);
  }

  destroy(): void {
    this.setDizzy(false);
    this.bar.destroy();
    for (const e of this.extras) { this.scene.tweens.killTweensOf(e); e.destroy(); }
    this.extras.clear();
    this.root.destroy();
  }
}
