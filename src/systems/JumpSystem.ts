import Phaser from 'phaser';
import { WORLD } from '../config/gameConfig';
import type { GameSystem, INpcVehicle, IPlayerCar, RaceContext } from '../core/race';
import { services } from '../core/services';
import { isDrivable, nearestRoadPoint } from '../world/geometry';
import { airTime, altitude, canLaunch, insideRamp, landingCorrection } from './jumpMath';


interface Flight { start: number; dur: number; spin: boolean; vx: number; vy: number }
interface Hop { start: number; scale0: number }

export class JumpSystem implements GameSystem {
  readonly name = 'jump';
  static order = 70;
  private ctx!: RaceContext;
  private flights = new Map<IPlayerCar, Flight>();
  private hops = new Map<INpcVehicle, Hop>();

  init(ctx: RaceContext): void { this.ctx = ctx; }

  update(_dt: number, ctx: RaceContext): void {
    const now = ctx.elapsedSec;
    for (const car of ctx.players) {
      const f = this.flights.get(car);
      if (f) this.fly(car, f, now);
      else if (!car.airborne) this.tryLaunch(car, now);
    }
    this.updateNpcs(now);
  }

  destroy(): void {
    for (const [car] of this.flights) {
      car.view.setScale(1);
      car.setControlEnabled(true);
      car.setAirborne(false);
    }
    this.flights.clear();
    this.hops.clear();
  }

  private tryLaunch(car: IPlayerCar, now: number): void {
    for (const r of this.ctx.world.ramps) {
      if (!canLaunch({
        inside: insideRamp(r, car.x, car.y), heading: car.angle, rampAngle: r.angle,
        forwardSpeed: car.forwardSpeed, maxSpeed: car.spec.maxSpeed,
        minSpeedFrac: WORLD.rampMinSpeedFrac, minCos: WORLD.rampDirCos,
      })) continue;
      const dur = airTime(car.forwardSpeed, WORLD.airSecPerSpeed, WORLD.airMinSec, WORLD.airMaxSec);
      car.setAirborne(true);
      car.setControlEnabled(false);
      this.ctx.scene.matter.body.setAngularVelocity(car.body, 0);
      const spin = Math.abs(car.forwardSpeed) >= WORLD.spinSpeedFrac * car.spec.maxSpeed;
      this.flights.set(car, { start: now, dur, spin, vx: car.body.velocity.x, vy: car.body.velocity.y });
      this.ctx.bus.emit('jump:start', { player: car.player, x: car.x, y: car.y, airSec: dur });
      services.audio.sfx('jump');
      this.whoosh(car);
      return;
    }
  }

  private fly(car: IPlayerCar, f: Flight, now: number): void {
    const t = (now - f.start) / f.dur;
    if (t >= 1) { this.land(car, f); return; }
    this.ctx.scene.matter.body.setVelocity(car.body, { x: f.vx, y: f.vy }); // fly straight, no drag
    this.ctx.scene.matter.body.setAngularVelocity(car.body, 0);
    car.view.setScale(1 + WORLD.jumpPeakScale * altitude(t));
    if (f.spin) {
      const sprite = car.view.list[1] as Phaser.GameObjects.Image | undefined;
      if (sprite) sprite.setRotation(Math.PI * 2 * Phaser.Math.Easing.Sine.InOut(t));
    }
  }

  private land(car: IPlayerCar, _f: Flight): void {
    this.flights.delete(car);
    car.view.setScale(1);
    const sprite = car.view.list[1] as Phaser.GameObjects.Image | undefined;
    if (sprite) sprite.setRotation(0);
    car.setAirborne(false);
    car.setControlEnabled(true);
    const world = this.ctx.world;
    const fix = landingCorrection(isDrivable(world, car.x, car.y), nearestRoadPoint(world, car.x, car.y));
    if (fix) {
      const b = this.ctx.scene.matter.body;
      b.setPosition(car.body, fix);
      b.setVelocity(car.body, { x: car.body.velocity.x * 0.25, y: car.body.velocity.y * 0.25 });
    }
    this.ctx.bus.emit('jump:land', { player: car.player, x: car.x, y: car.y });
    services.audio.sfx('land');
    this.ctx.camera.shake(car.player, 0.006, 160);
    services.input.rumble(car.player, 0.6, 180);
    if (_f.dur > WORLD.bigAirSec) {
      this.ctx.bus.emit('ui:popup', { player: car.player, text: 'BIG AIR!', world: { x: car.x, y: car.y }, color: '#ffd23f' });
    }
  }

  private whoosh(car: IPlayerCar): void {
    const s = this.ctx.scene;
    const g = s.add.graphics().setDepth(car.view.depth + 1).setPosition(car.x, car.y).setRotation(car.angle);
    g.lineStyle(6, 0xffffff, 0.8);
    for (const oy of [-16, 0, 16]) { g.beginPath(); g.moveTo(-30, oy); g.lineTo(-110, oy); g.strokePath(); }
    s.tweens.add({ targets: g, alpha: 0, scaleX: 1.6, duration: 350, onComplete: () => g.destroy() });
  }

  private updateNpcs(now: number): void {
    for (const [npc, h] of this.hops) {
      const t = (now - h.start) / WORLD.npcHopSec;
      if (npc.destroyed || t >= 1) {
        if (!npc.destroyed) npc.view.setScale(h.scale0);
        this.hops.delete(npc);
        continue;
      }
      npc.view.setScale(h.scale0 * (1 + WORLD.npcHopScale * altitude(t)));
    }
    for (const npc of this.ctx.npcs) {
      if (npc.destroyed || this.hops.has(npc) || Math.abs(npc.forwardSpeed) < 40) continue;
      for (const r of this.ctx.world.ramps) {
        if (insideRamp(r, npc.x, npc.y)) { this.hops.set(npc, { start: now, scale0: npc.view.scale }); break; }
      }
    }
  }
}
