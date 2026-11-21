import Phaser from 'phaser';
import { MAP_BOSSES } from '../art/boss';
import { LASER_TEX, ensureLaserTextures } from '../art/dino';
import { DINO_RIG, type RigPart } from '../art/dinoRig';
import { DEPTH, DINO, DINO_LASER, DINO_RIDE, DINO_SMASH } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import type { INpcVehicle } from '../core/race';
import type { RaceMap, Vec2 } from '../core/types';
import { eyePositions } from './dinoLaser';

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

interface VehicleToss {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  start: Vec2;
  velocity: Vec2;
  angle: number;
  spin: number;
  length: number;
  width: number;
  elapsed: number;
}

/** Animated encounter avatar. Position and heading are driven by DinoSystem. */
export class Dino {
  readonly root: Phaser.GameObjects.Container;
  private legL: Phaser.GameObjects.Image;
  private legR: Phaser.GameObjects.Image;
  private tail?: Phaser.GameObjects.Image;
  private arms?: [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
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
  private stompT = 0;
  private readonly tosses: VehicleToss[] = [];
  private stars: Phaser.GameObjects.Image[] = [];
  private rider: Phaser.GameObjects.Image[] = [];
  private bar: Phaser.GameObjects.Container;
  private barFill: Phaser.GameObjects.Rectangle;
  private laserFx: { glow: Phaser.GameObjects.Image[]; beam: Phaser.GameObjects.Image[]; tip: Phaser.GameObjects.Image[] } | null = null;
  private readonly boss: (typeof MAP_BOSSES)[RaceMap];

  constructor(private scene: Phaser.Scene, x: number, y: number, angle: number, map: RaceMap) {
    this.boss = MAP_BOSSES[map];
    this.scale = DINO.length / DINO_RIG.length;
    this.root = scene.add.container(x, y).setScale(this.scale).setRotation(angle).setDepth(DEPTH.dino)
      .setName(this.boss.objectName);
    const sh = DINO_RIG.shadow;
    this.root.add(scene.add.image(sh.x, sh.y + 20, sh.key).setOrigin(sh.originX, sh.originY).setScale(1.25, 1.35).setAlpha(0.8));

    const rig = this.boss.rig;
    if (rig) {
      const { tex } = rig;
      this.legL = scene.add.image(rig.footX, -rig.footY, tex.foot);
      this.legR = scene.add.image(rig.footX, rig.footY, tex.foot).setFlipY(true);
      this.arms = [scene.add.image(rig.armX, -rig.armY, tex.arm), scene.add.image(rig.armX, rig.armY, tex.arm).setFlipY(true)];
      for (const arm of this.arms) arm.setOrigin(0.3, 0.5).setScale(0.9);
      this.body = scene.add.image(0, 0, tex.body);
      this.head = scene.add.image(rig.headX, 0, tex.head).setOrigin(0.25, 0.5);
      this.parts = [this.legL, this.legR, ...this.arms, this.body, this.head];
      this.root.add(this.parts);
    } else {
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
      ensureLaserTextures(scene);
    }

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

  /** The rider's own car sitting on the dino's back (null = nobody). Lives inside the root, so it turns with the dino. */
  setRider(texture: string | null, color = 0xffffff, carSize?: { length: number; width: number }): void {
    for (const im of this.rider) im.destroy();
    this.rider = [];
    if (!texture) return;
    const k = DINO_RIDE.riderScale / this.scale;
    const len = (carSize?.length ?? 72) * k, wid = (carSize?.width ?? 40) * k;
    const shadow = this.scene.add.image(-6 / this.scale, 10 / this.scale, TEX.carShadow).setDisplaySize(len * 1.1, wid * 1.25).setAlpha(0.45);
    const ring = this.scene.add.image(-10, 0, TEX.fxRing).setTint(color).setAlpha(0.9);
    ring.setScale((len * 0.9) / Math.max(1, ring.width));
    const car = this.scene.add.image(-10, 0, texture).setDisplaySize(len, wid);
    this.rider = [shadow, ring, car];
    this.root.add(this.rider);
  }

  /** Hide the boss body (the crystal replaces it); tosses and effects keep running. */
  hideBody(): void {
    this.root.setVisible(false);
    this.bar.setVisible(false);
    this.setDizzy(false);
    this.setLaser(0, false, 0);
  }

  /** Cartoon "poof": smoke, confetti and stars. Hides the dino itself. */
  poof(): void {
    this.root.setVisible(false);
    this.bar.setVisible(false);
    this.setDizzy(false);
    this.setRider(null);
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
    burst(TEX.fxConfetti, 36, 420, 1.6, 1500, this.boss.rig ? [this.boss.tint, 0xffd34d, 0xffffff] :
      [0xff5a5a, 0xffd34d, 0x5ad8ff, 0x7cfc5a, 0xff7ae0], 90);
    burst(TEX.fxStar, 10, 340, 1.3, 1300, [0xffe14d, 0xffffff], 0);
  }

  get x() { return this.root.x; }
  get y() { return this.root.y; }
  get angle() { return this.root.rotation; }


  /** World positions of the two eyes. */
  eyes(): [Vec2, Vec2] {
    const k = this.scale * this.mult;
    const rig = this.boss.rig ?? DINO_LASER;
    if (this.boss.rig && this.boss.objectName !== 'rock-monster') {
      const cos = Math.cos(this.head.rotation), sin = Math.sin(this.head.rotation);
      const eyeX = (rig.eyeFwd - this.boss.rig.headX) * this.head.scaleX;
      const eyeY = rig.eyeSide * this.head.scaleY;
      const forward = Math.cos(this.angle), side = Math.sin(this.angle);
      const worldEye = (y: number) => {
        const localX = this.head.x + eyeX * cos - y * sin;
        const localY = this.head.y + eyeX * sin + y * cos;
        return { x: this.x + k * (localX * forward - localY * side), y: this.y + k * (localX * side + localY * forward) };
      };
      return [worldEye(-eyeY), worldEye(eyeY)];
    }
    return eyePositions(this.root.x, this.root.y, this.angle, rig.eyeFwd * k, rig.eyeSide * k);
  }

  private makeLaserFx() {
    const mk = (key: string, n: number, blend = true) => Array.from({ length: n }, () => {
      const im = this.scene.add.image(0, 0, key).setDepth(DEPTH.fx).setVisible(false);
      if (blend) im.setBlendMode(Phaser.BlendModes.ADD);
      return im;
    });
    const tex = this.boss.rig?.tex ?? LASER_TEX;
    this.laserFx = { glow: mk(tex.glow, 2), beam: mk(tex.beam, 2, false), tip: mk(tex.glow, 2) };
    for (const b of this.laserFx.beam) b.setOrigin(0, 0.5);
    return this.laserFx;
  }

  /**
   * Laser visuals. charge 0..1 = eyes glow + faint aim line toward `aim`; firing = bright beams along `aim`.
   * Pass charge 0 and firing false to hide everything.
   */
  setLaser(charge: number, firing: boolean, aim: number): void {
    if (!this.laserFx && charge <= 0 && !firing) return;
    const fx = this.laserFx ?? this.makeLaserFx();
    const on = charge > 0 || firing;
    const eyes = this.eyes();
    const pulse = 1 + Math.sin(this.t * 40) * 0.12;
    for (let i = 0; i < 2; i++) {
      const e = eyes[i];
      const gs = firing ? 1.5 * pulse : 0.45 + charge * 1.0 + Math.sin(this.t * 24) * 0.06 * charge;
      fx.glow[i].setVisible(on).setPosition(e.x, e.y).setScale(gs).setAlpha(firing ? 1 : 0.35 + 0.65 * charge);
      const beam = fx.beam[i];
      if (!on) { beam.setVisible(false); fx.tip[i].setVisible(false); continue; }
      const len = DINO_LASER.length;
      const w = firing ? DINO_LASER.drawWidth * pulse : 5 + charge * 5;
      beam.setVisible(true).setPosition(e.x, e.y).setRotation(aim).setDisplaySize(len, w).setAlpha(firing ? 1 : 0.25 + 0.3 * charge);
      fx.tip[i].setVisible(firing).setPosition(e.x + Math.cos(aim) * len, e.y + Math.sin(aim) * len).setScale(0.9 * pulse).setAlpha(0.9);
    }
  }

  /** Little star burst where a beam zapped something. */
  zap(x: number, y: number): void {
    const star = this.scene.add.image(x, y, TEX.fxStar).setDepth(DEPTH.fx).setTint(this.boss.tint).setScale(0.5);
    this.extras.add(star);
    this.scene.tweens.add({
      targets: star, scale: 1.6, alpha: 0, rotation: 1.5, duration: 380, ease: 'Cubic.easeOut',
      onComplete: () => { this.extras.delete(star); star.destroy(); },
    });
  }

  /** World position of the mouth. */
  mouth(): { x: number; y: number } {
    const reach = (this.boss.rig ? this.boss.rig.headX + 110 : LOOK.headX + 0.88 * 140 * LOOK.headScale) * this.scale;
    return { x: this.root.x + Math.cos(this.angle) * reach, y: this.root.y + Math.sin(this.angle) * reach };
  }

  /** World position of a foot (side -1 left, 1 right). */
  foot(side: -1 | 1): { x: number; y: number } {
    const a = this.angle, c = Math.cos(a), s = Math.sin(a);
    const lx = (this.boss.rig?.footX ?? -8) * this.scale;
    const ly = side * (this.boss.rig?.footY ?? LOOK.legY) * this.scale;
    return { x: this.root.x + c * lx - s * ly, y: this.root.y + s * lx + c * ly };
  }

  setPose(x: number, y: number, angle: number): void {
    this.root.setPosition(x, y).setRotation(angle + this.wobble);
    this.bar.setPosition(x, y - DINO.barOffset);
  }

  get roaring() { return this.roarT >= 0; }

  roar(text = 'ROAAAR!', color = this.boss.color): void {
    this.roarT = 0;
    const m = this.mouth();
    for (let i = 0; i < 3; i++) {
      const tint = i === 1 ? 0xfff4d5 : this.boss.tint;
      const ring = this.scene.add.image(m.x, m.y, TEX.fxRing).setDepth(DEPTH.fx).setTint(tint)
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
      const d = this.scene.add.image(x, y, TEX.fxDust).setDepth(DEPTH.fx).setAlpha(0.7).setScale(0.6 + Math.random() * 0.4)
      .setTint(this.boss.objectName === 'rock-monster' ? 0xb5a4d5 : 0xd8c8a0);
      this.extras.add(d);
      this.scene.tweens.add({
        targets: d, x: x + Math.cos(a) * 60, y: y + Math.sin(a) * 60, scale: d.scale * 2.4, alpha: 0,
        duration: 600, ease: 'Quad.easeOut',
        onComplete: () => { this.extras.delete(d); d.destroy(); },
      });
    }
  }

  smash(x: number, y: number): void {
    this.stompT = DINO_SMASH.stompAnimationSec;
    const ring = this.scene.add.image(x, y, TEX.fxRing).setDepth(DEPTH.fx).setTint(0xffd670).setScale(0.25);
    this.extras.add(ring);
    this.scene.tweens.add({
      targets: ring, scale: 1.4, alpha: 0, duration: 260, ease: 'Cubic.easeOut',
      onComplete: () => { this.extras.delete(ring); ring.destroy(); },
    });
    this.dust(x, y);
  }

  /** Keep a visual of the old chassis while the NPC slot and its collider are released. */
  toss(npc: INpcVehicle, normal: Vec2, speedMult = 1): void {
    const { x, y, angle, spec } = npc;
    const speed = DINO_SMASH.npcLaunchSpeed * speedMult * (npc.npcKind === 'truck' ? DINO_SMASH.truckSpeedMult : 1);
    const shadow = this.scene.add.image(x, y, TEX.carShadow).setDepth(DEPTH.shadow)
      .setDisplaySize(spec.length, spec.width).setAlpha(0.35).setRotation(angle);
    const sprite = this.scene.add.image(x, y, npc.appearanceKey).setDepth(DEPTH.fx)
      .setDisplaySize(spec.length, spec.width).setRotation(angle);
    const side = Math.cos(this.angle) * normal.y - Math.sin(this.angle) * normal.x;
    this.tosses.push({
      sprite, shadow, start: { x, y }, velocity: { x: normal.x * speed, y: normal.y * speed },
      angle, spin: Math.sign(side || 1) * Math.PI * 1.5, length: spec.length, width: spec.width, elapsed: 0,
    });
    this.smash(x, y);
  }

  updateTosses(dt: number): void {
    for (let i = this.tosses.length - 1; i >= 0; i--) {
      const flight = this.tosses[i];
      const { sprite, shadow, start, velocity, length, width } = flight;
      flight.elapsed += dt;
      const airtime = Math.min(flight.elapsed, DINO_SMASH.npcAirSec);
      const t = airtime / DINO_SMASH.npcAirSec;
      const height = 4 * t * (1 - t);
      const x = start.x + velocity.x * airtime, y = start.y + velocity.y * airtime;
      const angle = flight.angle + flight.spin * t;
      shadow.setPosition(x, y).setRotation(angle).setAlpha(0.35 - height * 0.2);
      if (t < 1) {
        const scale = 1 + DINO_SMASH.npcPeakScale * height;
        sprite.setPosition(x, y - DINO_SMASH.npcPeakHeight * height).setRotation(angle)
          .setDisplaySize(length * scale, width * scale);
        continue;
      }
      const squash = (flight.elapsed - DINO_SMASH.npcAirSec) / DINO_SMASH.npcSquashSec;
      if (squash >= 1) {
        sprite.destroy();
        shadow.destroy();
        this.dust(x, y);
        this.tosses.splice(i, 1);
      } else {
        sprite.setPosition(x, y).setRotation(angle)
          .setDisplaySize(length * (1 + 0.18 * squash), width * (1 - 0.85 * squash)).setAlpha(1 - squash);
      }
    }
  }

  /** speedFrac 0..1 (walking vs looking around). */
  update(dt: number, moveDist: number, walking: boolean): void {
    this.t += dt;
    this.stompT = Math.max(0, this.stompT - dt);
    const stomp = Math.sin(Math.PI * this.stompT / DINO_SMASH.stompAnimationSec);
    if (this.tintT > 0) {
      this.tintT -= dt;
      for (const p of this.parts) { if (this.tintT > 0) p.setTint(0xff6a6a); else p.clearTint(); }
    }
    if (this.stars.length > 0) {
      const headX = this.boss.rig?.headX ?? LOOK.headX;
      const hx = this.root.x + Math.cos(this.angle) * headX * this.scale * this.mult;
      const hy = this.root.y + Math.sin(this.angle) * headX * this.scale * this.mult;
      this.stars.forEach((st, i) => {
        const a = this.t * 4 + (i * Math.PI) / 2;
        st.setPosition(hx + Math.cos(a) * 110, hy + Math.sin(a) * 110).setRotation(a * 2);
      });
    }
    if (walking) this.phase += moveDist / 55; // one leg frame per ~55 world px of stride
    const rig = this.boss.rig;
    if (rig && this.arms) {
      const stride = Math.sin(this.phase * Math.PI / 2);
      const sway = Math.sin(this.t * 2.6);
      if (this.boss.objectName === 'landshark') {
        // The rear wheels are fixed to the chassis. The fins sway as the shark rolls.
        this.legL.setRotation(0);
        this.legR.setRotation(0);
      } else if (this.boss.objectName === 'thundercloud') {
        this.legL.setX(rig.footX + sway * 12).setRotation(sway * 0.08);
        this.legR.setX(rig.footX - sway * 12).setRotation(-sway * 0.08);
      } else {
        this.legL.setX(rig.footX + stride * 28).setRotation(stride * 0.12);
        this.legR.setX(rig.footX - stride * 28).setRotation(stride * 0.12);
      }
      this.arms[0].setX(rig.armX - stride * 19 + stomp * 20).setRotation(-0.12 + sway * 0.03 + stride * 0.1);
      this.arms[1].setX(rig.armX + stride * 19 + stomp * 20).setRotation(0.12 - sway * 0.03 + stride * 0.1);
    } else {
      const frames = DINO_RIG.legs.frames;
      const f = Math.floor(this.phase);
      this.legL.setTexture(frames[((f % 4) + 4) % 4]);
      this.legR.setTexture(frames[((f + DINO_RIG.legs.rightPhaseOffset) % 4 + 4) % 4]);
    }

    this.looking += ((walking ? 0 : 1) - this.looking) * Math.min(1, dt * 5);
    const wag = DINO_RIG.tailWag * (walking ? 1.4 : 0.8);
    this.tail?.setRotation(Math.sin(this.t * (walking ? 4.2 : 2.2)) * wag);
    const baseY = rig ? 1 : LOOK.bodyScaleY;
    this.body.setScale(LOOK.bodyScaleX * (1 + Math.sin(this.t * 3.1) * 0.015 - stomp * 0.09),
      baseY * (1 + Math.sin(this.t * 3.1) * 0.02 + stomp * 0.12));

    let headRot = Math.sin(this.t * 2.6) * 0.06 + Math.sin(this.t * 1.1) * 0.35 * this.looking;
    const baseHeadScale = rig ? 1 : LOOK.headScale;
    let headScaleX = baseHeadScale;
    let headScaleY = baseHeadScale;
    let headY = Math.sin(this.t * (walking ? 7 : 3)) * 4;
    if (this.roarT >= 0) {
      this.roarT += dt;
      const k = this.roarT / ROAR_SEC;
      if (k >= 1) this.roarT = -1;
      else {
        const env = Math.sin(Math.min(1, k * 1.2) * Math.PI);
        headRot = Math.sin(this.roarT * 55) * 0.16 * env;
        const lift = Math.min(1, k * 6) * (1 - Math.max(0, (k - 0.75) / 0.25));
        headScaleX = baseHeadScale * (1 + lift * 0.28 + Math.sin(this.roarT * 30) * 0.06 * env); // jaw "opens"
        headScaleY = baseHeadScale * (1 + lift * 0.22);
        headY = 0;
      }
    }
    const headX = rig?.headX ?? LOOK.headX;
    this.head.setRotation(headRot).setScale(headScaleX, headScaleY).setY(headY).setX(headX + stomp * 26);
  }

  destroy(): void {
    this.setDizzy(false);
    if (this.laserFx) for (const l of [...this.laserFx.glow, ...this.laserFx.beam, ...this.laserFx.tip]) l.destroy();
    this.laserFx = null;
    this.bar.destroy();
    for (const e of this.extras) { this.scene.tweens.killTweensOf(e); e.destroy(); }
    this.extras.clear();
    for (const { sprite, shadow } of this.tosses) { sprite.destroy(); shadow.destroy(); }
    this.tosses.length = 0;
    this.root.destroy();
  }
}
