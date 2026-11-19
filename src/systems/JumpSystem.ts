import Phaser from 'phaser';
import { DEPTH, WORLD } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import type { GameSystem, INpcVehicle, IPlayerCar, RaceContext } from '../core/race';
import { services } from '../core/services';
import { isDrivable, nearestRoadPoint } from '../world/geometry';
import { airTime, altitude, canLaunch, insideRamp, landingCorrection } from './jumpMath';


interface Flight { start: number; dur: number; spin: boolean; vx: number; vy: number; boost: boolean; trailAcc: number }
interface Hop { start: number; scale0: number }

export class JumpSystem implements GameSystem {
  readonly name = 'jump';
  static order = 70;
  private ctx!: RaceContext;
  private flights = new Map<IPlayerCar, Flight>();
  private hops = new Map<INpcVehicle, Hop>();

  private off: (() => void) | null = null;

  init(ctx: RaceContext): void {
    this.ctx = ctx;
    this.off = ctx.bus.on('jump:request', (e) => this.request(e.player, e.airSec, !!e.boost));
  }

  /** Reward / script jump: same flight as a ramp, but boost jumps keep steering and speed. */
  private request(player: number, airSec: number, boost: boolean): void {
    const car = this.ctx.players[player];
    if (!car || car.airborne || this.flights.has(car)) return;
    const dur = Math.max(0.3, airSec);
    car.setAirborne(true);
    if (!boost) {
      car.setControlEnabled(false);
      this.ctx.scene.matter.body.setAngularVelocity(car.body, 0);
    }
    this.flights.set(car, { start: this.ctx.elapsedSec, dur, spin: false, vx: car.body.velocity.x, vy: car.body.velocity.y, boost, trailAcc: 0 });
    this.ctx.bus.emit('jump:start', { player: car.player, x: car.x, y: car.y, airSec: dur });
    services.audio.sfx('jump');
    this.whoosh(car);
    if (boost) {
      this.takeoffDust(car);
      this.floorSpeed(car);
    }
  }

  /** Keep at least boostJumpMinSpeed along the heading (so a boost jump always carries the car clear). */
  private floorSpeed(car: IPlayerCar): void {
    const v = car.velocity;
    const fwd = v.x * Math.cos(car.angle) + v.y * Math.sin(car.angle);
    if (fwd >= WORLD.boostJumpMinSpeed) return;
    const k = WORLD.boostJumpMinSpeed / 60;
    this.ctx.scene.matter.body.setVelocity(car.body, { x: Math.cos(car.angle) * k, y: Math.sin(car.angle) * k });
  }

  private takeoffDust(car: IPlayerCar): void {
    const s = this.ctx.scene;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const d = s.add.image(car.x, car.y, TEX.fxDust).setTint(0xd8c8a8).setAlpha(0.9).setDepth(DEPTH.fx).setScale(1);
      s.tweens.add({
        targets: d, x: car.x + Math.cos(a) * 130, y: car.y + Math.sin(a) * 130, scale: 2.6, alpha: 0,
        duration: 500, ease: 'Cubic.easeOut', onComplete: () => d.destroy(),
      });
    }
  }

  private flightStars(car: IPlayerCar, f: Flight, dt: number): void {
    f.trailAcc += dt * 40;
    const s = this.ctx.scene;
    while (f.trailAcc >= 1) {
      f.trailAcc -= 1;
      const a = Math.random() * Math.PI * 2;
      const st = s.add.image(car.x + Math.cos(a) * 20, car.y + Math.sin(a) * 20, TEX.fxStar)
        .setBlendMode(Phaser.BlendModes.ADD).setTint([0xffd60a, 0xffffff, 0x7fd8ff][Math.floor(Math.random() * 3)])
        .setDepth(DEPTH.fx).setScale(0.9);
      s.tweens.add({ targets: st, scale: 0, alpha: 0, angle: 180, duration: 450, onComplete: () => st.destroy() });
    }
  }

  update(dt: number, ctx: RaceContext): void {
    const now = ctx.elapsedSec;
    for (const car of ctx.players) {
      const f = this.flights.get(car);
      if (f) this.fly(car, f, now, dt);
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
    this.off?.();
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
      this.flights.set(car, { start: now, dur, spin, vx: car.body.velocity.x, vy: car.body.velocity.y, boost: false, trailAcc: 0 });
      this.ctx.bus.emit('jump:start', { player: car.player, x: car.x, y: car.y, airSec: dur });
      services.audio.sfx('jump');
      this.whoosh(car);
      return;
    }
  }

  private fly(car: IPlayerCar, f: Flight, now: number, dt: number): void {
    const t = (now - f.start) / f.dur;
    if (t >= 1) { this.land(car, f); return; }
    if (f.boost) {
      this.floorSpeed(car);
      car.view.setScale(1 + WORLD.boostJumpPeakScale * altitude(t));
      this.flightStars(car, f, dt);
      return;
    }
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
    let fix = landingCorrection(isDrivable(world, car.x, car.y), nearestRoadPoint(world, car.x, car.y));
    if (_f.boost && !isDrivable(world, car.x, car.y)) {
      // prefer the first drivable ground further along the heading, so a boost jump really gets you across
      const c = Math.cos(car.angle), s = Math.sin(car.angle);
      for (let d = 24; d <= WORLD.boostLandSearchPx; d += 24) {
        if (isDrivable(world, car.x + c * d, car.y + s * d)) { fix = { x: car.x + c * (d + 24), y: car.y + s * (d + 24) }; break; }
      }
      if (fix && !isDrivable(world, fix.x, fix.y)) fix = nearestRoadPoint(world, car.x, car.y);
    }
    if (fix) {
      const b = this.ctx.scene.matter.body;
      b.setPosition(car.body, fix);
      const k = _f.boost ? 0.7 : 0.25;
      b.setVelocity(car.body, { x: car.body.velocity.x * k, y: car.body.velocity.y * k });
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
