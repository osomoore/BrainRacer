import type Phaser from 'phaser';
import { BOARDING_DRIVE, CAT, DEPTH, PLAYER_COLORS, TRAFFIC_SPEC, VEHICLE_CONDITION } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import { ownerOf, type GameSystem, type IPlayerCar, type RaceContext, type VehicleChassis } from '../core/race';
import type { PlayerId, Vec2 } from '../core/types';
import { Tile } from '../core/types';
import type { Rng } from '../core/rng';
import { services } from '../core/services';
import { ParticlePool } from '../fx/ParticlePool';
import { NpcVehicle } from '../entities/NpcVehicle';
import { STEP_HZ } from '../entities/Vehicle';

const T = VEHICLE_CONDITION;

interface Condition {
  starter: Pick<VehicleChassis, 'spec' | 'texture' | 'angle'>;
  damage: number;
  lastHit: number;
  aim: { target: BoardingTarget; started: number } | null;
  hop: { target: BoardingTarget; started: number; from: Vec2 } | null;
  marker: Phaser.GameObjects.Rectangle;
  rider: Phaser.GameObjects.Arc;
  question: boolean;
  recoverAt: number;
  emitAt: number;
  lastResetTap: number;
}

interface BoardingTarget {
  body: MatterJS.BodyType;
  damage: number;
  current(): VehicleChassis | null;
  remove(): void;
}

type AbandonedCar = { car: NpcVehicle; damage: number };

export class VehicleConditionSystem implements GameSystem {
  readonly name = 'vehicleCondition';
  static order = 65; // before jumps and goal segment checks
  private ctx!: RaceContext;
  private parts!: ParticlePool;
  private rng!: Rng;
  private states: Condition[] = [];
  private offs: (() => void)[] = [];
  private active = false;
  private abandoned: AbandonedCar[] = [];

  init(ctx: RaceContext): void {
    this.ctx = ctx;
    this.parts = new ParticlePool(ctx.scene, T.particleLimit);
    this.rng = ctx.rng.fork(0x0d20b);
    this.states = ctx.players.map((car) => {
      const color = parseInt(PLAYER_COLORS[car.player].slice(1), 16);
      const marker = ctx.scene.add.rectangle(0, 0, 1, 1, color, 0.1)
        .setStrokeStyle(4, color).setDepth(DEPTH.worldUi).setVisible(false)
        .setName(`boarding-target-${car.player}`);
      const rider = ctx.scene.add.circle(0, 0, 9, color)
        .setStrokeStyle(3, 0xffffff).setDepth(DEPTH.worldUi).setVisible(false)
        .setName(`boarding-rider-${car.player}`);
      ctx.camera.showOnlyTo(marker, car.player);
      return {
        starter: { spec: car.spec, texture: car.chassis.texture.key, angle: car.angle },
        damage: 0, lastHit: -Infinity, aim: null, hop: null, marker, rider,
        question: false, recoverAt: Infinity, emitAt: 0, lastResetTap: -Infinity,
      };
    });
    this.offs.push(
      ctx.bus.on('round:start', () => { this.active = true; }),
      ctx.bus.on('round:end', () => {
        this.active = false;
        for (const car of ctx.players) {
          this.clearAim(this.states[car.player]);
          this.clearHop(car, this.states[car.player]);
        }
      }),
      ctx.bus.on('vehicle:damage', ({ player, impact }) => this.damage(player, impact)),
      ctx.bus.on('challenge:shown', ({ challenge }) => {
        const state = this.states[challenge.player];
        state.question = true;
        this.clearAim(state);
      }),
      ctx.bus.on('challenge:resolved', ({ challenge, result }) => {
        this.states[challenge.player].question = false;
        if (result === 'correct') this.repair(ctx.players[challenge.player], this.states[challenge.player]);
      }),
      ctx.bus.on('game:pause', () => { for (const state of this.states) this.clearAim(state); }),
    );
  }

  update(dt: number, ctx: RaceContext): void {
    this.parts.update(dt);
    this.abandoned = this.abandoned.filter(({ car }) => {
      if (car.destroyed) { ctx.npcs.delete(car); return false; }
      car.syncView();
      return true;
    });
    if (!this.active || ctx.questionBreak) return;
    for (const car of ctx.players) {
      const state = this.states[car.player];
      if (state.hop) { this.updateHop(car, state); continue; }
      const input = services.input.get(car.player);
      if (!state.question && input.resetCar) this.resetTap(car, state);
      if (!state.question && input.transfer) this.tap(car, state);
      if (state.hop) continue;
      if (state.aim) this.updateAim(car, state);
      if (ctx.elapsedSec >= state.recoverAt) this.recover(car, state);
      if (state.damage >= T.smokeDamage && ctx.elapsedSec >= state.emitAt) {
        state.emitAt = ctx.elapsedSec + T.smokeIntervalSec;
        this.exhaust(car, state.damage >= T.fireDamage && !car.disabled);
      }
    }
  }

  private damage(player: PlayerId, impact: number): void {
    const car = this.ctx.players[player];
    const state = this.states[player];
    const now = this.ctx.elapsedSec;
    if (!this.active || car.disabled || car.airborne || state.hop || impact < T.minImpact || now - state.lastHit < T.damageCooldownSec) return;
    state.lastHit = now;
    const severity = Math.min(1, (impact - T.minImpact) / (T.maxImpact - T.minImpact));
    state.damage += T.minDamage + (T.maxDamage - T.minDamage) * severity;
    if (state.damage < T.wreckDamage) return;
    car.setDisabled(true);
    const body = this.ctx.scene.matter.body;
    body.setVelocity(car.body, { x: car.body.velocity.x * 0.2, y: car.body.velocity.y * 0.2 });
    state.recoverAt = now + T.recoverySec;
    this.breakdown(car);
  }

  /** Y twice quickly: put the player back in their own starting car on a clear road (crashed / stuck / want it back). */
  private resetTap(car: IPlayerCar, state: Condition): void {
    const now = this.ctx.elapsedSec;
    if (now - state.lastResetTap > T.resetDoubleTapSec) { state.lastResetTap = now; return; }
    state.lastResetTap = -Infinity;
    if (car.airborne) return;
    const position = this.recoveryPosition(car, state);
    if (!position) return;
    this.change(car, state, { ...state.starter, position });
  }

  /** A correct answer fixes the car in place: damage cleared, a wrecked car drives again. */
  private repair(car: IPlayerCar, state: Condition): void {
    state.damage = 0;
    state.recoverAt = Infinity;
    if (!car.disabled) return;
    car.setDisabled(false);
    services.audio.sfx('pop');
  }

  private tap(car: IPlayerCar, state: Condition): void {
    const now = this.ctx.elapsedSec;
    if (car.airborne) return;
    const aim = state.aim;
    this.clearAim(state);
    if (aim && now - aim.started <= T.transferTapSec) {
      if (!this.boardable(car, aim.target)) return;
      const from = { x: car.x, y: car.y };
      state.hop = { target: aim.target, started: now, from };
      car.setBoarding(from);
      state.rider.setPosition(from.x, from.y).setScale(1).setVisible(true);
      services.audio.sfx('jump', { volume: 0.55 });
    } else {
      const target = this.nearestTarget(car);
      if (target) state.aim = { target, started: now };
    }
  }

  private clearAim(state: Condition): void {
    state.aim = null;
    state.marker.setVisible(false);
  }

  private clearHop(car: IPlayerCar, state: Condition): void {
    state.hop = null;
    state.rider.setVisible(false);
    car.setBoarding(null);
  }

  private reserved(target: MatterJS.BodyType): boolean {
    return this.states.some((state) => state.hop?.target.body === target);
  }

  private boardable(car: IPlayerCar, target: BoardingTarget): VehicleChassis | null {
    const chassis = target.current();
    if (!chassis || car.airborne || this.reserved(target.body)) return null;
    const distance = Math.hypot(chassis.position.x - car.x, chassis.position.y - car.y) - chassis.spec.length / 2;
    return distance <= T.transferReach ? chassis : null;
  }

  private updateAim(car: IPlayerCar, state: Condition): void {
    const { target, started } = state.aim!;
    const age = this.ctx.elapsedSec - started;
    const chassis = age <= T.transferTapSec && this.boardable(car, target);
    if (!chassis) { this.clearAim(state); return; }
    const { position, angle, spec } = chassis;
    state.marker.setPosition(position.x, position.y).setRotation(angle)
      .setSize(spec.length + T.transferMarkerPadding * 2, spec.width + T.transferMarkerPadding * 2)
      .setAlpha(0.76 + 0.19 * Math.cos(age * Math.PI * 2 * T.transferFlashHz))
      .setVisible(true);
  }

  private updateHop(car: IPlayerCar, state: Condition): void {
    const { target, started, from } = state.hop!;
    const chassis = target.current();
    if (!chassis) { this.clearHop(car, state); return; }
    const t = Math.min(1, (this.ctx.elapsedSec - started) / T.transferHopSec);
    const eased = t * t * (3 - 2 * t);
    const { x, y } = chassis.position;
    const ground = { x: from.x + (x - from.x) * eased, y: from.y + (y - from.y) * eased };
    const lift = Math.sin(t * Math.PI);
    const rotation = this.ctx.camera.viewRotation(car.player);
    state.rider.setPosition(ground.x - Math.sin(rotation) * lift * T.transferHopHeight,
      ground.y - Math.cos(rotation) * lift * T.transferHopHeight).setScale(1 + lift * 0.38);
    car.setBoarding(ground);
    if (t < 1) return;
    target.remove();
    this.leaveCar(car, state.damage);
    this.clearHop(car, state);
    this.change(car, state, chassis, target.damage);
  }

  private leaveCar(car: IPlayerCar, damage: number): void {
    const texture = car.chassis.texture.key;
    const kind = TEX.police.some((key) => key === texture) ? 'police'
      : texture === TEX.truck || texture === TEX.freightTruck ? 'truck' : 'traffic';
    const parked = new NpcVehicle(this.ctx.scene, kind, texture, car.spec, car.x, car.y, car.angle, CAT.prop);
    parked.view.setName(`abandoned-car-${car.player}`);
    parked.body.frictionAir = 0.13;
    const velocity = car.velocity;
    parked.applyImpulse(velocity.x * 0.4, velocity.y * 0.4);
    if (car.disabled) parked.sprite.setTint(0x686e78);
    else this.ctx.npcs.add(parked);
    this.abandoned.push({ car: parked, damage });
    if (this.abandoned.length > T.abandonedLimit) {
      const index = this.abandoned.findIndex(({ car: old }) => !this.reserved(old.body));
      if (index >= 0) {
        const [{ car: old }] = this.abandoned.splice(index, 1);
        this.ctx.npcs.delete(old);
        old.destroy();
      }
    }
  }

  private nearestTarget(car: IPlayerCar): BoardingTarget | null {
    let nearest: BoardingTarget | null = null;
    let reach = T.transferReach;
    for (const npc of this.ctx.npcs) {
      if (npc.destroyed || this.reserved(npc.body)) continue;
      const distance = Math.hypot(npc.x - car.x, npc.y - car.y) - npc.spec.length / 2;
      if (distance > reach) continue;
      reach = distance;
      const old = this.abandoned.find(({ car: abandoned }) => abandoned === npc);
      nearest = {
        body: npc.body, damage: old?.damage ?? 0,
        current: () => !npc.destroyed && this.ctx.npcs.has(npc) ? {
          position: { x: npc.x, y: npc.y }, angle: npc.angle, velocity: npc.velocity,
          spec: old ? npc.spec : {
            ...npc.spec,
            ...(npc.npcKind === 'police' ? BOARDING_DRIVE.police
              : npc.npcKind !== 'truck' ? BOARDING_DRIVE.sedan
              : npc.appearanceKey === TEX.freightTruck ? BOARDING_DRIVE.freight : BOARDING_DRIVE.truck),
          },
          texture: npc.appearanceKey,
        } : null,
        remove: () => { this.ctx.npcs.delete(npc); npc.destroy(); },
      };
    }
    for (const body of this.ctx.scene.matter.world.getAllBodies()) {
      const owner = ownerOf(body);
      if (owner?.kind !== 'prop' || this.reserved(body)) continue;
      const image = owner.prop as Phaser.Physics.Matter.Image;
      const texture = image.texture?.key;
      if (!TEX.traffic.some((key) => key === texture)) continue;
      const distance = Math.hypot(body.position.x - car.x, body.position.y - car.y) - TRAFFIC_SPEC.length / 2;
      if (distance > reach) continue;
      reach = distance;
      nearest = {
        body, damage: 0,
        current: () => image.active ? {
          position: { ...body.position }, angle: body.angle, spec: { ...TRAFFIC_SPEC, ...BOARDING_DRIVE.sedan }, texture,
          velocity: { x: body.velocity.x * STEP_HZ, y: body.velocity.y * STEP_HZ },
        } : null,
        remove: () => image.destroy(),
      };
    }
    return nearest;
  }

  private recover(car: IPlayerCar, state: Condition): void {
    const position = this.recoveryPosition(car, state);
    if (!position) { state.recoverAt = this.ctx.elapsedSec + 1; return; }
    this.change(car, state, { ...state.starter, position });
  }

  private recoveryPosition(car: IPlayerCar, state: Condition): Vec2 | null {
    const { world, scene } = this.ctx;
    const bodies = scene.matter.world.getAllBodies().filter((body) =>
      body !== car.body && !body.isSensor && body.collisionFilter.mask !== 0);
    const padding = Math.hypot(state.starter.spec.length, state.starter.spec.width) / 2;
    let nearest: Vec2 | null = null;
    let reach = Infinity;
    for (let i = 0; i < world.tiles.length; i++) {
      if (world.tiles[i] !== Tile.Road) continue;
      const x = (i % world.widthTiles + 0.5) * world.tileSize;
      const y = (Math.floor(i / world.widthTiles) + 0.5) * world.tileSize;
      const distance = (x - car.x) ** 2 + (y - car.y) ** 2;
      if (distance >= reach) continue;
      const bounds = { min: { x: x - padding, y: y - padding }, max: { x: x + padding, y: y + padding } };
      if (scene.matter.query.region(bodies, bounds).length !== 0) continue;
      nearest = { x, y };
      reach = distance;
    }
    return nearest;
  }

  private change(car: IPlayerCar, state: Condition, chassis: VehicleChassis, damage = 0): void {
    car.replaceChassis(chassis);
    state.damage = damage;
    state.lastHit = this.ctx.elapsedSec;
    this.clearAim(state);
    state.recoverAt = Infinity;
    services.audio.sfx('pop');
    this.ctx.bus.emit('vehicle:changed', { player: car.player, position: chassis.position });
  }

  private exhaust(car: IPlayerCar, fire: boolean): void {
    const x = car.x + Math.cos(car.angle) * car.spec.length * 0.15;
    const y = car.y + Math.sin(car.angle) * car.spec.length * 0.15;
    this.parts.spawn({
      key: TEX.fxSmoke, x, y, vx: this.rng.range(-22, 22), vy: this.rng.range(-65, -30),
      life: 0.8, s0: 0.45, s1: 1.6, a0: 0.85, tint: 0x637282,
    });
    if (fire) this.parts.spawn({
      key: TEX.fxFlame, x, y, vy: -42, life: 0.34, s0: 0.55, s1: 0.85, rot: -Math.PI / 2,
    });
  }

  private breakdown(car: IPlayerCar): void {
    services.audio.sfx('crashBig');
    this.ctx.camera.shake(car.player, 0.007, 190);
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      this.parts.spawn({
        key: i % 2 ? TEX.fxSmoke : TEX.fxStar, x: car.x, y: car.y,
        vx: Math.cos(angle) * 135, vy: Math.sin(angle) * 135,
        life: 0.55, s0: 0.58, s1: 1.45, tint: i % 2 ? 0x788198 : 0xffcc59,
      });
    }
  }

  destroy(): void {
    for (const off of this.offs) off();
    for (const state of this.states) { state.marker.destroy(); state.rider.destroy(); }
    for (const { car } of this.abandoned) { this.ctx.npcs.delete(car); car.destroy(); }
    this.parts.destroy();
  }
}
