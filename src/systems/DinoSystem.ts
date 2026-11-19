import { DINO, TILE_SIZE } from '../config/gameConfig';
import { Dino } from '../entities/Dino';
import {
  capsuleHit, chooseWaypoint, closestOnSegment, dinoCapsule, dist, shouldSpawn, steer, type DinoWalk,
} from '../entities/dinoAI';
import type { GameSystem, INpcVehicle, RaceContext } from '../core/race';
import { services } from '../core/services';
import { Tile, type PlayerId, type Vec2 } from '../core/types';
import { tileCenter } from '../world/geometry';

const NPC_RADIUS = 30;
const CAR_RADIUS = 30;

export class DinoSystem implements GameSystem {
  readonly name = 'dino';
  static order = 90;

  private ctx!: RaceContext;
  private dino: Dino | null = null;
  private walk: DinoWalk = { x: 0, y: 0, angle: 0, pauseLeft: 0 };
  private target: Vec2 = { x: 0, y: 0 };
  private sites: Vec2[] = [];
  private edgeRoads: Vec2[] = [];
  private devNow = false;
  private roarTimer = 0;
  private stepTimer = 0;
  private roarCooldown = 0;
  private hitCooldown: number[] = [0, 0];
  private wasNear: boolean[] = [false, false];
  private clock = 0;

  init(ctx: RaceContext): void {
    this.ctx = ctx;
    this.devNow = new URLSearchParams(location.search).get('dino') === 'now';
    const w = ctx.world;
    for (const p of w.places) this.sites.push({ x: p.front.x, y: p.front.y });
    const edge = DINO.spawnEdgeTiles;
    for (let ty = 0; ty < w.heightTiles; ty++) {
      for (let tx = 0; tx < w.widthTiles; tx++) {
        if (w.tiles[ty * w.widthTiles + tx] !== Tile.Road) continue;
        const p = { x: tileCenter(tx, w.tileSize), y: tileCenter(ty, w.tileSize) };
        if (tx % 4 === 0 && ty % 4 === 0) this.sites.push(p);
        if (tx < edge || ty < edge || tx >= w.widthTiles - edge || ty >= w.heightTiles - edge) this.edgeRoads.push(p);
      }
    }
  }

  update(dt: number, ctx: RaceContext): void {
    this.clock += dt;
    if (!this.dino) {
      const due = this.devNow ? ctx.elapsedSec >= DINO.devSpawnDelaySec : shouldSpawn(ctx.elapsedSec, ctx.roundLengthSec, DINO.spawnAtFraction);
      if (due) this.spawn(ctx);
      return;
    }
    const d = this.dino;
    const bounds = { x: 0, y: 0, w: ctx.world.widthTiles * TILE_SIZE, h: ctx.world.heightTiles * TILE_SIZE };

    // --- walking
    const px = this.walk.x, py = this.walk.y;
    const res = steer(this.walk, this.target, dt, { speed: DINO.speed, turnRate: DINO.turnRate, arriveRadius: DINO.arriveRadius, pauseSec: DINO.pauseSec });
    if (res === 'paused' && this.walk.pauseLeft <= 0) this.pickTarget(ctx, bounds);
    const moved = Math.hypot(this.walk.x - px, this.walk.y - py);
    const walking = res === 'walking';
    d.setPose(this.walk.x, this.walk.y, this.walk.angle);
    d.update(dt, moved, walking);
    const st = ctx.dino;
    st.active = true; st.x = this.walk.x; st.y = this.walk.y; st.angle = this.walk.angle;

    // --- steps
    if (walking) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) { this.stepTimer = DINO.stepIntervalSec; this.step(ctx, d); }
    }

    // --- roars
    this.roarCooldown -= dt;
    this.roarTimer -= dt;
    let proximityRoar = false;
    for (const car of ctx.players) {
      const near = dist(car, this.walk) <= DINO.roarProximity;
      if (near && !this.wasNear[car.player]) proximityRoar = true;
      this.wasNear[car.player] = near;
    }
    if ((this.roarTimer <= 0) || (proximityRoar && this.roarCooldown <= 0)) this.roar(ctx, d);

    // --- contacts
    const front = DINO.length * DINO.capsuleFront, back = DINO.length * DINO.capsuleBack;
    const cap = dinoCapsule(this.walk.x, this.walk.y, this.walk.angle, front, back, DINO.capsuleRadius);
    for (let i = 0; i < 2; i++) this.hitCooldown[i] -= dt;
    for (const car of ctx.players) {
      if (car.airborne || this.hitCooldown[car.player] > 0) continue;
      if (!capsuleHit(cap, car.x, car.y, CAR_RADIUS)) continue;
      this.hitPlayer(ctx, d, car.player, cap);
    }
    if (ctx.npcs.size > 0) {
      for (const npc of [...ctx.npcs]) {
        if (npc.destroyed || !capsuleHit(cap, npc.x, npc.y, NPC_RADIUS)) continue;
        this.squash(ctx, d, npc);
      }
    }
  }

  destroy(): void {
    this.dino?.destroy();
    this.dino = null;
    if (this.ctx) this.ctx.dino.active = false;
  }

  // ───────────────────────── internals ─────────────────────────

  private spawn(ctx: RaceContext): void {
    let pos: Vec2 | null = null;
    let angle = 0;
    if (this.devNow && ctx.players[0]) {
      const p = ctx.players[0];
      const a = p.angle;
      pos = { x: p.x + Math.cos(a) * 750, y: p.y + Math.sin(a) * 750 };
      angle = a + Math.PI * 0.75;
    } else {
      pos = this.pickSpawn(ctx);
      const cx = ctx.world.widthTiles * TILE_SIZE / 2, cy = ctx.world.heightTiles * TILE_SIZE / 2;
      angle = Math.atan2(cy - pos.y, cx - pos.x);
    }
    this.walk = { x: pos.x, y: pos.y, angle, pauseLeft: 0 };
    this.dino = new Dino(ctx.scene, pos.x, pos.y, angle);
    this.pickTarget(ctx, { x: 0, y: 0, w: ctx.world.widthTiles * TILE_SIZE, h: ctx.world.heightTiles * TILE_SIZE });
    const st = ctx.dino;
    st.active = true; st.x = pos.x; st.y = pos.y; st.angle = angle;
    this.roarTimer = ctx.rng.range(DINO.roarIntervalSec[0], DINO.roarIntervalSec[1]);
    this.stepTimer = DINO.stepIntervalSec;
    ctx.bus.emit('dino:spawned', { x: pos.x, y: pos.y });
    ctx.camera.shake(null, 0.012, 900);
    this.roar(ctx, this.dino, true);
  }

  private pickSpawn(ctx: RaceContext): Vec2 {
    const views = ctx.players.map((p) => ctx.camera.worldView(p.player));
    const margin = 300;
    const offscreen = (c: Vec2) => views.every((v) => c.x < v.x - margin || c.x > v.x + v.w + margin || c.y < v.y - margin || c.y > v.y + v.h + margin);
    const farFromPlayers = (c: Vec2) => ctx.players.every((p) => dist(p, c) >= DINO.spawnMinDist);
    const pool = this.edgeRoads.length > 0 ? this.edgeRoads : this.sites;
    const good = pool.filter((c) => farFromPlayers(c) && offscreen(c));
    if (good.length > 0) return ctx.rng.pick(good);
    // Relax: farthest from the nearest player.
    const all = pool.length > 0 ? pool : [{ x: 200, y: 200 }];
    let best = all[0], bd = -1;
    for (const c of all) {
      const m = Math.min(...ctx.players.map((p) => dist(p, c)), 1e9);
      if (m > bd) { bd = m; best = c; }
    }
    return best;
  }

  private pickTarget(ctx: RaceContext, bounds: { x: number; y: number; w: number; h: number }): void {
    const goal = ctx.goal ? { x: ctx.goal.x, y: ctx.goal.y } : null;
    this.target = chooseWaypoint(ctx.rng, this.walk, goal, this.sites, {
      goalChance: DINO.goalWaypointChance, goalRadius: DINO.goalWaypointRadius, minDist: DINO.minWaypointDist,
      bounds: { x: bounds.x + 200, y: bounds.y + 200, w: bounds.w - 400, h: bounds.h - 400 },
    });
  }

  private nearestPlayerDist(ctx: RaceContext): number {
    let m = Infinity;
    for (const p of ctx.players) m = Math.min(m, dist(p, this.walk));
    return m;
  }

  private panFor(ctx: RaceContext): number {
    if (ctx.players.length === 0) return 0;
    let cx = 0;
    for (const p of ctx.players) cx += p.x;
    cx /= ctx.players.length;
    return Math.max(-1, Math.min(1, (this.walk.x - cx) / 1200));
  }

  private roar(ctx: RaceContext, d: Dino, spawn = false): void {
    this.roarCooldown = DINO.roarCooldownSec;
    this.roarTimer = ctx.rng.range(DINO.roarIntervalSec[0], DINO.roarIntervalSec[1]);
    const near = this.nearestPlayerDist(ctx);
    const vol = spawn ? 1 : Math.max(0.35, Math.min(1, 1.2 - near / 2500));
    d.roar();
    services.audio.sfx('roar', { pan: this.panFor(ctx), volume: vol });
    ctx.bus.emit('dino:roar', { x: this.walk.x, y: this.walk.y });
    ctx.camera.shakeAt(this.walk.x, this.walk.y, 1400, 0.012, 600);
    for (const p of ctx.players) {
      const k = dist(p, this.walk);
      if (k < 1400) services.input.rumble(p.player, 0.3 + 0.5 * (1 - k / 1400), 450);
    }
  }

  private step(ctx: RaceContext, d: Dino): void {
    const near = this.nearestPlayerDist(ctx);
    const vol = near > DINO.stepAudioRange ? 0 : 0.2 + 0.8 * (1 - near / DINO.stepAudioRange);
    ctx.bus.emit('dino:step', { x: this.walk.x, y: this.walk.y });
    if (vol > 0) services.audio.sfx('stomp', { pan: this.panFor(ctx), volume: vol });
    ctx.camera.shakeAt(this.walk.x, this.walk.y, DINO.shakeRadius, 0.004, 120);
    const side = (Math.floor(this.clock / DINO.stepIntervalSec) % 2 === 0 ? -1 : 1) as -1 | 1;
    const f = d.foot(side);
    d.dust(f.x, f.y);
  }

  private hitPlayer(ctx: RaceContext, d: Dino, id: PlayerId, cap: ReturnType<typeof dinoCapsule>): void {
    const car = ctx.players[id];
    this.hitCooldown[id] = DINO.hitCooldownSec;
    const q = closestOnSegment(cap, car.x, car.y);
    let dx = car.x - q.x, dy = car.y - q.y;
    let l = Math.hypot(dx, dy);
    if (l < 1e-3) { dx = -Math.sin(this.walk.angle); dy = Math.cos(this.walk.angle); l = 1; }
    dx /= l; dy /= l;
    const side = Math.sign(dx * -Math.sin(this.walk.angle) + dy * Math.cos(this.walk.angle)) || 1;
    car.applyImpulse(dx * DINO.hitLaunchSpeed, dy * DINO.hitLaunchSpeed, DINO.hitSpin * side);
    ctx.bus.emit('dino:hit', { player: id, x: car.x, y: car.y });
    services.audio.sfx('crashBig', { pan: this.panFor(ctx), volume: 1 });
    services.input.rumble(id, 1, 500);
    ctx.bus.emit('ui:popup', { player: id, text: 'WHOA!', world: { x: car.x, y: car.y - 40 }, color: '#ffd34d' });
    ctx.camera.shake(id, 0.01, 300);
    d.dust(car.x, car.y);
  }

  private squash(ctx: RaceContext, d: Dino, npc: INpcVehicle): void {
    const x = npc.x, y = npc.y;
    ctx.npcs.delete(npc);
    npc.squash();
    ctx.bus.emit('dino:squash', { x, y });
    services.audio.sfx('squash', { pan: this.panFor(ctx), volume: 0.9 });
    d.popText(x, y - 30, 'SPLAT!', '#ffb02e', 70, 1000);
  }
}
