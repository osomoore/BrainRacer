import Phaser from 'phaser';
import { CAT, DEPTH, FREIGHT } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import type { GameSystem, IVehicle, RaceContext } from '../core/race';
import { services } from '../core/services';
import { ParticlePool } from '../fx/ParticlePool';
import { ownerOf } from '../core/race';
import type { PlayerId, Vec2 } from '../core/types';
import { STEP_HZ } from '../entities/Vehicle';
import { addUndergroundRail } from '../world/undergroundRail';
import { addForestRail } from '../world/forestRail';
import { addQueuedRail } from '../world/queuedRail';
import { hasQueuedRail } from '../world/gen/queuedWorlds';
import { canReform, debrisVelocity, detachedFrom, shouldSmash } from './freightSmash';
import { carriagePose, crossingFrame, freightFrontAt, measureCircuit, type MeasuredCrossing, type RailCircuit } from './freightTiming';

interface CarAppearance {
  image: Phaser.GameObjects.Image;
  length: number;
  width: number;
  cornerRadius?: number;
}

interface TrainCar extends CarAppearance {
  body: MatterJS.BodyType;
  smashedAt: number; // -1 = intact
  debris?: { image: Phaser.GameObjects.Image; body: MatterJS.BodyType; t: number };
}

type Pose = Vec2 & { angle: number };
interface Train {
  cars: TrainCar[];
  poseAt(elapsed: number, carIndex: number): Pose;
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
  private trains: Train[] = [];
  private byBody = new Map<MatterJS.BodyType, { train: Train; index: number }>();
  private railScenery?: { update(elapsed: number): void; destroy(): void };
  private railElapsed = 0;
  private finished = false;
  private offs: (() => void)[] = [];
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
    const { map } = ctx.settings;
    const mine = map === 'underground';
    const forest = map === 'forest';
    const queued = hasQueuedRail(map);
    if (!rail && !mine && !forest && !queued) return;
    this.ctx = ctx;
    this.pool = new ParticlePool(ctx.scene, 120);
    this.rng = ctx.rng.fork(0xf7e16);
    ctx.scene.matter.world.on(Phaser.Physics.Matter.Events.COLLISION_START, this.handler);
    this.offs.push(ctx.bus.on('dino:trainHit', ({ body, direction }) => {
      const hit = this.byBody.get(body);
      if (this.finished || !hit || hit.train.cars[hit.index].smashedAt >= 0) return;
      const { image } = hit.train.cars[hit.index];
      this.smash(hit.train, hit.index, direction, FREIGHT.debrisLaunch);
      services.audio.sfx('crashBig', { volume: 0.75 });
      ctx.camera.shakeAt(image.x, image.y, 900, 0.012, 260);
    }));
    if (mine || forest || queued) {
      if (!mine) bakeCrate(ctx.scene);
      const scenery = queued ? addQueuedRail(ctx.scene, map, ctx.world)
        : forest ? addForestRail(ctx.scene, ctx.world) : addUndergroundRail(ctx.scene, ctx.world.tileSize);
      this.railScenery = scenery;
      for (const { cars, poseAt } of scenery.trains) this.addTrain(cars, poseAt);
      scenery.update(0);
      this.offs.push(ctx.bus.on('round:end', () => { this.finished = true; }));
    } else if (rail) {
      this.addIndustrialTrain(measureCircuit(rail));
    }
  }

  private addIndustrialTrain(circuit: RailCircuit): void {
    this.circuit = circuit;
    const { scene } = this.ctx;
    bakeCrate(scene);
    this.devNear = new URLSearchParams(location.search).get('train') === 'near'; // dev hook
    if (this.devNear) (window as unknown as { __trainNear?: () => void }).__trainNear = () => { this.devPlaced = false; }; // re-aim after moving the player
    this.signals = circuit.crossings.map((crossing, i) => {
      const { center, width, dx, dy } = crossing;
      const image = scene.add.image(center.x, center.y, TEX.industrial.crossing[0])
        .setName(`industrial-crossing-signal-${i}`)
        .setRotation(Math.atan2(dy, dx) + Math.PI / 2)
        .setDisplaySize(FREIGHT.signalRoadLength, width + 2 * FREIGHT.signalShoulder)
        .setDepth(DEPTH.vehicle + 1);
      return { crossing, image, lastFlash: -1 };
    });

    const centers: number[] = [];
    const cars = Array.from({ length: FREIGHT.wagonCount + 1 }, (_, i) => {
      const engine = i === 0;
      const image = scene.add.image(0, 0, engine ? TEX.industrial.engine : TEX.industrial.freightCar)
        .setName(engine ? 'industrial-train-engine' : `industrial-train-car-${i}`)
        .setDepth(DEPTH.vehicle);
      centers.push(this.length + image.width / 2);
      this.length += image.width + (i < FREIGHT.wagonCount ? FREIGHT.carriageGap : 0);
      return { image, length: image.width, width: image.height };
    });
    this.addTrain(cars, (elapsed, i) => {
      const front = freightFrontAt(circuit, elapsed + this.clockOffset);
      return carriagePose(circuit, front - centers[i], cars[i].length - 2 * AXLE_INSET);
    });
  }

  private addTrain(appearances: CarAppearance[], poseAt: Train['poseAt']): void {
    const { scene } = this.ctx;
    const cars = appearances.map((appearance, i) => {
      const { image, length, width } = appearance;
      const pose = poseAt(this.clock, i);
      image.setPosition(pose.x, pose.y).setRotation(pose.angle);
      const body = scene.matter.add.rectangle(pose.x, pose.y, length, width, {
        label: image.name,
        ...(appearance.cornerRadius ? { chamfer: { radius: appearance.cornerRadius } } : {}),
        isStatic: true,
        angle: pose.angle,
        friction: 0,
        frictionStatic: 0,
        restitution: 0.35,
        collisionFilter: { category: CAT.static, mask: VEHICLE_MASK, group: 0 },
        plugin: { owner: { kind: 'train' } },
      }) as unknown as MatterJS.BodyType;
      return { ...appearance, body, smashedAt: -1 };
    });
    const train = { cars, poseAt };
    for (let i = 0; i < cars.length; i++) this.byBody.set(cars[i].body, { train, index: i });
    this.trains.push(train);
  }

  private get clock(): number { return this.railScenery ? this.railElapsed : this.ctx.elapsedSec; }

  update(dt: number, ctx: RaceContext): void {
    if (!this.trains.length || this.finished) return;
    const circuit = this.circuit;
    if (this.devNear && !this.devPlaced && ctx.players[0]) this.placeNear(ctx);
    this.railElapsed += dt;
    for (let i = 0; i < this.cooldown.length; i++) this.cooldown[i] -= dt;
    this.pool.update(dt);
    for (const { cars, poseAt } of this.trains) for (const [i, car] of cars.entries()) {
      const { image, body, length } = car;
      const pose = poseAt(this.clock, i);
      if (car.smashedAt >= 0) {
        this.updateDebris(car, dt);
        if (car.debris || !canReform(this.clock, car.smashedAt, this.slotBlocked(ctx, pose, length))) continue;
        this.reform(car, pose);
      }
      ctx.scene.matter.body.setPosition(body, pose, true);
      // Phaser normalizes display rotation but Matter keeps the unbounded angle.
      const turn = Math.atan2(Math.sin(pose.angle - body.angle), Math.cos(pose.angle - body.angle));
      ctx.scene.matter.body.setAngle(body, body.angle + turn, true);
      image.setPosition(pose.x, pose.y).setRotation(pose.angle);
    }
    if (!circuit) {
      this.railScenery?.update(this.clock);
      return;
    }
    const front = freightFrontAt(circuit, ctx.elapsedSec + this.clockOffset);
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
    for (const off of this.offs) off();
    this.pool?.destroy();
    this.railScenery?.destroy();
    for (const { image } of this.signals) image.destroy();
    for (const { cars } of this.trains) for (const { image, body, debris } of cars) {
      if (debris) { this.ctx.scene.matter.world?.remove(debris.body); debris.image.destroy(); }
      this.ctx.scene.matter.world?.remove(body);
      image.destroy();
    }
    this.byBody.clear();
    this.signals.length = 0;
    this.trains.length = 0;
    this.offs.length = 0;
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
    const { cars } = this.trains[0];
    if (Math.abs(sideways) > cars[0].width / 2 + projectedHalfWidth) return;
    if (!cars.some(({ body, smashedAt }) => smashedAt < 0 && (() => {
      const a = car.body.bounds, b = body.bounds;
      return a.min.x < b.max.x && a.max.x > b.min.x && a.min.y < b.max.y && a.max.y > b.min.y;
    })())) return;
    const velocityAcross = car.velocity.x * nx + car.velocity.y * ny;
    const side = Math.sign(sideways) || -(Math.sign(velocityAcross) || 1);
    const shove = Math.max(0, FREIGHT.releaseSpeed - side * velocityAcross) * side;
    car.applyImpulse(nx * shove, ny * shove);
  }

  private onStart(pairs: PairLike[]): void {
    if (this.finished) return;
    for (const pair of pairs) {
      const a = pair.bodyA, b = pair.bodyB;
      const hitA = this.byBody.get(a);
      const hit = hitA ?? this.byBody.get(b);
      if (!hit || hit.train.cars[hit.index].smashedAt >= 0) continue;
      const owner = ownerOf(hitA ? b : a);
      if (owner?.kind !== 'player') continue;
      const player = owner.car;
      if (this.cooldown[owner.player] > 0 || player.airborne) continue;
      const n = pair.collision?.normal ?? pair.normal ?? { x: 1, y: 0 };
      const impact = Math.abs((a.velocity.x - b.velocity.x) * STEP_HZ * n.x + (a.velocity.y - b.velocity.y) * STEP_HZ * n.y);
      if (!shouldSmash(player.turbo, impact)) continue;
      this.cooldown[owner.player] = FREIGHT.smashCooldownSec;
      this.smashByPlayer(hit.train, hit.index, owner.player, player);
    }
  }

  private smashByPlayer(train: Train, hit: number, player: PlayerId, car: IVehicle): void {
    const { x: vx, y: vy } = car.velocity;
    const speed = Math.hypot(vx, vy);
    const dir = speed > 0.02 ? { x: vx / speed, y: vy / speed } : { x: Math.cos(car.angle), y: Math.sin(car.angle) };
    this.smash(train, hit, dir, Math.max(speed * 0.5, FREIGHT.debrisLaunch));
    services.audio.sfx('crashBig', { pan: this.ctx.players.length === 1 ? 0 : player === 0 ? -0.6 : 0.6 });
    services.audio.sfx('pop');
    this.ctx.camera.shakeAt(car.x, car.y, 900, 0.012, 260);
    this.ctx.bus.emit('ui:popup', { player, text: `+${FREIGHT.smashScore}`, world: { x: car.x, y: car.y }, color: '#ffd34d' });
  }

  private smash({ cars }: Train, hit: number, direction: Vec2, launchSpeed: number): void {
    const smashed = cars.map((c) => c.smashedAt >= 0);
    const { scene } = this.ctx;
    for (const i of detachedFrom(hit, cars.length, smashed)) {
      const c = cars[i];
      c.smashedAt = this.clock;
      c.image.setVisible(false);
      c.body.collisionFilter.mask = 0; // intact body stops colliding while the slot is empty
      const image = scene.add.image(c.image.x, c.image.y, c.image.texture.key)
        .setDisplaySize(c.image.displayWidth, c.image.displayHeight)
        .setRotation(c.image.rotation).setDepth(DEPTH.vehicle + 1);
      const body = scene.matter.add.rectangle(c.image.x, c.image.y, c.length, c.width, {
        label: `${c.image.name}-debris`,
        ...(c.cornerRadius ? { chamfer: { radius: c.cornerRadius } } : {}),
        angle: c.image.rotation,
        density: 0.002,
        frictionAir: 0.015,
        friction: 0.05,
        restitution: 0.85,
        collisionFilter: { category: CAT.static, mask: VEHICLE_MASK, group: 0 },
        plugin: { owner: { kind: 'train' } },
      }) as unknown as MatterJS.BodyType;
      const v = debrisVelocity(direction, launchSpeed, {
        spread: this.rng.range(-0.9, 0.9), speedMul: this.rng.range(0.7, 1.2) + (i - hit) * 0.12,
      });
      scene.matter.body.setVelocity(body, { x: v.vx / STEP_HZ, y: v.vy / STEP_HZ });
      scene.matter.body.setAngularVelocity(body, this.rng.range(-FREIGHT.debrisSpin, FREIGHT.debrisSpin) / STEP_HZ);
      c.debris = { image, body, t: 0 };
      for (let k = 0; k < FREIGHT.cratesPerCar; k++) {
        const a = this.rng.range(0, Math.PI * 2), sp = this.rng.range(250, 600);
        this.pool.spawn({
          key: this.ctx.settings.map === 'underground' ? TEX.underground.oreChip : FREIGHT.crateKey,
          x: c.image.x, y: c.image.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: this.rng.range(1.0, 1.6), s0: 1, s1: 0.8, a0: 1, a1: 0, spin: this.rng.range(-10, 10), drag: 1.8, depth: DEPTH.vehicle + 2,
        });
      }
      this.poof(c.image.x, c.image.y, 3);
    }
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
    return (ctx.dino.active && near(ctx.dino)) || ctx.players.some(near) || [...ctx.npcs].some((n) => !n.destroyed && near(n));
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
    const { cars } = this.trains[0];
    const index = Math.min(2, cars.length - 1);
    const gapAndCarsAhead = cars.slice(0, index).reduce((length, car) => length + car.length + FREIGHT.carriageGap, 0);
    const target = best + gapAndCarsAhead + cars[index].length / 2;
    const at = ctx.elapsedSec + 1.5;
    this.clockOffset = (target - freightFrontAt(circuit, at + 0)) / FREIGHT.speed;
    this.devPlaced = true;
  }
}
