import type Phaser from 'phaser';
import { CAT, DEPTH, FREIGHT } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import type { GameSystem, IVehicle, RaceContext } from '../core/race';
import { services } from '../core/services';
import { carriagePose, crossingFrame, freightFrontAt, measureCircuit, type MeasuredCrossing, type RailCircuit } from './freightTiming';

interface TrainCar {
  image: Phaser.GameObjects.Image;
  body: MatterJS.BodyType;
  centerFromFront: number;
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
  private cars: TrainCar[] = [];
  private length = 0;

  init(ctx: RaceContext): void {
    const rail = ctx.world.industrial?.rail;
    if (!rail) return;
    this.ctx = ctx;
    this.circuit = measureCircuit(rail);
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

    const front = freightFrontAt(this.circuit, ctx.elapsedSec);
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
      this.cars.push({ image, body, centerFromFront });
      this.length += image.width + (i < FREIGHT.wagonCount ? FREIGHT.carriageGap : 0);
    }
  }

  update(_dt: number, ctx: RaceContext): void {
    const circuit = this.circuit;
    if (!circuit) return;
    const front = freightFrontAt(circuit, ctx.elapsedSec);
    for (const { image, body, centerFromFront } of this.cars) {
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
    if (!this.cars.some(({ body }) => {
      const a = car.body.bounds, b = body.bounds;
      return a.min.x < b.max.x && a.max.x > b.min.x && a.min.y < b.max.y && a.max.y > b.min.y;
    })) return;
    const velocityAcross = car.velocity.x * nx + car.velocity.y * ny;
    const side = Math.sign(sideways) || -(Math.sign(velocityAcross) || 1);
    const shove = Math.max(0, FREIGHT.releaseSpeed - side * velocityAcross) * side;
    car.applyImpulse(nx * shove, ny * shove);
  }
}
