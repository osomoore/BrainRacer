import type Phaser from 'phaser';
import { CAT, DEPTH, FREIGHT } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import type { GameSystem, IVehicle, RaceContext } from '../core/race';
import { services } from '../core/services';
import type { FreightRoute, Vec2 } from '../core/types';
import { freightFrameAt } from './freightTiming';

interface TrainCar {
  image: Phaser.GameObjects.Image;
  body: MatterJS.BodyType;
  centerFromFront: number;
}

const VEHICLE_MASK = CAT.player | CAT.traffic | CAT.police;

export class FreightTrainSystem implements GameSystem {
  static order = 55;
  readonly name = 'freightTrain';
  private ctx!: RaceContext;
  private rail?: FreightRoute;
  private signal?: Phaser.GameObjects.Image;
  private cars: TrainCar[] = [];
  private length = 0;
  private trackLength = 0;
  private along: Vec2 = { x: 1, y: 0 };
  private across: Vec2 = { x: 0, y: 1 };
  private crossingStart = 0;
  private lastFlash = -1;

  init(ctx: RaceContext): void {
    const rail = ctx.world.industrial?.rail;
    if (!rail) return;
    this.ctx = ctx;
    this.rail = rail;
    const dx = rail.end.x - rail.start.x;
    const dy = rail.end.y - rail.start.y;
    this.trackLength = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    this.along = { x: dx / this.trackLength, y: dy / this.trackLength };
    this.across = { x: -this.along.y, y: this.along.x };
    this.crossingStart = this.alongTrack(rail.crossing) - rail.crossingWidth / 2;

    const { scene } = ctx;
    this.signal = scene.add.image(rail.crossing.x, rail.crossing.y, TEX.industrial.crossing[0])
      .setName('industrial-crossing-signal')
      .setRotation(angle + Math.PI / 2)
      .setDisplaySize(FREIGHT.signalRoadLength, rail.crossingWidth + 2 * FREIGHT.signalShoulder)
      .setDepth(DEPTH.vehicle + 1);

    for (let i = 0; i <= FREIGHT.wagonCount; i++) {
      const engine = i === 0;
      const image = scene.add.image(rail.start.x, rail.start.y, engine ? TEX.industrial.engine : TEX.industrial.freightCar)
        .setName(engine ? 'industrial-train-engine' : `industrial-train-car-${i}`)
        .setDepth(DEPTH.vehicle).setRotation(angle).setVisible(false);
      const body = scene.matter.add.rectangle(rail.start.x, rail.start.y, image.width, image.height, {
        label: image.name,
        isStatic: true,
        angle,
        friction: 0,
        frictionStatic: 0,
        restitution: 0.35,
        collisionFilter: { category: CAT.static, mask: 0, group: 0 },
        plugin: { owner: { kind: 'train' } },
      }) as unknown as MatterJS.BodyType;
      this.cars.push({ image, body, centerFromFront: this.length + image.width / 2 });
      this.length += image.width + (i < FREIGHT.wagonCount ? FREIGHT.carriageGap : 0);
    }
  }

  update(_dt: number, ctx: RaceContext): void {
    const rail = this.rail;
    if (!rail) return;
    const frame = freightFrameAt(ctx.elapsedSec, this.crossingStart, rail.crossingWidth, this.length);
    this.updateSignal(frame.warningFlash);
    for (const { image, body, centerFromFront } of this.cars) {
      const center = frame.front - centerFromFront;
      const half = image.width / 2;
      const alpha = Math.max(0, Math.min(1, (center + half) / FREIGHT.terminalFade, (this.trackLength - center - half) / FREIGHT.terminalFade));
      const x = rail.start.x + this.along.x * center;
      const y = rail.start.y + this.along.y * center;
      const solid = alpha >= 0.5;
      ctx.scene.matter.body.setPosition(body, { x, y }, solid && body.collisionFilter.mask !== 0);
      body.collisionFilter.mask = solid ? VEHICLE_MASK : 0;
      image.setPosition(x, y).setAlpha(alpha).setVisible(alpha > 0);
    }

    // A lateral shove sends a car back towards an approach instead of carrying it
    // sideways into a fence. Matter still resolves solid contact against the train.
    if (frame.occupied) {
      for (const car of ctx.players) if (!car.airborne) this.releaseFromCrossing(car);
      for (const car of ctx.npcs) if (!car.destroyed) this.releaseFromCrossing(car);
    }
  }

  destroy(): void {
    this.signal?.destroy();
    for (const { image, body } of this.cars) {
      this.ctx.scene.matter.world?.remove(body);
      image.destroy();
    }
    this.cars.length = 0;
    this.rail = undefined;
    this.signal = undefined;
  }

  private alongTrack(point: Vec2): number {
    const { start } = this.rail!;
    return (point.x - start.x) * this.along.x + (point.y - start.y) * this.along.y;
  }

  private updateSignal(flash: number): void {
    if (flash === this.lastFlash) return;
    this.lastFlash = flash;
    const lit = flash >= 0 && flash % 2 === 0;
    this.signal!.setTexture(TEX.industrial.crossing[lit ? 1 : 0]);
    if (!lit) return;

    const { crossing } = this.rail!;
    let closest = FREIGHT.soundRadius;
    let pan = 0;
    for (const player of this.ctx.players) {
      const distance = Math.hypot(player.x - crossing.x, player.y - crossing.y);
      if (distance >= closest) continue;
      closest = distance;
      pan = this.ctx.players.length === 1 ? 0 : player.player === 0 ? -0.6 : 0.6;
    }
    if (closest < FREIGHT.soundRadius) {
      services.audio.sfx('crossing', { pan, volume: FREIGHT.soundVolume * (1 - closest / FREIGHT.soundRadius) });
    }
  }

  private releaseFromCrossing(car: IVehicle): void {
    const { crossing, crossingWidth } = this.rail!;
    const dx = car.x - crossing.x;
    const dy = car.y - crossing.y;
    if (Math.abs(dx * this.along.x + dy * this.along.y) > crossingWidth / 2) return;
    const sideways = dx * this.across.x + dy * this.across.y;
    const projectedHalfWidth = Math.abs(Math.cos(car.angle) * this.across.x + Math.sin(car.angle) * this.across.y) * car.spec.length / 2
      + Math.abs(Math.sin(car.angle) * this.across.x - Math.cos(car.angle) * this.across.y) * car.spec.width / 2;
    const halfTrainWidth = this.cars[0].image.height / 2;
    if (Math.abs(sideways) > halfTrainWidth + projectedHalfWidth) return;
    if (!this.cars.some(({ body }) => {
      const a = car.body.bounds;
      const b = body.bounds;
      return a.min.x < b.max.x && a.max.x > b.min.x && a.min.y < b.max.y && a.max.y > b.min.y;
    })) return;
    const velocityAcross = car.velocity.x * this.across.x + car.velocity.y * this.across.y;
    const side = Math.sign(sideways) || -(Math.sign(velocityAcross) || 1);
    const shove = Math.max(0, FREIGHT.releaseSpeed - side * velocityAcross) * side;
    car.applyImpulse(this.across.x * shove, this.across.y * shove);
  }
}
