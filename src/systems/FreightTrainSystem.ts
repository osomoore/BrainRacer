import Phaser from 'phaser';
import { CAT, DEPTH, FREIGHT } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import type { GameSystem, IVehicle, RaceContext } from '../core/race';
import { services } from '../core/services';
import { ParticlePool } from '../fx/ParticlePool';
import { ownerOf } from '../core/race';
import type { PlayerId } from '../core/types';
import { canReform, debrisVelocity, detachedFrom, shouldSmash } from './freightSmash';
import { carriagePose, crossingFrame, freightFrontAt, measureCircuit, type MeasuredCrossing, type RailCircuit } from './freightTiming';

interface TrainCar {
  image: Phaser.GameObjects.Image;
  body: MatterJS.BodyType;
  centerFromFront: number;
  smashedAt: number; // -1 = intact
  debris?: { image: Phaser.GameObjects.Image; body: MatterJS.BodyType; t: number };
}

interface PairLike {
  bodyA: MatterJS.BodyType;
  bodyB: MatterJS.BodyType;
  collision?: { normal?: { x: number; y: number } };
  normal?: { x: number; y: number };
}

/** Cosmetic cargo crate, baked once at runtime (not a contract TEX key). */
function bakeCrate(scene: Phaser.Scene): void {
  if (scene.textures.exists(FREIGHT.crateKey)) return;
  const tex = scene.textures.createCanvas(FREIGHT.crateKey, 28, 28)!;
  const c = tex.getContext();
  c.fillStyle = '#111b31'; c.fillRect(1, 1, 26, 26);
  c.fillStyle = '#c9944f'; c.fillRect(3, 3, 22, 22);
  c.fillStyle = '#8f6234'; c.fillRect(5, 12, 18, 4); c.fillRect(12, 5, 4, 18);
  tex.refresh();
}

const STEP_HZ = 60; // Matter velocity is px/step

interface Signal {
  image: Phaser.GameObjects.Image;
  crossing: MeasuredCrossing;
  lastFlash: number;
}

const VEHICLE_MASK = CAT.player | CAT.traffic | CAT.police;
const AXLE_INSET = 27; // Wheelset centers on both train textures.

export class FreightTrainSystem implements GameSystem {
  static order = 55;
  readonly name = 'freightTrain';
  private ctx!: RaceContext;
  private circuit?: RailCircuit;
  private signals: Signal[] = [];
  private cars: TrainCar[] = [];
  private length = 0;
  private pool!: ParticlePool;
  private rng!: RaceContext['rng'];
  private cooldown: number[] = [0, 0];
  private clockOffset = 0;
  private devNear = false;
  private devPlaced = false;
  private handler = (event: { pairs: PairLike[] }) => this.onStart(event.pairs);

  init(ctx: RaceContext): void {
    const rail = ctx.world.industrial?.rail;
    if (!rail) return;
    this.ctx = ctx;
    this.circuit = measureCircuit(rail);
    bakeCrate(ctx.scene);
    this.pool = new ParticlePool(ctx.scene, 120);
    this.rng = ctx.rng.fork(0xf7e16);
    this.devNear = new URLSearchParams(location.search).get('train') === 'near'; // dev hook
    if (this.devNear) (window as unknown as { __trainNear?: () => void }).__trainNear = () => { this.devPlaced = false; }; // re-aim after moving the player
    ctx.scene.matter.world.on(Phaser.Physics.Matter.Events.COLLISION_START, this.handler);
    const { scene } = ctx;
    this.signals = this.circuit.crossings.map((crossing, i) => {
      const { center, width, dx, dy } = crossing;
      const image = scene.add.image(center.x, center.y, TEX.industrial.crossing[0])
        .setName(`industrial-crossing-signal-${i}`)
        .setRotation(Math.atan2(dy, dx) + Math.PI / 2)
        .setDisplaySize(FREIGHT.signalRoadLength, width + 2 * FREIGHT.signalShoulder)
        .setDepth(DEPTH.vehicle + 1);
      return { crossing, image, lastFlash: -1 };
    });

    const front = freightFrontAt(this.circuit, ctx.elapsedSec + this.clockOffset);
    for (let i = 0; i <= FREIGHT.wagonCount; i++) {
      const engine = i === 0;
      const image = scene.add.image(0, 0, engine ? TEX.industrial.engine : TEX.industrial.freightCar)
        .setName(engine ? 'industrial-train-engine' : `industrial-train-car-${i}`)
        .setDepth(DEPTH.vehicle);
      const centerFromFront = this.length + image.width / 2;
      const pose = carriagePose(this.circuit, front - centerFromFront, image.width - 2 * AXLE_INSET);
      image.setPosition(pose.x, pose.y).setRotation(pose.angle);
      const body = scene.matter.add.rectangle(pose.x, pose.y, image.width, image.height, {
        label: image.name,
        isStatic: true,
        angle: pose.angle,
        friction: 0,
        frictionStatic: 0,
        restitution: 0.35,
        collisionFilter: { category: CAT.static, mask: VEHICLE_MASK, group: 0 },
        plugin: { owner: { kind: 'train' } },
      }) as unknown as MatterJS.BodyType;
      this.cars.push({ image, body, centerFromFront, smashedAt: -1 });
      this.length += image.width + (i < FREIGHT.wagonCount ? FREIGHT.carriageGap : 0);
    }
  }

  update(_dt: number, ctx: RaceContext): void {
    const circuit = this.circuit;
    if (!circuit) return;
    if (this.devNear && !this.devPlaced && ctx.players[0]) this.placeNear(ctx);
    const front = freightFrontAt(circuit, ctx.elapsedSec + this.clockOffset);
    for (let i = 0; i < this.cooldown.length; i++) this.cooldown[i] -= _dt;
    this.pool.update(_dt);
    for (const car of this.cars) {
      const { image, body, centerFromFront } = car;
      if (car.smashedAt >= 0) {
        this.updateDebris(car, _dt);
        const slot = carriagePose(circuit, front - centerFromFront, image.width - 2 * AXLE_INSET);
        if (!car.debris && canReform(ctx.elapsedSec, car.smashedAt, this.slotBlocked(ctx, slot, image.width))) this.reform(car, slot);
        continue;
      }
      const pose = carriagePose(circuit, front - centerFromFront, image.width - 2 * AXLE_INSET);
      ctx.scene.matter.body.setPosition(body, pose, true);
      // Phaser normalizes display rotation but Matter keeps the unbounded angle.
      const turn = Math.atan2(Math.sin(pose.angle - body.angle), Math.cos(pose.angle - body.angle));
      ctx.scene.matter.body.setAngle(body, body.angle + turn, true);
      image.setPosition(pose.x, pose.y).setRotation(pose.angle);
    }
    for (const signal of this.signals) {
      const { warningFlash, occupied } = crossingFrame(circuit, signal.crossing, front, this.length);
      this.updateSignal(signal, warningFlash);
      if (!occupied) continue;
      for (const car of ctx.players) if (!car.airborne) this.releaseFromCrossing(car, signal.crossing);
      for (const car of ctx.npcs) if (!car.destroyed) this.releaseFromCrossing(car, signal.crossing);
    }
  }

  destroy(): void {
    this.ctx?.scene.matter?.world?.off(Phaser.Physics.Matter.Events.COLLISION_START, this.handler);
    this.pool?.destroy();
    for (const { debris } of this.cars) if (debris) { this.ctx.scene.matter.world?.remove(debris.body); debris.image.destroy(); }
    for (const { image } of this.signals) image.destroy();
    for (const { image, body } of this.cars) {
      this.ctx.scene.matter.world?.remove(body);
      image.destroy();
    }
    this.signals.length = 0;
    this.cars.length = 0;
    this.length = 0;
    this.circuit = undefined;
  }

  private updateSignal(signal: Signal, flash: number): void {
    if (flash === signal.lastFlash) return;
    signal.lastFlash = flash;
    const lit = flash >= 0 && flash % 2 === 0;
    signal.image.setTexture(TEX.industrial.crossing[lit ? 1 : 0]);
    if (!lit) return;

    const { center } = signal.crossing;
    let closest = FREIGHT.soundRadius;
    let pan = 0;
    for (const player of this.ctx.players) {
      const distance = Math.hypot(player.x - center.x, player.y - center.y);
      if (distance >= closest) continue;
      closest = distance;
      pan = this.ctx.players.length === 1 ? 0 : player.player === 0 ? -0.6 : 0.6;
    }
    if (closest < FREIGHT.soundRadius) {
      services.audio.sfx('crossing', { pan, volume: FREIGHT.soundVolume * (1 - closest / FREIGHT.soundRadius) });
    }
  }

  private releaseFromCrossing(car: IVehicle, crossing: MeasuredCrossing): void {
    const dx = car.x - crossing.center.x, dy = car.y - crossing.center.y;
    if (Math.abs(dx * crossing.dx + dy * crossing.dy) > crossing.width / 2) return;
    const nx = -crossing.dy, ny = crossing.dx;
    const sideways = dx * nx + dy * ny;
    const projectedHalfWidth = Math.abs(Math.cos(car.angle) * nx + Math.sin(car.angle) * ny) * car.spec.length / 2
      + Math.abs(Math.sin(car.angle) * nx - Math.cos(car.angle) * ny) * car.spec.width / 2;
    if (Math.abs(sideways) > this.cars[0].image.height / 2 + projectedHalfWidth) return;
    if (!this.cars.some(({ body, smashedAt }) => smashedAt < 0 && (() => {
      const a = car.body.bounds, b = body.bounds;
      return a.min.x < b.max.x && a.max.x > b.min.x && a.min.y < b.max.y && a.max.y > b.min.y;
    })())) return;
    const velocityAcross = car.velocity.x * nx + car.velocity.y * ny;
    const side = Math.sign(sideways) || -(Math.sign(velocityAcross) || 1);
    const shove = Math.max(0, FREIGHT.releaseSpeed - side * velocityAcross) * side;
    car.applyImpulse(nx * shove, ny * shove);
  }

  private onStart(pairs: PairLike[]): void {
    for (const pair of pairs) {
      const a = pair.bodyA, b = pair.bodyB;
      const ia = this.cars.findIndex((c) => c.smashedAt < 0 && c.body === a);
      const ib = ia < 0 ? this.cars.findIndex((c) => c.smashedAt < 0 && c.body === b) : -1;
      const index = ia >= 0 ? ia : ib;
      if (index < 0) continue;
      const owner = ownerOf(ia >= 0 ? b : a);
      if (owner?.kind !== 'player') continue;
      const player = owner.car;
      if (this.cooldown[owner.player] > 0 || player.airborne) continue;
      const n = pair.collision?.normal ?? pair.normal ?? { x: 1, y: 0 };
      const impact = Math.abs((a.velocity.x - b.velocity.x) * STEP_HZ * n.x + (a.velocity.y - b.velocity.y) * STEP_HZ * n.y);
      if (!shouldSmash(player.turbo, impact)) continue;
      this.cooldown[owner.player] = FREIGHT.smashCooldownSec;
      this.smash(index, owner.player, player);
    }
  }

  private smash(hit: number, player: PlayerId, car: IVehicle): void {
    const smashed = this.cars.map((c) => c.smashedAt >= 0);
    const vlen = Math.hypot(car.velocity.x, car.velocity.y);
    const speed = vlen * STEP_HZ;
    const dir = vlen > 0.02 ? { x: car.velocity.x / vlen, y: car.velocity.y / vlen } : { x: Math.cos(car.angle), y: Math.sin(car.angle) };
    const { scene } = this.ctx;
    for (const i of detachedFrom(hit, this.cars.length, smashed)) {
      const c = this.cars[i];
      c.smashedAt = this.ctx.elapsedSec;
      c.image.setVisible(false);
      c.body.collisionFilter.mask = 0; // intact body stops colliding while the slot is empty
      const image = scene.add.image(c.image.x, c.image.y, c.image.texture.key).setRotation(c.image.rotation).setDepth(DEPTH.vehicle + 1);
      const body = scene.matter.add.rectangle(c.image.x, c.image.y, c.image.width, c.image.height, {
        label: `${c.image.name}-debris`,
        angle: c.image.rotation,
        density: 0.002,
        frictionAir: 0.015,
        friction: 0.05,
        restitution: 0.85,
        collisionFilter: { category: CAT.static, mask: VEHICLE_MASK, group: 0 },
        plugin: { owner: { kind: 'train' } },
      }) as unknown as MatterJS.BodyType;
      const v = debrisVelocity(dir, Math.max(speed * 0.5, FREIGHT.debrisLaunch), {
        spread: this.rng.range(-0.9, 0.9), speedMul: this.rng.range(0.7, 1.2) + (i - hit) * 0.12,
      });
      scene.matter.body.setVelocity(body, { x: v.vx / STEP_HZ, y: v.vy / STEP_HZ });
      scene.matter.body.setAngularVelocity(body, this.rng.range(-FREIGHT.debrisSpin, FREIGHT.debrisSpin) / STEP_HZ);
      c.debris = { image, body, t: 0 };
      for (let k = 0; k < FREIGHT.cratesPerCar; k++) {
        const a = this.rng.range(0, Math.PI * 2), sp = this.rng.range(250, 600);
        this.pool.spawn({
          key: FREIGHT.crateKey, x: c.image.x, y: c.image.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: this.rng.range(1.0, 1.6), s0: 1, s1: 0.8, a0: 1, a1: 0, spin: this.rng.range(-10, 10), drag: 1.8, depth: DEPTH.vehicle + 2,
        });
      }
      this.poof(c.image.x, c.image.y, 3);
    }
    services.audio.sfx('crashBig', { pan: this.ctx.players.length === 1 ? 0 : player === 0 ? -0.6 : 0.6 });
    services.audio.sfx('pop');
    this.ctx.camera.shakeAt(car.x, car.y, 900, 0.012, 260);
    this.ctx.bus.emit('ui:popup', { player, text: `+${FREIGHT.smashScore}`, world: { x: car.x, y: car.y }, color: '#ffd34d' });
  }

  private updateDebris(car: TrainCar, dt: number): void {
    const d = car.debris;
    if (!d) return;
    d.t += dt;
    d.image.setPosition(d.body.position.x, d.body.position.y).setRotation(d.body.angle);
    const fade = FREIGHT.debrisSec * 0.6;
    if (d.t > fade) d.image.setAlpha(Math.max(0, 1 - (d.t - fade) / (FREIGHT.debrisSec - fade)));
    if (d.t < FREIGHT.debrisSec) return;
    this.poof(d.image.x, d.image.y, FREIGHT.debrisPoofs);
    this.ctx.scene.matter.world.remove(d.body);
    d.image.destroy();
    car.debris = undefined;
  }

  private poof(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2), sp = this.rng.range(40, 220);
      this.pool.spawn({
        key: TEX.fxSmoke, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: this.rng.range(0.5, 0.9),
        s0: 0.8, s1: 2.4, a0: 0.85, a1: 0, tint: 0xe8e8e8, drag: 3, depth: DEPTH.vehicle + 3,
      });
    }
  }

  private slotBlocked(ctx: RaceContext, pose: { x: number; y: number }, width: number): boolean {
    const r = width / 2 + 70;
    const near = (v: { x: number; y: number }) => Math.hypot(v.x - pose.x, v.y - pose.y) < r;
    return ctx.players.some(near) || [...ctx.npcs].some((n) => !n.destroyed && near(n));
  }

  private reform(car: TrainCar, pose: { x: number; y: number; angle: number }): void {
    car.smashedAt = -1;
    car.body.collisionFilter.mask = VEHICLE_MASK;
    car.image.setVisible(true).setPosition(pose.x, pose.y).setRotation(pose.angle);
    this.poof(pose.x, pose.y, 4);
  }

  /** Dev hook (?train=near): shift the train clock so a wagon passes the first player's nearest rail point ~1.5s from now. */
  private placeNear(ctx: RaceContext): void {
    const circuit = this.circuit!, p = ctx.players[0];
    let best = 0, bestD = Infinity;
    for (let s = 0; s < circuit.length; s += 20) {
      const q = circuit.sample(s), d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bestD) { bestD = d; best = s; }
    }
    const target = best + this.cars[Math.min(2, this.cars.length - 1)].centerFromFront;
    const at = ctx.elapsedSec + 1.5;
    this.clockOffset = (target - freightFrontAt(circuit, at + 0)) / FREIGHT.speed;
    this.devPlaced = true;
  }
}
