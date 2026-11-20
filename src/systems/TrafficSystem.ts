import { BOARDING_DRIVE, FARM_TRAFFIC, HARBOR, INDUSTRIAL_TRAFFIC, TRAFFIC, UNDERGROUND_TRAFFIC } from '../config/gameConfig';
import { getTuning, scaledCount } from '../config/deviceTuning';
import { WORLD_VEHICLES, type WorldVehicle } from '../config/collectibles';
import { TEX } from '../core/assetKeys';
import type { GameSystem, RaceContext } from '../core/race';
import type { Rng } from '../core/rng';
import { pickSpawnNode, type SpawnQuery } from '../entities/laneFollow';
import { TrafficCar, type TrafficKind } from '../entities/TrafficCar';
import { HayWagon } from '../entities/HayWagon';
import type { NpcVehicle } from '../entities/NpcVehicle';
import { UNDERGROUND_VEHICLE_KINDS, type UndergroundVehicleKind } from '../entities/undergroundVehicles';
import { findFarmStarts, pickFarmStart, isFarmLaneNode, type FarmStarts } from './farmTraffic';
import { findFreightStarts, pickFreightStart, type FreightSpawn } from './industrialTraffic';

/** Keeps ~TRAFFIC.maxVehicles AI cars in a ring around the players, spawned off-screen. */
export class TrafficSystem implements GameSystem {
  static order = 90;
  readonly name = 'traffic';
  private ctx!: RaceContext;
  private rng!: Rng;
  private cars: TrafficCar[] = [];
  private wagons = new Set<HayWagon>();
  private freightStarts: FreightSpawn[] = [];
  private freightCount = 0;
  private regularLimit = TRAFFIC.maxVehicles;
  private freightLimit = 0;
  private farmStarts: FarmStarts | null = null;
  private tractorCount = 0;
  private combineCount = 0;
  private tractorLimit = 0;
  private combineLimit = 0;
  private spawnT = 0;
  private jamCheckT = TRAFFIC.jamCheckIntervalSec;
  private offscreenYieldSec = new WeakMap<TrafficCar, number>();
  private undergroundOrder: UndergroundVehicleKind[] = [];
  private worldVehicleOrder: WorldVehicle[] = [];
  private scratch: number[] = [];
  private occupied: { x: number; y: number }[] = [];
  private playerPts: { x: number; y: number }[] = [];
  private offCrash: (() => void) | null = null;
  private query: SpawnQuery = {
    players: [], views: [], occupied: [], minR: 0, maxR: 0, margin: 0, gap: 0, spreadGap: TRAFFIC.spreadSpawnGap,
  };

  init(ctx: RaceContext): void {
    this.ctx = ctx;
    this.rng = ctx.rng.fork(0x7aff1c);
    this.offCrash = ctx.bus.on('vehicle:crash', (e) => this.shove(e));
    const map = ctx.settings.map;
    if (map === 'sky' || map === 'forest' || map === 'underwater') {
      this.worldVehicleOrder = [...WORLD_VEHICLES[map]];
      this.rng.shuffle(this.worldVehicleOrder);
    }
    if (ctx.settings.map === 'underground') {
      this.regularLimit = UNDERGROUND_TRAFFIC.maxVehicles;
      this.undergroundOrder = [...UNDERGROUND_VEHICLE_KINDS];
      this.rng.shuffle(this.undergroundOrder);
    }
    if (ctx.settings.map === 'harbor') {
      const { centerX, centerY, gateWidth, gateHeight } = HARBOR.drawbridge;
      const size = ctx.world.tileSize;
      this.query.excluded = {
        x: (centerX - gateWidth / 2) * size, y: (centerY - gateHeight / 2) * size,
        w: gateWidth * size, h: gateHeight * size,
      };
    }
    if (ctx.world.industrial) {
      this.freightStarts = findFreightStarts(ctx.world);
      this.freightLimit = this.freightStarts.length ? INDUSTRIAL_TRAFFIC.freightTrucks : 0;
      this.regularLimit = INDUSTRIAL_TRAFFIC.regularVehicles;
    }
    if (ctx.world.farm) {
      this.farmStarts = findFarmStarts(ctx.world);
      this.regularLimit = FARM_TRAFFIC.pickups;
      this.tractorLimit = this.farmStarts.tractor.length ? FARM_TRAFFIC.tractors : 0;
      this.combineLimit = this.farmStarts.combine.length ? FARM_TRAFFIC.combines : 0;
    }
    // Low-end traffic setting, read once at race start (ambient traffic only).
    const level = getTuning().traffic;
    this.regularLimit = scaledCount(this.regularLimit, level);
    this.freightLimit = scaledCount(this.freightLimit, level);
    this.tractorLimit = scaledCount(this.tractorLimit, level);
    this.combineLimit = scaledCount(this.combineLimit, level);
    // Initial fill: a nearer ring is allowed, still off-screen.
    const limit = this.totalLimit();
    for (let i = 0; i < limit * 3 && this.cars.length < limit; i++) {
      this.trySpawn(TRAFFIC.initialSpawnMin);
    }
  }

  update(dt: number, ctx: RaceContext): void {
    const r2 = TRAFFIC.despawnRadius * TRAFFIC.despawnRadius;
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      if (car.destroyed) { this.remove(i); continue; }
      car.update(dt, ctx, this.rng);
      let far = true;
      for (const p of ctx.players) {
        const dx = p.x - car.x, dy = p.y - car.y;
        if (dx * dx + dy * dy < r2) { far = false; break; }
      }
      if ((far || car.wantsDespawn) && !this.visible(car)) {
        this.despawn(i);
        continue;
      }
      if (car.isYieldingToPolice && !this.visible(car)) {
        this.offscreenYieldSec.set(car, (this.offscreenYieldSec.get(car) ?? 0) + dt);
      } else {
        this.offscreenYieldSec.delete(car);
      }
    }
    for (const wagon of this.wagons) {
      if (!wagon.destroyed && !wagon.hitched && !this.inPlayerView(wagon, wagon.spec.length)) {
        const nearby = ctx.players.some(p => (p.x - wagon.x) ** 2 + (p.y - wagon.y) ** 2 < r2);
        if (!nearby) wagon.destroy();
      }
      if (wagon.destroyed) {
        ctx.npcs.delete(wagon);
        this.wagons.delete(wagon);
      } else {
        wagon.step(dt);
      }
    }
    this.jamCheckT -= dt;
    if (this.jamCheckT <= 0) {
      this.jamCheckT = TRAFFIC.jamCheckIntervalSec;
      this.relieveJam();
    }
    this.spawnT -= dt;
    if (this.cars.length < this.totalLimit() && this.spawnT <= 0) {
      this.spawnT = TRAFFIC.spawnIntervalSec;
      this.trySpawn(TRAFFIC.spawnRadiusMin);
    }
  }

  /** Player rams traffic: throw the traffic car off to the side with extra push and spin. */
  private shove(e: { player: number | null; with: string; impact: number; x: number; y: number }): void {
    if (e.player === null || e.with !== 'traffic') return;
    const pl = this.ctx.players[e.player];
    if (!pl || pl.chassis.texture.key === TEX.underground.rockCrusher) return;
    let best: NpcVehicle | null = null, bd = 160 * 160;
    for (const c of this.ctx.npcs) {
      if (c.destroyed) continue;
      if (!(c instanceof TrafficCar) && !(c instanceof HayWagon && this.wagons.has(c))) continue;
      const d = (c.x - e.x) ** 2 + (c.y - e.y) ** 2;
      if (d < bd) { bd = d; best = c; }
    }
    if (!best) return;
    let dx = best.x - pl.x, dy = best.y - pl.y;
    const nx = -Math.sin(pl.angle), ny = Math.cos(pl.angle);
    const heavy = pl.spec.mass >= BOARDING_DRIVE.heavyMass && pl.forwardSpeed >= BOARDING_DRIVE.minimumShoveSpeed
      && dx * ny - dy * nx > 0;
    if (heavy) {
      const side = Math.sign(dx * nx + dy * ny) || (best.body.id % 2 ? 1 : -1);
      const offset = Math.hypot(dx, dy) * side;
      dx += nx * offset;
      dy += ny * offset;
    }
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    const k = best.npcKind === 'truck' ? TRAFFIC.shoveTruckMult : 1;
    const mag = Math.min(TRAFFIC.shoveMax, e.impact * TRAFFIC.shovePerImpact) * k * (heavy ? BOARDING_DRIVE.trafficShoveBoost : 1);
    best.applyImpulse(dx * mag, dy * mag, (this.rng.chance(0.5) ? 1 : -1) * TRAFFIC.shoveSpin * Math.min(1, e.impact / 400));
  }

  destroy(): void {
    this.offCrash?.();
    for (const wagon of this.wagons) { this.ctx.npcs.delete(wagon); wagon.destroy(); }
    this.wagons.clear();
    for (const c of this.cars) { this.ctx.npcs.delete(c); c.destroy(); }
    this.cars.length = 0;
  }

  private totalLimit(): number {
    return this.regularLimit + this.freightLimit + this.tractorLimit + this.combineLimit;
  }

  /** Make space in persistent unseen queues. Normal spawning replenishes traffic from the lane graph. */
  private relieveJam(): void {
    for (let cleared = 0; cleared < TRAFFIC.jamClearBatchSize; cleared++) {
      let candidate = -1;
      let longestWait = TRAFFIC.jamClearAfterSec;
      for (let i = 0; i < this.cars.length; i++) {
        const car = this.cars[i];
        const wait = Math.max(car.queuedSec, this.offscreenYieldSec.get(car) ?? 0);
        if (wait < longestWait || this.visible(car)) continue;
        candidate = i;
        longestWait = wait;
      }
      if (candidate < 0) break;
      this.despawn(candidate);
    }
  }

  private despawn(i: number): void {
    const car = this.cars[i];
    if (car.trailer?.hitched) car.trailer.destroy();
    car.destroy();
    this.remove(i);
  }

  private remove(i: number): void {
    const car = this.cars[i];
    this.offscreenYieldSec.delete(car);
    this.ctx.npcs.delete(car);
    car.trailer?.detach();
    if (car.role === 'freight') this.freightCount--;
    else if (car.role === 'tractor') this.tractorCount--;
    else if (car.role === 'combine') this.combineCount--;
    this.cars[i] = this.cars[this.cars.length - 1];
    this.cars.pop();
  }

  private visible(car: TrafficCar): boolean {
    const margin = Math.max(TRAFFIC.spawnMargin * 0.5, Math.hypot(car.spec.length, car.spec.width) / 2);
    if (this.inPlayerView(car, margin)) return true;
    const trailer = car.trailer;
    return !!trailer?.hitched && this.inPlayerView(trailer, Math.hypot(trailer.spec.length, trailer.spec.width) / 2);
  }

  private inPlayerView(car: NpcVehicle, m: number): boolean {
    for (const p of this.ctx.players) {
      const v = this.ctx.camera.worldView(p.player);
      if (car.x > v.x - m && car.x < v.x + v.w + m && car.y > v.y - m && car.y < v.y + v.h + m) return true;
    }
    return false;
  }

  private trySpawn(minR: number): void {
    const ctx = this.ctx;
    const graph = ctx.world.laneGraph;
    const q = this.query;
    this.playerPts.length = 0;
    const views: { x: number; y: number; w: number; h: number }[] = [];
    for (const p of ctx.players) {
      this.playerPts.push({ x: p.x, y: p.y });
      views.push(ctx.camera.worldView(p.player));
    }
    this.occupied.length = 0;
    for (const n of ctx.npcs) if (!n.destroyed) this.occupied.push({ x: n.x, y: n.y });
    for (const p of ctx.players) this.occupied.push({ x: p.x, y: p.y });
    q.views = views; q.players = this.playerPts; q.occupied = this.occupied;
    q.minR = minR; q.maxR = TRAFFIC.spawnRadiusMax; q.margin = TRAFFIC.spawnMargin;

    if (this.freightCount < this.freightLimit) {
      // Yard trucks can fill the nearer ring throughout the race, but still stay off-screen.
      q.minR = TRAFFIC.initialSpawnMin;
      q.gap = INDUSTRIAL_TRAFFIC.freightSpawnGap;
      const start = pickFreightStart(this.freightStarts, q, this.rng);
      if (start) {
        const { node, next } = start;
        const angle = Math.atan2(next.y - node.y, next.x - node.x);
        this.add(new TrafficCar(ctx.scene, this.rng, 'freight', node.x, node.y, angle, next.id));
        this.freightCount++;
        return;
      }
    }
    if (this.farmStarts && this.trySpawnFarmSlow(q)) return;
    if (this.cars.length - this.freightCount - this.tractorCount - this.combineCount >= this.regularLimit) return;
    q.minR = minR;
    q.spreadSamples = minR === TRAFFIC.initialSpawnMin ? 1 : TRAFFIC.spreadSpawnSamples;
    q.gap = ctx.world.industrial ? INDUSTRIAL_TRAFFIC.spawnGap : ctx.world.farm ? FARM_TRAFFIC.spawnGap
      : this.undergroundOrder.length ? UNDERGROUND_TRAFFIC.spawnGap : TRAFFIC.spawnGap;

    let id = pickSpawnNode(graph, q, this.rng, this.scratch);
    if (id < 0) return;
    if (ctx.world.farm) {
      // Pickups live on paved roads; dirt lanes are mostly left to the tractors.
      for (let k = 0; k < 4 && isFarmLaneNode(ctx.world, graph.nodes[id]); k++) {
        if (this.rng.chance(FARM_TRAFFIC.pickupDirtChance)) break;
        id = pickSpawnNode(graph, q, this.rng, this.scratch);
        if (id < 0) return;
      }
      if (isFarmLaneNode(ctx.world, graph.nodes[id]) && !this.rng.chance(FARM_TRAFFIC.pickupDirtChance)) return;
    }
    const n = graph.nodes[id];
    const nextId = n.next[Math.floor(this.rng.next() * n.next.length)];
    const nn = graph.nodes[nextId];
    const angle = Math.atan2(nn.y - n.y, nn.x - n.x);
    let kind: TrafficKind = 'car';
    if (this.worldVehicleOrder.length) kind = this.leastCommonKind(this.worldVehicleOrder)!;
    else if (this.undergroundOrder.length) kind = this.leastCommonKind(this.undergroundOrder)!;
    else if (ctx.world.farm) kind = 'pickup';
    else if (this.rng.chance(TRAFFIC.truckFraction)) kind = 'truck';
    else if (ctx.settings.map === 'harbor' && this.rng.chance(TRAFFIC.harborConvertibleFraction)) kind = 'convertible';
    this.add(new TrafficCar(ctx.scene, this.rng, kind, n.x, n.y, angle, nextId));
  }

  /** Fill missing variants first and distribute replacements without letting crushers dominate. */
  private leastCommonKind<T extends TrafficKind>(order: readonly T[]): T | undefined {
    let best = order[0], least = Infinity;
    for (const kind of order) {
      const count = this.cars.reduce((n, car) => n + Number(!car.destroyed && car.kind === kind), 0);
      if (kind === 'rockCrusher' && count >= UNDERGROUND_TRAFFIC.crusherQuota) continue;
      if (count < least) { best = kind; least = count; }
    }
    return best;
  }

  /** Slow farm vehicles (tractor + wagon, combine) start on dirt lanes, off-screen. Returns true if one spawned. */
  private trySpawnFarmSlow(q: SpawnQuery): boolean {
    const starts = this.farmStarts!;
    const wantTractor = this.tractorCount < this.tractorLimit;
    const wantCombine = this.combineCount < this.combineLimit;
    if (!wantTractor && !wantCombine) return false;
    q.minR = TRAFFIC.initialSpawnMin;
    q.gap = FARM_TRAFFIC.slowSpawnGap;
    const kind = wantTractor && (!wantCombine || this.rng.chance(0.65)) ? 'tractor' : 'combine';
    const start = pickFarmStart(kind === 'tractor' ? starts.tractor : starts.combine, q, this.rng);
    if (!start) return false;
    this.add(new TrafficCar(this.ctx.scene, this.rng, kind, start.node.x, start.node.y, start.angle, start.next.id));
    if (kind === 'tractor') this.tractorCount++; else this.combineCount++;
    return true;
  }

  private add(car: TrafficCar): void {
    this.cars.push(car);
    this.ctx.npcs.add(car);
    if (car.trailer) {
      this.ctx.npcs.add(car.trailer);
      this.wagons.add(car.trailer);
    }
  }
}
