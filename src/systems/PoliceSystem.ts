import { POLICE } from '../config/gameConfig';
import type { CrashWith } from '../core/events';
import type { GameSystem, INpcVehicle, IPlayerCar, RaceContext } from '../core/race';
import type { Rng } from '../core/rng';
import { services } from '../core/services';
import type { PlayerId } from '../core/types';
import { PoliceCar } from '../entities/PoliceCar';
import {
  addHeat, decayHeat, desiredChasers, lineOfSight, NodeIndex, think, updateEscape,
  type EscapeState, type ThinkEnv,
} from '../entities/policeAI';

interface PlayerPolice {
  heat: number;
  lastEmitHeat: number;
  chasing: boolean;
  escape: EscapeState;
  bumpUntil: number;
  stopSiren: (() => void) | null;
  lastCount: number;
  respawnUntil: number;
}

export class PoliceSystem implements GameSystem {
  readonly name = 'police';
  private ctx!: RaceContext;
  private rng!: Rng;
  private index!: NodeIndex;
  private env!: ThinkEnv;
  private cars: PoliceCar[] = [];
  private per: PlayerPolice[] = [];
  private spawnT = 0;
  /** Seconds each car has been off every player's view (negative = spawn grace). */
  private offSec = new Map<PoliceCar, number>();
  private offCrash: (() => void) | null = null;

  init(ctx: RaceContext): void {
    this.ctx = ctx;
    this.rng = ctx.rng.fork(0x90115);
    this.index = new NodeIndex(ctx.world.laneGraph);
    this.env = { world: ctx.world, index: this.index, pickGoal: () => this.randomNode() };
    this.per = ctx.players.map(() => ({
      heat: 0, lastEmitHeat: 0, chasing: false, escape: { farSec: 0 }, bumpUntil: -1, stopSiren: null, lastCount: 0, respawnUntil: 0,
    }));
    const h = new URLSearchParams(location.search).get('heat'); // dev hook: ?heat=100
    if (h !== null && this.per[0]) this.per[0].heat = Math.max(0, Math.min(POLICE.heatMax, Number(h) || 0));
    this.offCrash = ctx.bus.on('vehicle:crash', (e) => this.onCrash(e));
  }

  destroy(): void {
    this.offCrash?.();
    for (const p of this.per) { p.stopSiren?.(); p.stopSiren = null; }
    for (const c of this.cars) c.destroy();
    this.cars = [];
    this.offSec.clear();
  }

  // ───────────────────────── events ─────────────────────────
  private onCrash(e: { player: PlayerId | null; with: CrashWith; impact: number; x: number; y: number }): void {
    if (e.player === null) return;
    const st = this.per[e.player];
    const car = this.ctx.players[e.player];
    if (!st || !car) return;
    this.setHeat(e.player, addHeat(st.heat, e.with, e.impact));
    if (e.with === 'police' && this.ctx.elapsedSec >= st.bumpUntil) {
      st.bumpUntil = this.ctx.elapsedSec + POLICE.bumpCooldownSec;
      this.bump(e.player, car, e.x, e.y);
    }
  }

  private bump(p: PlayerId, car: IPlayerCar, x: number, y: number): void {
    let cop: PoliceCar | null = null, bd = Infinity;
    for (const c of this.cars) {
      const d = (c.x - x) ** 2 + (c.y - y) ** 2;
      if (d < bd) { bd = d; cop = c; }
    }
    if (cop) {
      const v = cop.velocity;
      const sp = Math.hypot(v.x, v.y);
      // police heading; shove perpendicular to it, toward the side the player is on
      const hx = sp > 30 ? v.x / sp : Math.cos(cop.angle), hy = sp > 30 ? v.y / sp : Math.sin(cop.angle);
      let px = -hy, py = hx;
      if ((car.x - cop.x) * px + (car.y - cop.y) * py < 0) { px = -px; py = -py; }
      const mag = POLICE.bumpImpulse * POLICE.bumpShovePerUnit;
      car.applyImpulse(px * mag, py * mag, (this.rng.chance(0.5) ? 1 : -1) * POLICE.bumpSpin);
      // police bounce back and ease off a moment so they don't pin the player
      cop.applyImpulse(-px * POLICE.bumpBounce, -py * POLICE.bumpBounce, 0);
      cop.backoff = POLICE.bumpBackoffSec;
    }
    car.slow(POLICE.bumpSlowMult, POLICE.bumpSlowSec);
    this.ctx.bus.emit('police:bump', { player: p, x, y });
    services.audio.sfx('policeBump', { pan: this.pan(p) });
    services.input.rumble(p, 0.7, 180);
    this.ctx.bus.emit('ui:popup', { player: p, text: 'BUMP!' });
  }

  private setHeat(p: PlayerId, heat: number): void {
    const st = this.per[p];
    st.heat = heat;
    const r = Math.round(heat);
    if (r !== st.lastEmitHeat) {
      st.lastEmitHeat = r;
      this.ctx.bus.emit('heat:changed', { player: p, heat });
    }
  }

  private pan(p: PlayerId): number {
    return this.ctx.players.length > 1 ? (p === 0 ? -0.6 : 0.6) : 0;
  }

  // ───────────────────────── update ─────────────────────────
  update(dt: number): void {
    this.cars = this.cars.filter((c) => !c.destroyed);
    for (const k of this.offSec.keys()) if (k.destroyed) this.offSec.delete(k);

    for (let pi = 0; pi < this.per.length; pi++) {
      const p = pi as PlayerId;
      const st = this.per[p];
      if (st.heat > 0) this.setHeat(p, decayHeat(st.heat, dt));
      this.updateChase(p, dt);
    }

    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = POLICE.spawnIntervalSec;
      this.maintainPopulation();
    }

    for (const car of this.cars) { this.driveCar(car, dt); this.checkOffscreen(car, dt); }
    this.updateSirens();
  }

  private chasersOf(p: PlayerId): PoliceCar[] {
    return this.cars.filter((c) => c.mode === 'chase' && c.target === p);
  }

  private updateChase(p: PlayerId, dt: number): void {
    const st = this.per[p];
    const player = this.ctx.players[p];
    if (!player) return;
    if (!st.chasing) {
      if (st.heat >= POLICE.heatChaseThreshold) {
        st.chasing = true;
        st.escape.farSec = 0;
        st.lastCount = 0;
        this.spawnT = 0; // spawn chasers right away
      }
      return;
    }
    const chasers = this.chasersOf(p);
    if (chasers.length !== st.lastCount) {
      st.lastCount = chasers.length;
      if (chasers.length > 0) this.ctx.bus.emit('police:chase', { player: p, count: chasers.length });
    }
    if (chasers.length === 0) return; // still waiting for the first spawn
    let minDist = Infinity;
    for (const c of chasers) minDist = Math.min(minDist, Math.hypot(c.x - player.x, c.y - player.y));
    const cooled = st.heat < POLICE.heatChaseThreshold / 2;
    if (updateEscape(st.escape, minDist, player.turbo, dt) || cooled) this.endChase(p, !cooled);
  }

  private endChase(p: PlayerId, escaped: boolean): void {
    const st = this.per[p];
    st.chasing = false;
    st.escape.farSec = 0;
    st.lastCount = 0;
    st.stopSiren?.();
    st.stopSiren = null;
    this.setHeat(p, Math.min(st.heat, POLICE.heatChaseThreshold / 2));
    for (const c of this.chasersOf(p)) {
      c.mode = 'leave'; c.target = null; c.leaveSec = 0; c.brain.goal = -1; c.brain.path = [];
    }
    this.ctx.bus.emit('police:lost', { player: p });
    this.ctx.bus.emit('ui:popup', { player: p, text: escaped ? 'Got away! \u{1F4A8}' : 'All clear!' });
  }

  private driveCar(car: PoliceCar, dt: number): void {
    let target = null;
    if (car.mode === 'chase' && car.target !== null) {
      const pl = this.ctx.players[car.target];
      if (pl) target = { x: pl.x, y: pl.y, vx: pl.velocity.x, vy: pl.velocity.y };
    } else if (car.mode === 'patrol') {
      this.maybeJoinChase(car);
    }
    if (car.backoff > 0) {
      car.backoff -= dt;
      car.step({ throttle: 0, brake: 0, steer: 0 }, dt);
      return;
    }
    const cap = car.spec.maxSpeed * (car.mode === 'chase' ? 1 : car.mode === 'leave' ? POLICE.leaveSpeedFrac : POLICE.patrolSpeedFrac);
    car.step(think(car.brain, this.env, car, car.mode, target, cap, dt), dt);

    if (car.mode === 'leave') {
      car.leaveSec += dt;
      if (this.offscreen(car.x, car.y) && (car.leaveSec > 2 || this.nearestPlayerDist(car) > 1000)) car.destroy();
    }
    if (car.mode !== 'chase' && this.nearestPlayerDist(car) > POLICE.despawnDist) car.destroy();
  }

  /** Cars (patrols and chasers) that stay off every player's view for a while are removed. */
  private checkOffscreen(car: PoliceCar, dt: number): void {
    if (car.destroyed) return;
    let t = this.offSec.get(car);
    if (t === undefined) t = -POLICE.spawnGraceSec;
    if (this.offscreen(car.x, car.y, POLICE.offscreenMargin)) t += dt; else t = Math.max(0, Math.min(t, 0));
    if (t >= POLICE.offscreenDespawnSec) {
      if (car.mode === 'chase' && car.target !== null) {
        this.per[car.target].respawnUntil = this.ctx.elapsedSec + POLICE.chaserRespawnCooldownSec;
      }
      car.destroy();
      this.offSec.delete(car);
      return;
    }
    this.offSec.set(car, t);
  }

  private maybeJoinChase(car: PoliceCar): void {
    for (let pi = 0; pi < this.per.length; pi++) {
      const p = pi as PlayerId;
      const st = this.per[p], pl = this.ctx.players[p];
      if (!st.chasing || !pl || this.chasersOf(p).length >= POLICE.maxChasersPerPlayer) continue;
      if (Math.hypot(pl.x - car.x, pl.y - car.y) < POLICE.joinSightDist && lineOfSight(this.ctx.world, car, pl)) {
        car.mode = 'chase';
        car.target = p;
        car.brain.path = [];
        return;
      }
    }
  }

  // ───────────────────────── spawning ─────────────────────────
  private maintainPopulation(): void {
    if (this.ctx.players.length === 0) return;
    for (let pi = 0; pi < this.per.length; pi++) {
      const p = pi as PlayerId;
      const st = this.per[p];
      if (!st.chasing) continue;
      const want = Math.max(1, desiredChasers(st.heat));
      if (this.chasersOf(p).length < want && this.cars.length < POLICE.maxTotal && this.ctx.elapsedSec >= st.respawnUntil) {
        const pl = this.ctx.players[p];
        const spot = this.findSpawn(pl.x, pl.y, POLICE.spawnMinDist, POLICE.spawnMaxDist);
        if (spot) {
          const car = this.spawn(spot);
          car.mode = 'chase';
          car.target = p;
          return;
        }
      }
    }
    const patrols = this.cars.filter((c) => c.mode === 'patrol').length;
    if (patrols < POLICE.patrolCount && this.cars.length < POLICE.maxTotal) {
      const pl = this.rng.pick(this.ctx.players);
      const spot = this.findSpawn(pl.x, pl.y, POLICE.patrolSpawnMinDist, POLICE.spawnMaxDist + 600);
      if (spot) this.spawn(spot);
    }
  }

  private spawn(n: { x: number; y: number; angle: number }): PoliceCar {
    const car = new PoliceCar(this.ctx.scene, this.ctx.npcs, n.x, n.y, n.angle);
    this.cars.push(car);
    return car;
  }

  private randomNode(): number {
    const nodes = this.ctx.world.laneGraph.nodes;
    return nodes.length ? this.rng.int(0, nodes.length - 1) : -1;
  }

  /** A lane node off-screen for every player, minD..maxD px from (x, y), with free space around it. */
  private findSpawn(x: number, y: number, minD: number, maxD: number): { x: number; y: number; angle: number } | null {
    const nodes = this.ctx.world.laneGraph.nodes;
    if (nodes.length === 0) return null;
    for (let i = 0; i < 60; i++) {
      const n = nodes[this.rng.int(0, nodes.length - 1)];
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < minD || d > maxD || n.next.length === 0) continue;
      if (!this.offscreen(n.x, n.y)) continue;
      let clear = true;
      for (const o of this.ctx.npcs) if (Math.hypot(o.x - n.x, o.y - n.y) < 120) { clear = false; break; }
      if (!clear) continue;
      const nx = nodes[n.next[0]];
      return { x: n.x, y: n.y, angle: Math.atan2(nx.y - n.y, nx.x - n.x) };
    }
    return null;
  }

  private offscreen(x: number, y: number, m: number = POLICE.viewMargin): boolean {
    for (const pl of this.ctx.players) {
      const v = this.ctx.camera.worldView(pl.player);
      if (x > v.x - m && x < v.x + v.w + m && y > v.y - m && y < v.y + v.h + m) return false;
    }
    return true;
  }

  private nearestPlayerDist(c: INpcVehicle): number {
    let d = Infinity;
    for (const pl of this.ctx.players) d = Math.min(d, Math.hypot(pl.x - c.x, pl.y - c.y));
    return d;
  }

  // ───────────────────────── siren ─────────────────────────
  private updateSirens(): void {
    for (let pi = 0; pi < this.per.length; pi++) {
      const p = pi as PlayerId;
      const st = this.per[p], pl = this.ctx.players[p];
      const near = !!pl && st.chasing && this.chasersOf(p).some((c) => Math.hypot(c.x - pl.x, c.y - pl.y) < POLICE.sirenNearDist && !this.offscreen(c.x, c.y, 0));
      if (near && !st.stopSiren) st.stopSiren = services.audio.loop('siren', { pan: this.pan(p), volume: POLICE.sirenVolume });
      else if (!near && st.stopSiren) { st.stopSiren(); st.stopSiren = null; }
    }
  }
}
