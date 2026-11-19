import { INDUSTRIAL_TRAFFIC, TRAFFIC } from '../config/gameConfig';
import type { GameSystem, RaceContext } from '../core/race';
import type { Rng } from '../core/rng';
import { pickSpawnNode, type SpawnQuery } from '../entities/laneFollow';
import { TrafficCar } from '../entities/TrafficCar';
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
    // Initial fill: a nearer ring is allowed, still off-screen.
    const limit = this.regularLimit + this.freightLimit;
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
    if (this.cars.length < this.regularLimit + this.freightLimit && this.spawnT <= 0) {
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
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    const k = best.npcKind === 'truck' ? TRAFFIC.shoveTruckMult : 1;
    const mag = Math.min(TRAFFIC.shoveMax, e.impact * TRAFFIC.shovePerImpact) * k;
    best.applyImpulse(dx * mag, dy * mag, (this.rng.chance(0.5) ? 1 : -1) * TRAFFIC.shoveSpin * Math.min(1, e.impact / 400));
  }

  destroy(): void {
    this.offCrash?.();
    for (const c of this.cars) { this.ctx.npcs.delete(c); c.destroy(); }
    this.cars.length = 0;
  }

  private remove(i: number): void {
    const car = this.cars[i];
    this.ctx.npcs.delete(car);
    if (car.oversized) this.freightCount--;
    this.cars[i] = this.cars[this.cars.length - 1];
    this.cars.pop();
  }

  private visible(car: TrafficCar): boolean {
    const m = car.oversized ? Math.hypot(car.spec.length, car.spec.width) / 2 : TRAFFIC.spawnMargin * 0.5;
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
    if (this.cars.length - this.freightCount >= this.regularLimit) return;
    q.minR = minR;
    q.gap = ctx.world.industrial ? INDUSTRIAL_TRAFFIC.spawnGap : TRAFFIC.spawnGap;

    const id = pickSpawnNode(graph, q, this.rng, this.scratch);
    if (id < 0) return;
    const n = graph.nodes[id];
    const nextId = n.next[Math.floor(this.rng.next() * n.next.length)];
    const nn = graph.nodes[nextId];
    const angle = Math.atan2(nn.y - n.y, nn.x - n.x);
    const kind = this.rng.chance(TRAFFIC.truckFraction) ? 'truck' : 'car';
    this.add(new TrafficCar(ctx.scene, this.rng, kind, n.x, n.y, angle, nextId));
  }

  private add(car: TrafficCar): void {
    this.cars.push(car);
    this.ctx.npcs.add(car);
  }
}
