import { TRAFFIC } from '../config/gameConfig';
import type { GameSystem, RaceContext } from '../core/race';
import type { Rng } from '../core/rng';
import { pickSpawnNode, type SpawnQuery } from '../entities/laneFollow';
import { TrafficCar } from '../entities/TrafficCar';

/** Keeps ~TRAFFIC.maxVehicles AI cars in a ring around the players, spawned off-screen. */
export class TrafficSystem implements GameSystem {
  static order = 90;
  readonly name = 'traffic';
  private ctx!: RaceContext;
  private rng!: Rng;
  private cars: TrafficCar[] = [];
  private spawnT = 0;
  private scratch: number[] = [];
  private occupied: { x: number; y: number }[] = [];
  private playerPts: { x: number; y: number }[] = [];
  private query: SpawnQuery = { players: [], views: [], occupied: [], minR: 0, maxR: 0, margin: 0, gap: 0 };

  init(ctx: RaceContext): void {
    this.ctx = ctx;
    this.rng = ctx.rng.fork(0x7aff1c);
    // Initial fill: a nearer ring is allowed, still off-screen.
    for (let i = 0; i < TRAFFIC.maxVehicles * 3 && this.cars.length < TRAFFIC.maxVehicles; i++) {
      if (!this.trySpawn(TRAFFIC.initialSpawnMin)) continue;
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
      if ((far || car.wantsDespawn) && !this.visible(car.x, car.y)) { car.destroy(); this.remove(i); }
    }
    this.spawnT -= dt;
    if (this.cars.length < TRAFFIC.maxVehicles && this.spawnT <= 0) {
      this.spawnT = TRAFFIC.spawnIntervalSec;
      this.trySpawn(TRAFFIC.spawnRadiusMin);
    }
  }

  destroy(): void {
    for (const c of this.cars) { this.ctx.npcs.delete(c); c.destroy(); }
    this.cars.length = 0;
  }

  private remove(i: number): void {
    const car = this.cars[i];
    this.ctx.npcs.delete(car);
    this.cars[i] = this.cars[this.cars.length - 1];
    this.cars.pop();
  }

  private visible(x: number, y: number): boolean {
    const m = TRAFFIC.spawnMargin * 0.5;
    for (const p of this.ctx.players) {
      const v = this.ctx.camera.worldView(p.player);
      if (x > v.x - m && x < v.x + v.w + m && y > v.y - m && y < v.y + v.h + m) return true;
    }
    return false;
  }

  private trySpawn(minR: number): boolean {
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
    q.minR = minR; q.maxR = TRAFFIC.spawnRadiusMax; q.margin = TRAFFIC.spawnMargin; q.gap = TRAFFIC.spawnGap;

    const id = pickSpawnNode(graph, q, this.rng, this.scratch);
    if (id < 0) return false;
    const n = graph.nodes[id];
    const nextId = n.next[Math.floor(this.rng.next() * n.next.length)];
    const nn = graph.nodes[nextId];
    const angle = Math.atan2(nn.y - n.y, nn.x - n.x);
    const truck = this.rng.chance(TRAFFIC.truckFraction);
    const car = new TrafficCar(ctx.scene, this.rng, truck, n.x, n.y, angle, nextId);
    this.cars.push(car);
    ctx.npcs.add(car);
    return true;
  }
}
