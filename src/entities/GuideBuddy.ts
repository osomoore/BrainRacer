import Phaser from 'phaser';
import { DEPTH, GUIDE } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import type { RaceContext } from '../core/race';
import type { CarKind, PlayerId, Vec2 } from '../core/types';
import { stepFly, type FlyState } from './guideMath';

const FLAP = [0, 1, 2, 1];
const wrapPi = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

interface Puff {
  img: Phaser.GameObjects.Image; alive: boolean; t: number; life: number;
  s0: number; s1: number; a0: number; vx: number; vy: number; spin: number; twinkle: boolean;
}

export interface CarMotion { x: number; y: number; vx: number; vy: number; angle: number }

/**
 * One guide buddy: a flying dino (dino car) or a shining star (kart). World-space, drawn above cars and
 * buildings, visible only in its own player's view. Flight uses guideMath.stepFly; the trail is a fixed pool.
 */
export class GuideBuddy {
  private readonly fly: FlyState = { x: 0, y: 0, vx: 0, vy: 0 };
  private readonly isDino: boolean;
  private readonly body: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Image;
  private readonly puffs: Puff[] = [];
  private cursor = 0;
  private placed = false;
  private t = 0;
  private heading = 0;
  private bank = 0;
  private trailT = 0;
  private sparkT = 0;
  private colorI = 0;
  private flashT = 0;
  private happy = false;

  constructor(private readonly ctx: RaceContext, private readonly player: PlayerId, kind: CarKind) {
    const s = ctx.scene;
    this.isDino = kind === 'dino';
    this.shadow = s.add.image(0, 0, TEX.carShadow).setDepth(DEPTH.shadow).setAlpha(GUIDE.shadowAlpha).setVisible(false);
    for (let i = 0; i < GUIDE.trailPool; i++) {
      const img = s.add.image(0, 0, TEX.buddyGlow).setDepth(GUIDE.depthTrail).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
      this.puffs.push({ img, alive: false, t: 0, life: 1, s0: 1, s1: 0, a0: 1, vx: 0, vy: 0, spin: 0, twinkle: false });
    }
    this.glow = s.add.image(0, 0, TEX.buddyGlow).setDepth(GUIDE.depthGlow).setBlendMode(Phaser.BlendModes.ADD)
      .setTint(this.isDino ? 0xff5fb0 : 0xffd84a).setVisible(false);
    this.body = s.add.image(0, 0, this.isDino ? TEX.buddyDino[0] : TEX.buddyStar).setDepth(GUIDE.depthBody).setVisible(false);
    for (const o of [this.shadow, this.glow, this.body, ...this.puffs.map((p) => p.img)]) ctx.camera.showOnlyTo(o, player);
  }

  setHappy(on: boolean) { this.happy = on; }

  redirect(target: Vec2): void {
    if (!this.placed) return;
    this.fly.vx = this.fly.vy = 0;
    this.heading = Math.atan2(target.y - this.fly.y, target.x - this.fly.x);
  }

  update(dt: number, target: Vec2, car: CarMotion) {
    if (!this.placed) {
      this.fly.x = target.x;
      this.fly.y = target.y;
      this.heading = car.angle;
      this.placed = true;
    }
    this.t += dt;
    const t = this.t;
    stepFly(this.fly, target, { x: car.vx, y: car.vy }, dt, GUIDE);
    // gentle hover bob on top of the flight
    const bob = Math.sin(t * Math.PI * 2 * GUIDE.bobHz) * GUIDE.bobAmp;
    const hx = this.fly.x + Math.cos(t * 2.1) * GUIDE.bobAmp * 0.5;
    const hy = this.fly.y + bob;

    // heading follows the buddy's velocity relative to the car when moving, else the car's facing
    const speed = Math.hypot(this.fly.vx, this.fly.vy);
    const want = speed > 90 ? Math.atan2(this.fly.vy, this.fly.vx) : car.angle;
    const diff = wrapPi(want - this.heading);
    this.heading += diff * Math.min(1, dt * 7);
    this.bank += (Math.max(-1, Math.min(1, diff * 2.2)) - this.bank) * Math.min(1, dt * 8);

    const sc = GUIDE.bodyScale * (this.happy ? 1.15 : 1);
    this.body.setVisible(true).setPosition(hx, hy);
    this.glow.setVisible(true).setPosition(hx, hy);
    const sh = GUIDE.shadowScale * (1 - bob * 0.012);
    this.shadow.setVisible(true).setPosition(hx + 6, hy + 10).setScale(sh, sh * 0.8).setRotation(this.heading);

    if (this.isDino) {
      const fps = this.happy ? GUIDE.dinoFlapFpsHappy : GUIDE.dinoFlapFps;
      this.body.setTexture(TEX.buddyDino[FLAP[Math.floor(t * fps) % 4]])
        .setRotation(this.heading).setScale(sc, sc * (1 - Math.abs(this.bank) * 0.22));
      this.glow.setScale(1.1 + (this.happy ? 0.3 : 0)).setAlpha(0.5 + 0.12 * Math.sin(t * 6));
    } else {
      const pulse = 1 + 0.13 * Math.sin(t * GUIDE.starBlinkHz) + (this.happy ? 0.12 * Math.sin(t * 14) : 0);
      this.flashT -= dt;
      if (this.flashT < -GUIDE.starFlashEverySec) this.flashT = 0.1;
      if (this.flashT > 0) this.body.setTintFill(0xffffff); else this.body.clearTint();
      // stay upright on screen: cancel the view rotation, plus a friendly wobble
      this.body.setRotation(-this.ctx.camera.viewRotation(this.player) + Math.sin(t * 3) * 0.18).setScale(sc * pulse);
      const tw = 0.5 + 0.35 * Math.sin(t * GUIDE.starBlinkHz) ** 2 + (this.flashT > 0 ? 0.3 : 0);
      this.glow.setScale(1.25 * pulse + (this.happy ? 0.4 : 0)).setAlpha(Math.min(1, tw));
    }

    this.trailT -= dt;
    if (this.trailT <= 0) { this.trailT += GUIDE.trailEverySec; this.emitTrail(hx, hy); }
    if (this.happy) {
      this.sparkT -= dt;
      if (this.sparkT <= 0) { this.sparkT = 0.07; this.emitSparkle(hx, hy); }
    }
    this.updatePuffs(dt);
  }

  private emitTrail(x: number, y: number) {
    const cols = this.isDino ? GUIDE.dinoColors : GUIDE.starColors;
    this.colorI = (this.colorI + 1) % cols.length;
    if (this.isDino) {
      // ribbon of pink / orange / yellow puffs from the tail
      const bx = x - Math.cos(this.heading) * 22, by = y - Math.sin(this.heading) * 22;
      this.spawn(bx, by, GUIDE.trailLife, 0.3, 0.05, 0.85, 0, 0, 0, cols[this.colorI], false, false);
    } else {
      const j = () => (Math.random() - 0.5) * 24;
      this.spawn(x + j(), y + j(), GUIDE.trailLife, 0.75, 0.1, 1, j() * 0.5, j() * 0.5, (Math.random() - 0.5) * 6, cols[this.colorI], true, true);
    }
  }

  private emitSparkle(x: number, y: number) {
    const a = Math.random() * Math.PI * 2, sp = 70 + Math.random() * 90;
    this.spawn(x, y, 0.7, 0.9, 0.1, 1, Math.cos(a) * sp, Math.sin(a) * sp, (Math.random() - 0.5) * 8,
      GUIDE.starColors[Math.floor(Math.random() * GUIDE.starColors.length)], true, true);
  }

  /** Spawn one pooled particle (oldest slot is recycled when the pool is full). Scales are texture-relative. */
  private spawn(x: number, y: number, life: number, s0: number, s1: number, a0: number, vx: number, vy: number, spin: number, tint: number, star: boolean, twinkle: boolean) {
    const pool = this.puffs;
    let p: Puff | undefined;
    for (let i = 0; i < pool.length; i++) {
      const c = pool[(this.cursor + i) % pool.length];
      if (!c.alive) { p = c; this.cursor = (this.cursor + i + 1) % pool.length; break; }
    }
    if (!p) { p = pool[this.cursor]; this.cursor = (this.cursor + 1) % pool.length; }
    p.alive = true; p.t = 0; p.life = life; p.s0 = s0; p.s1 = s1; p.a0 = a0; p.vx = vx; p.vy = vy; p.spin = spin; p.twinkle = twinkle;
    p.img.setTexture(star ? TEX.fxStar : TEX.buddyGlow)
      .setPosition(x, y).setTint(tint).setScale(s0).setAlpha(a0).setVisible(true).setRotation(star ? Math.random() * 6 : 0);
  }

  private updatePuffs(dt: number) {
    for (const p of this.puffs) {
      if (!p.alive) continue;
      p.t += dt;
      if (p.t >= p.life) { p.alive = false; p.img.setVisible(false); continue; }
      const k = p.t / p.life;
      p.img.x += p.vx * dt; p.img.y += p.vy * dt;
      p.img.rotation += p.spin * dt;
      const tw = p.twinkle ? 0.55 + 0.45 * Math.sin(p.t * 28) ** 2 : 1;
      p.img.setScale(p.s0 + (p.s1 - p.s0) * k).setAlpha(p.a0 * (1 - k) * tw);
    }
  }

  destroy() {
    this.body.destroy(); this.glow.destroy(); this.shadow.destroy();
    for (const p of this.puffs) p.img.destroy();
    this.puffs.length = 0;
  }
}
