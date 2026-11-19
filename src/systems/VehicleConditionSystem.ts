import type Phaser from 'phaser';
import { TRAFFIC_SPEC, VEHICLE_CONDITION } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import { ownerOf, type GameSystem, type IPlayerCar, type RaceContext, type VehicleChassis } from '../core/race';
import type { PlayerId, Vec2 } from '../core/types';
import { Tile } from '../core/types';
import type { Rng } from '../core/rng';
import { services } from '../core/services';
import { ParticlePool } from '../fx/ParticlePool';

const T = VEHICLE_CONDITION;

interface Condition {
  starter: Pick<VehicleChassis, 'spec' | 'texture' | 'angle'>;
  damage: number;
  lastHit: number;
  tap: number;
  question: boolean;
  recoverAt: number;
  emitAt: number;
}

interface BoardingTarget extends VehicleChassis {
  remove(): void;
}

export class VehicleConditionSystem implements GameSystem {
  readonly name = 'vehicleCondition';
  static order = 65; // before jumps and goal segment checks
  private ctx!: RaceContext;
  private parts!: ParticlePool;
  private rng!: Rng;
  private states: Condition[] = [];
  private offs: (() => void)[] = [];
  private active = false;

  init(ctx: RaceContext): void {
    this.ctx = ctx;
    this.parts = new ParticlePool(ctx.scene, T.particleLimit);
    this.rng = ctx.rng.fork(0x0d20b);
    this.states = ctx.players.map((car) => ({
      starter: { spec: car.spec, texture: car.chassis.texture.key, angle: car.angle },
      damage: 0, lastHit: -Infinity, tap: -Infinity, question: false, recoverAt: Infinity, emitAt: 0,
    }));
    this.offs.push(
      ctx.bus.on('round:start', () => { this.active = true; }),
      ctx.bus.on('round:end', () => { this.active = false; }),
      ctx.bus.on('vehicle:damage', ({ player, impact }) => this.damage(player, impact)),
      ctx.bus.on('challenge:shown', ({ challenge }) => {
        const state = this.states[challenge.player];
        state.question = true;
        state.tap = -Infinity;
      }),
      ctx.bus.on('challenge:resolved', ({ challenge }) => { this.states[challenge.player].question = false; }),
      ctx.bus.on('game:pause', () => { for (const state of this.states) state.tap = -Infinity; }),
    );
  }

  update(dt: number, ctx: RaceContext): void {
    this.parts.update(dt);
    if (!this.active || ctx.questionBreak) return;
    for (const car of ctx.players) {
      const state = this.states[car.player];
      if (!state.question && services.input.get(car.player).transfer) this.tap(car, state);
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
    if (!this.active || car.disabled || car.airborne || impact < T.minImpact || now - state.lastHit < T.damageCooldownSec) return;
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

  private tap(car: IPlayerCar, state: Condition): void {
    const now = this.ctx.elapsedSec;
    if (now - state.tap > T.transferTapSec) { state.tap = now; return; }
    state.tap = -Infinity;
    if (car.airborne) return;
    const target = this.nearestTarget(car);
    if (!target) return;
    target.remove();
    this.change(car, state, target);
  }

  private nearestTarget(car: IPlayerCar): BoardingTarget | null {
    let nearest: BoardingTarget | null = null;
    let reach = T.transferReach;
    for (const npc of this.ctx.npcs) {
      if (npc.destroyed) continue;
      const distance = Math.hypot(npc.x - car.x, npc.y - car.y) - npc.spec.length / 2;
      if (distance > reach) continue;
      reach = distance;
      nearest = {
        position: { x: npc.x, y: npc.y }, angle: npc.angle, velocity: npc.velocity,
        spec: npc.spec, texture: npc.appearanceKey,
        remove: () => { this.ctx.npcs.delete(npc); npc.destroy(); },
      };
    }
    for (const body of this.ctx.scene.matter.world.getAllBodies()) {
      const owner = ownerOf(body);
      if (owner?.kind !== 'prop') continue;
      const image = owner.prop as Phaser.Physics.Matter.Image;
      const texture = image.texture?.key;
      if (!TEX.traffic.some((key) => key === texture)) continue;
      const distance = Math.hypot(body.position.x - car.x, body.position.y - car.y) - TRAFFIC_SPEC.length / 2;
      if (distance > reach) continue;
      reach = distance;
      nearest = {
        position: { ...body.position }, angle: body.angle, spec: TRAFFIC_SPEC, texture,
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

  private change(car: IPlayerCar, state: Condition, chassis: VehicleChassis): void {
    car.replaceChassis(chassis);
    state.damage = 0;
    state.lastHit = this.ctx.elapsedSec;
    state.tap = -Infinity;
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
    this.parts.destroy();
  }
}
