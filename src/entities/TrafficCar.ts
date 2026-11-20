import Phaser from 'phaser';
import { COMBINE_SPEC, FREIGHT_TRUCK_SPEC, PICKUP_SPEC, TRACTOR_SPEC, TRAFFIC, TRAFFIC_SPEC, TRUCK_SPEC } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import type { RaceContext } from '../core/race';
import type { Rng } from '../core/rng';
import type { LaneGraph, VehicleSpec } from '../core/types';
import { STEP_HZ } from './Vehicle';
import { followLane, nearestNode, newFollowResult, trackSpeed, type FollowResult, type FollowState } from './laneFollow';
import { HayWagon } from './HayWagon';
import { NpcVehicle } from './NpcVehicle';
import { UNDERGROUND_VEHICLES, type UndergroundVehicleKind } from './undergroundVehicles';

export type TrafficState = 'drive' | 'knocked' | 'reverse';
export type TrafficKind = 'car' | 'truck' | 'freight' | 'pickup' | 'tractor' | 'combine' | 'convertible' | UndergroundVehicleKind;

/** Spawn role used by TrafficSystem to cap special vehicles; null for ordinary traffic. */
export type TrafficRole = 'freight' | 'tractor' | 'combine' | null;

function kindLook(kind: TrafficKind, rng: Rng): { npc: 'traffic' | 'truck'; tex: string; spec: VehicleSpec } {
  switch (kind) {
    case 'freight': return { npc: 'truck', tex: TEX.freightTruck, spec: FREIGHT_TRUCK_SPEC };
    case 'truck': return { npc: 'truck', tex: TEX.truck, spec: TRUCK_SPEC };
    case 'pickup': return { npc: 'traffic', tex: TEX.farm.pickup[rng.int(0, TEX.farm.pickup.length - 1)], spec: PICKUP_SPEC };
    case 'tractor': return { npc: 'truck', tex: TEX.farm.tractor, spec: TRACTOR_SPEC };
    case 'combine': return { npc: 'truck', tex: TEX.farm.combine, spec: COMBINE_SPEC };
    case 'convertible': return { npc: 'traffic', tex: rng.pick(TEX.convertible)!, spec: TRAFFIC_SPEC };
    case 'caveBuggy': case 'crystalRunner': case 'surveyRover': case 'oreHauler': case 'rockCrusher': {
      const { truck, texture, spec } = UNDERGROUND_VEHICLES[kind];
      return { npc: truck ? 'truck' : 'traffic', tex: texture, spec };
    }
    default: return { npc: 'traffic', tex: TEX.traffic[rng.int(0, TEX.traffic.length - 1)], spec: TRAFFIC_SPEC };
  }
}

const BRAKE_TINT = 0xff9a9a;

export class TrafficCar extends NpcVehicle {
  state: TrafficState = 'drive';
  /** Set when stuck while off-screen; the system removes the car. */
  wantsDespawn = false;
  readonly follow: FollowState;
  readonly oversized: boolean;
  readonly role: TrafficRole;
  /** Hay wagon this tractor spawned. TrafficSystem also tracks it after it is detached. */
  trailer: HayWagon | null = null;
  private readonly cruise: number;
  private readonly res: FollowResult = newFollowResult();
  private stateT = 0;
  private lastVx = 0;
  private lastVy = 0;
  private haveLast = false;
  private stuckT = 0;
  private stuckX: number;
  private stuckY: number;
  private braking = false;
  private launched = false;

  constructor(
    scene: Phaser.Scene, rng: Rng, readonly kind: TrafficKind,
    x: number, y: number, angle: number, target: number,
  ) {
    const look = kindLook(kind, rng);
    super(scene, look.npc, look.tex, look.spec, x, y, angle);
    this.role = kind === 'freight' || kind === 'tractor' || kind === 'combine' ? kind : null;
    this.oversized = this.role !== null || kind === 'rockCrusher' || kind === 'oreHauler';
    this.follow = { target, next: -1 };
    this.cruise = this.spec.maxSpeed * rng.range(TRAFFIC.speedMinFrac, TRAFFIC.speedMaxFrac);
    this.stuckX = x; this.stuckY = y;
    if (kind === 'tractor') this.trailer = new HayWagon(scene, this);
  }

  /** Extra length (px) trailing behind the body, for visibility margins. */
  get trailerLength(): number { return this.trailer?.hitched ? this.trailer.spec.length : 0; }

  override squash(): void { this.trailer?.detach(); super.squash(); }

  override destroy(): void {
    this.trailer?.detach();
    super.destroy();
  }

  update(dt: number, ctx: RaceContext, rng: Rng): void {
    if (this.destroyed) return;
    if (!this.launched) {
      // start at cruising speed on the first AI frame so spawns blend into the flow (not during countdown)
      this.launched = true;
      const v = this.cruise * 0.8 / STEP_HZ;
      this.scene.matter.body.setVelocity(this.body, { x: Math.cos(this.angle) * v, y: Math.sin(this.angle) * v });
    }
    const graph = ctx.world.laneGraph;
    const vel = this.body.velocity;
    const fwd = this.forwardSpeed;

    // Significant hit: velocity changed a lot since our last drive()/coast step.
    if (this.haveLast && this.state !== 'knocked') {
      const jump = Math.hypot(vel.x - this.lastVx, vel.y - this.lastVy) * STEP_HZ;
      if (jump > TRAFFIC.knockSpeed) { this.state = 'knocked'; this.stateT = TRAFFIC.knockSec; this.setBraking(false); }
    }

    switch (this.state) {
      case 'knocked': this.updateKnocked(dt, graph); break;
      case 'reverse': this.updateReverse(dt); break;
      default: this.updateDrive(dt, ctx, graph, rng, fwd);
    }
    this.syncView();
    this.lastVx = this.body.velocity.x; this.lastVy = this.body.velocity.y;
    this.haveLast = true;
  }

  private updateKnocked(dt: number, graph: LaneGraph): void {
    const k = Math.exp(-TRAFFIC.knockDamping * dt);
    const m = this.scene.matter.body;
    m.setVelocity(this.body, { x: this.body.velocity.x * k, y: this.body.velocity.y * k });
    m.setAngularVelocity(this.body, this.body.angularVelocity * Math.exp(-0.8 * dt));
    this.stateT -= dt;
    if (this.stateT <= 0) {
      this.state = 'drive';
      this.recoverTarget(graph);
      this.stuckT = 0; this.stuckX = this.x; this.stuckY = this.y;
    }
  }

  /** Steer back to the nearest lane node that is not behind us. */
  private recoverTarget(graph: LaneGraph): void {
    let id = nearestNode(graph, this.x, this.y);
    if (id < 0) return;
    const n = graph.nodes[id];
    const behind = (n.x - this.x) * Math.cos(this.angle) + (n.y - this.y) * Math.sin(this.angle) < 0;
    if (behind && n.next.length > 0) id = n.next[0];
    this.follow.target = id;
    this.follow.next = -1;
  }

  private updateReverse(dt: number): void {
    this.stateT -= dt;
    this.drive({ throttle: 0, brake: 1, steer: -this.res.steer }, dt);
    this.setBraking(false);
    if (this.stateT <= 0) {
      this.state = 'drive';
      this.stuckT = 0; this.stuckX = this.x; this.stuckY = this.y;
    }
  }

  private updateDrive(dt: number, ctx: RaceContext, graph: LaneGraph, rng: Rng, fwd: number): void {
    const r = followLane(graph, this.follow, this.x, this.y, this.angle, fwd, this.cruise, rng, this.res);
    let limit = r.speedLimit;
    limit = Math.min(limit, this.carAheadLimit(ctx, fwd));
    trackSpeed(limit, fwd, r);
    this.drive(r, dt);
    this.setBraking(r.brake > 0.1 || (limit < 20 && fwd > 5));

    // stuck detection
    this.stuckT += dt;
    if (this.stuckT >= TRAFFIC.stuckSec) {
      const moved = Math.hypot(this.x - this.stuckX, this.y - this.stuckY);
      this.stuckT = 0; this.stuckX = this.x; this.stuckY = this.y;
      if (moved < TRAFFIC.stuckMoveDist) {
        if (!this.onScreen(ctx)) this.wantsDespawn = true;
        else { this.state = 'reverse'; this.stateT = TRAFFIC.reverseSec; this.recoverTarget(graph); }
      }
    }
  }

  /**
   * Speed limit imposed by the nearest vehicle in the cone ahead (Infinity if none).
   * Scales from the leader's speed at followDistance down to 0 at minGap.
   */
  private carAheadLimit(ctx: RaceContext, fwd: number): number {
    const cos = Math.cos(this.angle), sin = Math.sin(this.angle);
    const reach = TRAFFIC.followDistance + Math.max(0, fwd) * 0.35;
    const half = this.spec.length / 2;
    let limit = Infinity;
    const check = (ox: number, oy: number, olen: number, owid: number, ovx: number, ovy: number) => {
      const dx = ox - this.x, dy = oy - this.y;
      const f = dx * cos + dy * sin;
      if (f <= 0 || f > reach + half + olen / 2) return;
      const lat = Math.abs(-dx * sin + dy * cos);
      if (lat > this.spec.width * 0.5 + owid * 0.5 + 8) return;
      const gap = f - half - olen / 2;
      const lead = Math.max(0, ovx * cos + ovy * sin);
      const t = Math.max(0, Math.min(1, (gap - TRAFFIC.minGap) / Math.max(1, reach - TRAFFIC.minGap)));
      limit = Math.min(limit, lead * (1 - t) + this.cruise * t * t);
    };
    for (const n of ctx.npcs) {
      if (n === this || n.destroyed) continue;
      if (this.kind === 'rockCrusher' && n.spec.mass < this.spec.mass) continue;
      const v = n.body.velocity;
      check(n.x, n.y, n.spec.length, n.spec.width, v.x * STEP_HZ, v.y * STEP_HZ);
    }
    for (const p of ctx.players) {
      const v = p.body.velocity;
      check(p.x, p.y, p.spec.length, p.spec.width, v.x * STEP_HZ, v.y * STEP_HZ);
    }
    return limit;
  }

  private onScreen(ctx: RaceContext): boolean {
    const m = 60;
    for (const p of ctx.players) {
      const v = ctx.camera.worldView(p.player);
      if (this.x > v.x - m && this.x < v.x + v.w + m && this.y > v.y - m && this.y < v.y + v.h + m) return true;
    }
    return false;
  }

  private setBraking(on: boolean): void {
    if (on === this.braking) return;
    this.braking = on;
    if (on) this.sprite.setTint(BRAKE_TINT); else this.sprite.clearTint();
  }
}
