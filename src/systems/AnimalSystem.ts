import Phaser from 'phaser';
import { ANIMALS, CAT, DEPTH } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import type { BodyOwner, GameSystem, RaceContext } from '../core/race';
import { ownerOf } from '../core/race';
import type { Rng } from '../core/rng';
import { services } from '../core/services';
import {
  dist, launchDir, newAnimal, startFlee, startFlight, stepFlight, stepGround, walkFrame, type AnimalAI,
} from '../entities/animalAI';
import { isDrivable } from '../world/geometry';

const STEP_HZ = 60;
const HIT_MASK = CAT.player | CAT.traffic | CAT.police;
/** Fake launch speed (px/s) when the dino stomps/bumps an animal. */
const DINO_LAUNCH_SPEED = 320;

interface PairLike { bodyA: MatterJS.BodyType; bodyB: MatterJS.BodyType }

interface AnimalView {
  ai: AnimalAI;
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  body: MatterJS.BodyType;
  frames: readonly string[];
  tumble: string;
  tex: string;
  active: boolean;
  phase: number;
}

/**
 * Farm animals: wander/graze inside their zone rects, are light obstacles, and fly off cartoon-style when a vehicle
 * (or the dino) hits them. Active only when the world has a farm layout. Nothing is ever hurt or destroyed.
 */
export class AnimalSystem implements GameSystem {
  readonly name = 'animals';
  static order = 90;
  private ctx!: RaceContext;
  private rng!: Rng;
  private views: AnimalView[] = [];
  private bySprite = new Map<Phaser.GameObjects.GameObject, AnimalView>();
  private offRoar: (() => void) | null = null;
  private ambientT = 0;
  private clock = 0;
  private enabled = false;
  private handler = (event: { pairs: PairLike[] }) => this.onCollide(event.pairs);

  init(ctx: RaceContext): void {
    this.ctx = ctx;
    const farm = ctx.world.farm;
    if (!farm) return;
    this.enabled = true;
    this.rng = ctx.rng.fork(0xa17a);
    const M = ctx.scene.matter;
    for (const zone of farm.animalZones) {
      const group: AnimalView[] = [];
      for (let i = 0; i < zone.count; i++) {
        const ai = newAnimal(this.rng, zone.kind, zone, zone.fenced);
        const v = this.makeView(ai);
        group.push(v);
        this.views.push(v);
      }
      if (zone.kind === 'duck' && group.length > 1) {
        group.forEach((v, i) => { if (i > 0) { v.ai.leader = group[0].ai; v.ai.rank = i; } });
      }
    }
    M.world.on(Phaser.Physics.Matter.Events.COLLISION_START, this.handler);
    this.offRoar = ctx.bus.on('dino:roar', (e) => this.onRoar(e.x, e.y));
    this.ambientT = this.rng.range(ANIMALS.ambientSecMin, ANIMALS.ambientSecMax);
    (globalThis as unknown as { __animals?: unknown }).__animals = this.views;
  }

  private makeView(ai: AnimalAI): AnimalView {
    const s = this.ctx.scene;
    const frames = TEX.farm[ai.kind];
    const tumble = TEX.farm[`${ai.kind}Tumble` as const];
    const sprite = s.add.image(ai.x, ai.y, frames[0]).setDepth(DEPTH.vehicle - 2).setRotation(ai.angle);
    const shadow = s.add.image(ai.x, ai.y, TEX.fxDust).setTint(0x000000).setAlpha(0).setDepth(DEPTH.shadow + 1).setVisible(false);
    const spec = ANIMALS.kinds[ai.kind];
    const body = s.matter.add.circle(ai.x, ai.y, spec.radius, {
      mass: 1, frictionAir: 0, friction: 0, frictionStatic: 0, restitution: 0.1,
      collisionFilter: { category: CAT.prop, mask: HIT_MASK, group: 0 },
    }) as unknown as MatterJS.BodyType & { plugin: { owner?: BodyOwner } };
    const owner: BodyOwner = { kind: 'animal', animal: sprite };
    (body as { plugin: { owner?: BodyOwner } }).plugin = { ...(body.plugin ?? {}), owner };
    const v: AnimalView = { ai, sprite, shadow, body, frames, tumble, tex: frames[0], active: false, phase: this.rng.range(0, 6.28) };
    this.bySprite.set(sprite, v);
    return v;
  }

  destroy(): void {
    if (!this.enabled) return;
    this.ctx.scene.matter?.world?.off(Phaser.Physics.Matter.Events.COLLISION_START, this.handler);
    this.offRoar?.();
    this.offRoar = null;
    for (const v of this.views) {
      try { this.ctx.scene.matter?.world?.remove(v.body); } catch { /* world already gone */ }
      v.sprite.destroy();
      v.shadow.destroy();
    }
    this.views = [];
    this.bySprite.clear();
    this.enabled = false;
    (globalThis as unknown as { __animals?: unknown }).__animals = undefined;
  }

  // ---- events -------------------------------------------------------------------------------------------------

  private onCollide(pairs: PairLike[]): void {
    for (const pair of pairs) {
      const oa = ownerOf(pair.bodyA), ob = ownerOf(pair.bodyB);
      if (!oa || !ob) continue;
      const animalOwner = oa.kind === 'animal' ? oa : ob.kind === 'animal' ? ob : null;
      if (!animalOwner) continue;
      const other = animalOwner === oa ? ob : oa;
      const v = this.bySprite.get(animalOwner.animal);
      if (!v || v.ai.mode === 'fly' || v.ai.mode === 'daze') continue;
      let veh: { x: number; y: number; angle: number; forwardSpeed: number } | null = null;
      let player: number | null = null;
      if (other.kind === 'player') { veh = other.car; player = other.player; }
      else if (other.kind === 'npc') veh = other.npc;
      if (!veh) continue;
      const speed = Math.abs(veh.forwardSpeed);
      if (speed < ANIMALS.hitMinSpeed) {
        startFlee(this.rng, v.ai, veh.x, veh.y, ANIMALS.fleeSec * 0.6);
        continue;
      }
      const sign = veh.forwardSpeed >= 0 ? 1 : -1;
      this.launch(v, veh.x, veh.y, Math.cos(veh.angle) * sign, Math.sin(veh.angle) * sign, speed, player);
    }
  }

  private onRoar(x: number, y: number): void {
    for (const v of this.views) {
      if (v.ai.mode === 'fly' || v.ai.mode === 'daze') continue;
      if (dist(v.ai.x, v.ai.y, x, y) < ANIMALS.roarRadius) startFlee(this.rng, v.ai, x, y, ANIMALS.roarFleeSec);
    }
  }

  private launch(v: AnimalView, cx: number, cy: number, dirX: number, dirY: number, speed: number, player: number | null): void {
    const a = v.ai;
    const d = launchDir(a.x, a.y, cx, cy, dirX, dirY);
    const world = this.ctx.world;
    const W = world.widthTiles * world.tileSize, H = world.heightTiles * world.tileSize;
    startFlight(a, d.x, d.y, speed, (x, y) => x > 20 && y > 20 && x < W - 20 && y < H - 20 && isDrivable(world, x, y));
    v.body.collisionFilter.mask = 0;
    v.sprite.setTexture(v.tumble).setDepth(DEPTH.airborne);
    v.tex = v.tumble;
    const twoP = this.ctx.players.length > 1;
    const pan = player === null || !twoP ? 0 : player === 0 ? -0.6 : 0.6;
    services.audio.sfx(ANIMALS.sfx[a.kind], { pan, volume: 1 });
    this.burst(a.x, a.y, true);
  }

  // ---- per frame ----------------------------------------------------------------------------------------------

  update(dtSec: number, ctx: RaceContext): void {
    if (!this.enabled || ctx.paused || ctx.questionBreak) return;
    const dt = Math.min(dtSec, 0.05);
    this.clock += dt;
    const players = ctx.players;
    const r2 = ANIMALS.activeRadius * ANIMALS.activeRadius;
    const dino = ctx.dino;
    const scareR = ANIMALS.scareRadius;

    for (const v of this.views) {
      const a = v.ai;
      const flying = a.mode === 'fly' || a.mode === 'daze';
      let near = flying;
      if (!near) for (const p of players) {
        const dx = p.x - a.x, dy = p.y - a.y;
        if (dx * dx + dy * dy < r2) { near = true; break; }
      }
      v.active = near;
      if (!near) continue; // frozen: sprite and body stay as they were

      if (!flying) {
        // scurry aside from a fast car heading our way
        if (a.mode === 'graze' || a.mode === 'walk') this.checkScare(v, scareR);
        // the (ridden or wild) dino bowls animals over
        if (dino.active && dist(a.x, a.y, dino.x, dino.y) < dino.radius + ANIMALS.kinds[a.kind].radius + 6) {
          this.launch(v, dino.x, dino.y, a.x - dino.x, a.y - dino.y, DINO_LAUNCH_SPEED, null);
        }
      }

      if (a.mode === 'fly') {
        const p = stepFlight(a, dt);
        v.sprite.setPosition(p.x, p.y).setScale(p.scale).setRotation(a.angle + p.spin);
        const sh = v.shadow;
        sh.setVisible(true).setPosition(p.x, p.y).setAlpha(0.35 * (1 - p.height * 0.5))
          .setScale(ANIMALS.kinds[a.kind].w / 22, ANIMALS.kinds[a.kind].h / 26 * (1 - p.height * 0.3));
        if ((a.mode as string) !== 'fly') this.onLanded(v);
      } else if (a.mode === 'daze') {
        stepGround(this.rng, a, dt);
        const p = Math.sin(this.clock * 30 + v.phase) * 0.18;
        const b = ANIMALS.launch.landBounceSec;
        const bh = a.t < b ? 4 * (a.t / b) * (1 - a.t / b) * 0.18 : 0; // continue the landing bounce
        v.sprite.setPosition(a.x, a.y).setScale(1 + bh).setRotation(a.angle + p);
        if ((a.mode as string) !== 'daze') this.recover(v);
      } else {
        stepGround(this.rng, a, dt);
        this.pose(v);
      }
      if (a.mode !== 'fly') v.shadow.setVisible(false);
      // keep the physics body on the sprite; velocity is ours, not Matter's
      const M = this.ctx.scene.matter;
      M.body.setPosition(v.body, { x: a.x, y: a.y }, false);
      M.body.setVelocity(v.body, { x: 0, y: 0 });
    }

    this.ambient(dt);
  }

  private pose(v: AnimalView): void {
    const a = v.ai;
    const f = v.frames[walkFrame(a)];
    if (f !== v.tex) { v.sprite.setTexture(f); v.tex = f; }
    let sx = 1, sy = 1, rot = a.angle;
    if (a.mode === 'graze') {
      // head-down bob; chickens peck quickly
      const fast = a.kind === 'chicken';
      const w = Math.sin(this.clock * (fast ? 16 : 3) + v.phase);
      sy = 1 + w * (fast ? 0.08 : 0.025);
      rot += w * (fast ? 0.12 : 0.03);
    } else if (a.kind === 'duck' || a.kind === 'chicken') {
      rot += Math.sin(a.walked * 0.5) * 0.15; // waddle
    }
    v.sprite.setPosition(a.x, a.y).setScale(sx, sy).setRotation(rot);
  }

  private checkScare(v: AnimalView, scareR: number): void {
    const a = v.ai;
    const check = (x: number, y: number, vx: number, vy: number, speed: number): boolean => {
      if (speed < ANIMALS.scareSpeed) return false;
      const dx = a.x - x, dy = a.y - y, d = Math.hypot(dx, dy);
      if (d > scareR || d < 1) return false;
      return (dx * vx + dy * vy) / (d * speed) > 0.5; // car is heading toward us
    };
    for (const p of this.ctx.players) {
      if (p.riding || p.airborne) continue;
      if (check(p.x, p.y, p.velocity.x * STEP_HZ, p.velocity.y * STEP_HZ, Math.hypot(p.velocity.x, p.velocity.y) * STEP_HZ)) {
        startFlee(this.rng, a, p.x, p.y, ANIMALS.fleeSec);
        return;
      }
    }
    for (const n of this.ctx.npcs) {
      if (n.destroyed) continue;
      if (check(n.x, n.y, n.velocity.x * STEP_HZ, n.velocity.y * STEP_HZ, Math.hypot(n.velocity.x, n.velocity.y) * STEP_HZ)) {
        startFlee(this.rng, a, n.x, n.y, ANIMALS.fleeSec);
        return;
      }
    }
  }

  private onLanded(v: AnimalView): void {
    v.sprite.setDepth(DEPTH.vehicle - 2).setScale(1);
    v.shadow.setVisible(false);
    this.burst(v.ai.x, v.ai.y, false);
  }

  private recover(v: AnimalView): void {
    v.body.collisionFilter.mask = HIT_MASK;
    v.sprite.setScale(1);
    const f = v.frames[0];
    v.sprite.setTexture(f); v.tex = f;
  }

  /** Dust puff (landing) or star + dust + feather burst (hit). Short-lived images, pooled by the tween manager. */
  private burst(x: number, y: number, hit: boolean): void {
    const s = this.ctx.scene;
    const n = hit ? 7 : 4;
    for (let i = 0; i < n; i++) {
      const tex = hit ? (i % 3 === 0 ? TEX.fxStar : i % 3 === 1 ? TEX.fxDust : TEX.fxConfetti) : TEX.fxDust;
      const tint = tex === TEX.fxStar ? 0xffe14d : tex === TEX.fxConfetti ? 0xffffff : 0xd8c8a8;
      const ang = (i / n) * Math.PI * 2 + this.rng.range(0, 0.6);
      const d = this.rng.range(30, hit ? 90 : 55);
      const img = s.add.image(x, y, tex).setTint(tint).setDepth(DEPTH.fx).setScale(hit ? 0.7 : 0.9).setRotation(ang);
      s.tweens.add({
        targets: img, x: x + Math.cos(ang) * d, y: y + Math.sin(ang) * d, alpha: 0, scale: hit ? 1.1 : 1.5,
        duration: hit ? 600 : 380, ease: 'Quad.easeOut', onComplete: () => img.destroy(),
      });
    }
  }

  private ambient(dt: number): void {
    this.ambientT -= dt;
    if (this.ambientT > 0) return;
    this.ambientT = this.rng.range(ANIMALS.ambientSecMin, ANIMALS.ambientSecMax);
    const R = ANIMALS.ambientRange;
    const near: AnimalView[] = [];
    for (const v of this.views) {
      if (!v.active || v.ai.mode === 'fly') continue;
      for (const p of this.ctx.players) if (dist(v.ai.x, v.ai.y, p.x, p.y) < R) { near.push(v); break; }
    }
    if (!near.length) return;
    const v = this.rng.pick(near);
    services.audio.sfx(ANIMALS.sfx[v.ai.kind], { volume: 0.35 });
  }
}
