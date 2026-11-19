import { BOARDING_DRIVE, FARM_TRAFFIC, INDUSTRIAL_TRAFFIC, TRAFFIC } from '../config/gameConfig';
import type { GameSystem, RaceContext } from '../core/race';
import type { Rng } from '../core/rng';
import { pickSpawnNode, type SpawnQuery } from '../entities/laneFollow';
import { TrafficCar } from '../entities/TrafficCar';
import { findFarmStarts, pickFarmStart, isFarmLaneNode, type FarmStarts } from './farmTraffic';
import { findFreightStarts, pickFreightStart, type FreightSpawn } from './industrialTraffic';

/** Keeps ~TRAFFIC.maxVehicles AI cars in a ring around the players, spawned off-screen. */
export class TrafficSystem implements GameSystem {
  static order = 90;
  readonly name = 'traffic';
  private ctx!: RaceContext;
  private rng!: Rng;
  private cars: TrafficCar[] = [];
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
  private scratch: number[] = [];
  private occupied: { x: number; y: number }[] = [];
  private playerPts: { x: number; y: number }[] = [];
  private offCrash: (() => void) | null = null;
  private query: SpawnQuery = { players: [], views: [], occupied: [], minR: 0, maxR: 0, margin: 0, gap: 0 };

  init(ctx: RaceContext): void {
    this.ctx = ctx;
    this.rng = ctx.rng.fork(0x7aff1c);
    this.offCrash = ctx.bus.on('vehicle:crash', (e) => this.shove(e));
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
      if ((far || car.wantsDespawn) && !this.visible(car)) { car.destroy(); this.remove(i); }
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
    if (!pl) return;
    let best: TrafficCar | null = null, bd = 160 * 160;
    for (const c of this.cars) {
      if (c.destroyed) continue;
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
    for (const c of this.cars) { this.ctx.npcs.delete(c); if (c.trailer) this.ctx.npcs.delete(c.trailer); c.destroy(); }
    this.cars.length = 0;
  }

  private totalLimit(): number {
    return this.regularLimit + this.freightLimit + this.tractorLimit + this.combineLimit;
  }

  private remove(i: number): void {
    const car = this.cars[i];
    this.ctx.npcs.delete(car);
    if (car.trailer) this.ctx.npcs.delete(car.trailer);
    if (car.role === 'freight') this.freightCount--;
    else if (car.role === 'tractor') this.tractorCount--;
    else if (car.role === 'combine') this.combineCount--;
    this.cars[i] = this.cars[this.cars.length - 1];
    this.cars.pop();
  }

  private visible(car: TrafficCar): boolean {
    const m = car.oversized ? Math.hypot(car.spec.length + car.trailerLength, car.spec.width) / 2 : TRAFFIC.spawnMargin * 0.5;
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
    q.gap = ctx.world.industrial ? INDUSTRIAL_TRAFFIC.spawnGap : ctx.world.farm ? FARM_TRAFFIC.spawnGap : TRAFFIC.spawnGap;

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
    const kind = ctx.world.farm ? 'pickup' : this.rng.chance(TRAFFIC.truckFraction) ? 'truck' : 'car';
    this.add(new TrafficCar(ctx.scene, this.rng, kind, n.x, n.y, angle, nextId));
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
    if (car.trailer) this.ctx.npcs.add(car.trailer);
  }
}
