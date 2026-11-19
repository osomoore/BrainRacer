import { DINO } from '../config/gameConfig';
import { Dino } from '../entities/Dino';
import {
  capsuleHit, closestOnSegment, dinoCapsule, dist, isDefeated, isTeamHit, patrolPoint, ramDamage, steer, wrapAngle, type DinoWalk,
} from '../entities/dinoAI';
import type { GameSystem, INpcVehicle, RaceContext } from '../core/race';
import { services } from '../core/services';
import type { PlayerId, Vec2 } from '../core/types';

const NPC_RADIUS = 30;
const CAR_RADIUS = 30;
type Mode = 'drop' | 'guard' | 'leaving' | 'dizzy' | 'poof';

export class DinoSystem implements GameSystem {
  readonly name = 'dino';
  static order = 90;

  private ctx!: RaceContext;
  private dino: Dino | null = null;
  private walk: DinoWalk = { x: 0, y: 0, angle: 0, pauseLeft: 0 };
  private target: Vec2 = { x: 0, y: 0 };
  private mode: Mode = 'guard';
  private modeT = 0;
  private center: Vec2 = { x: 0, y: 0 };
  private guardR = 0;
  private phase = 0;
  private waiting: PlayerId = 0;
  private hp = DINO.maxHp;
  private hitBy = new Set<PlayerId>();
  private lastHit = [-1e9, -1e9];
  private faceT = 0;
  private devNow = false;
  private halfSpawned = false;
  private offs: (() => void)[] = [];
  private roarTimer = 0;
  private stepTimer = 0;
  private hitCooldown: number[] = [0, 0];
  private clock = 0;

  init(ctx: RaceContext): void {
    this.ctx = ctx;
    this.devNow = new URLSearchParams(location.search).get('dino') === 'now';
    this.offs.push(
      ctx.bus.on('goal:arrived', ({ goal, player, waitSec }) => {
        if (ctx.players.length < 2 || waitSec <= 0) return;
        if (this.dino && this.mode === 'leaving') this.removeNow();
        if (!this.dino) this.spawn(ctx, goal, player);
      }),
      ctx.bus.on('goal:completed', () => {
        if (this.dino && (this.mode === 'guard' || this.mode === 'drop')) this.startLeaving();
      }),
    );
  }

  update(dt: number, ctx: RaceContext): void {
    this.clock += dt;
    if (!this.dino) {
      // single player: guard the current goal once at half time (or ?dino=now)
      const due = this.devNow ? ctx.elapsedSec >= DINO.devSpawnDelaySec : ctx.elapsedSec >= ctx.roundLengthSec * DINO.spawnAtFraction;
      if (due && !this.halfSpawned && (ctx.players.length === 1 || this.devNow) && ctx.goal) {
        this.halfSpawned = true;
        this.spawn(ctx, ctx.goal, 0);
      }
      return;
    }
    const d = this.dino;
    this.modeT += dt;
    for (let i = 0; i < 2; i++) this.hitCooldown[i] -= dt;
    let walking = false;
    const px = this.walk.x, py = this.walk.y;

    switch (this.mode) {
      case 'drop': {
        const k = Math.min(1, this.modeT / DINO.dropSec);
        d.setMult(1 + (1 - k * k) * (DINO.dropScale - 1));
        if (k >= 1) this.land(ctx, d);
        break;
      }
      case 'guard':
        walking = this.guard(dt, ctx);
        break;
      case 'leaving': {
        if (this.modeT < DINO.leaveSec) break;
        const res = steer(this.walk, this.target, dt, { speed: DINO.speed * 0.8, turnRate: DINO.turnRate, arriveRadius: 1, pauseSec: 0 });
        walking = res === 'walking';
        if (this.modeT > DINO.leaveTimeoutSec || this.offscreen(ctx)) { this.removeNow(); return; }
        break;
      }
      case 'dizzy': {
        const k = this.modeT / DINO.dizzySec;
        d.setWobble(Math.sin(this.modeT * 9) * 0.12 * Math.min(1, k * 2));
        const shrink = Math.max(0, this.modeT - (DINO.dizzySec - DINO.shrinkSec)) / DINO.shrinkSec;
        d.setMult(1 - Math.min(1, shrink) * 0.95);
        if (this.modeT >= DINO.dizzySec) this.defeat(ctx, d);
        break;
      }
      case 'poof':
        if (this.modeT >= DINO.poofSec) this.removeNow();
        return;
    }

    const moved = Math.hypot(this.walk.x - px, this.walk.y - py);
    d.setPose(this.walk.x, this.walk.y, this.walk.angle);
    d.update(dt, moved, walking);
    const st = ctx.dino;
    st.x = this.walk.x; st.y = this.walk.y; st.angle = this.walk.angle;

    if (walking) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) { this.stepTimer = DINO.stepIntervalSec; this.step(ctx, d); }
    }

    if (this.mode === 'guard') {
      this.roarTimer -= dt;
      if (this.roarTimer <= 0) { this.faceT = DINO.faceSec; this.roar(ctx, d); }
    }
    if (this.mode === 'guard' || this.mode === 'leaving' || this.mode === 'drop') this.contacts(dt, ctx, d);
  }

  destroy(): void {
    for (const off of this.offs) off();
    this.offs = [];
    this.dino?.destroy();
    this.dino = null;
    if (this.ctx) this.ctx.dino.active = false;
  }

  // ───────────────────────── internals ─────────────────────────

  /** Spawn: drops in on the guard loop, on the side away from the waiting player. */
  private spawn(ctx: RaceContext, goal: { x: number; y: number; radius: number }, waiting: PlayerId): void {
    this.center = { x: goal.x, y: goal.y };
    this.guardR = goal.radius * DINO.guardRadiusMul + DINO.guardRadiusPad;
    this.waiting = waiting;
    const car = ctx.players[waiting];
    this.phase = car && dist(car, goal) >= 20 ? Math.atan2(goal.y - car.y, goal.x - car.x) : ctx.rng.range(0, Math.PI * 2);
    const pos = patrolPoint(this.center, this.guardR * DINO.patrolLoopFrac, this.phase);
    const angle = this.phase + Math.PI / 2;
    this.walk = { x: pos.x, y: pos.y, angle, pauseLeft: 0 };
    this.dino = new Dino(ctx.scene, pos.x, pos.y, angle);
    this.dino.setMult(DINO.dropScale);
    this.mode = 'drop'; this.modeT = 0;
    this.hp = DINO.maxHp;
    this.hitBy.clear();
    this.lastHit = [-1e9, -1e9];
    this.faceT = 0;
    this.nextPatrol();
    const st = ctx.dino;
    st.active = true; st.x = pos.x; st.y = pos.y; st.angle = angle;
    this.roarTimer = ctx.rng.range(DINO.guardRoarSec[0], DINO.guardRoarSec[1]);
    this.stepTimer = DINO.stepIntervalSec;
    ctx.bus.emit('dino:spawned', { x: pos.x, y: pos.y });
  }

  private land(ctx: RaceContext, d: Dino): void {
    this.mode = 'guard'; this.modeT = 0;
    d.setMult(1);
    ctx.camera.shake(null, 0.02, 600);
    ctx.camera.shakeAt(this.walk.x, this.walk.y, 2200, 0.02, 600);
    services.audio.sfx('stomp', { volume: 1 });
    services.audio.sfx('crashBig', { volume: 0.8 });
    for (let i = 0; i < 4; i++) d.dust(this.walk.x + (i - 1.5) * 110, this.walk.y + (i % 2 ? 90 : -90));
    this.roar(ctx, d);
  }

  private nextPatrol(): void {
    this.phase += DINO.patrolStepRad;
    this.target = patrolPoint(this.center, this.guardR * DINO.patrolLoopFrac, this.phase);
  }

  /** Slow stomping loop around the goal. Returns true if it moved. */
  private guard(dt: number, ctx: RaceContext): boolean {
    if (this.faceT > 0) {
      this.faceT -= dt;
      const car = ctx.players[this.waiting];
      if (car) {
        const diff = wrapAngle(Math.atan2(car.y - this.walk.y, car.x - this.walk.x) - this.walk.angle);
        const m = DINO.turnRate * dt;
        this.walk.angle = wrapAngle(this.walk.angle + Math.max(-m, Math.min(m, diff)));
      }
      return false;
    }
    if (dist(this.walk, this.center) > this.guardR) this.target = { ...this.center };
    const res = steer(this.walk, this.target, dt, {
      speed: DINO.speed * DINO.guardSpeedFrac, turnRate: DINO.turnRate, arriveRadius: DINO.arriveRadius, pauseSec: DINO.patrolPauseSec,
    });
    if (res === 'arrived') this.nextPatrol();
    return res === 'walking';
  }

  private startLeaving(): void {
    const d = this.dino;
    if (!d) return;
    this.mode = 'leaving'; this.modeT = 0;
    d.setHealth(1);
    const away = dist(this.walk, this.center) > 30 ? Math.atan2(this.walk.y - this.center.y, this.walk.x - this.center.x) : this.walk.angle;
    this.target = { x: this.walk.x + Math.cos(away) * 6000, y: this.walk.y + Math.sin(away) * 6000 };
    d.roar('BYE-BYE!', '#2fbf4a');
    services.audio.sfx('roar', { pan: this.panFor(this.ctx), volume: 0.8, rate: 1.3 });
  }

  private offscreen(ctx: RaceContext): boolean {
    if (dist(this.walk, this.center) < this.guardR + 400) return false;
    const m = 450;
    return ctx.players.every((p) => {
      const v = ctx.camera.worldView(p.player);
      return this.walk.x < v.x - m || this.walk.x > v.x + v.w + m || this.walk.y < v.y - m || this.walk.y > v.y + v.h + m;
    });
  }

  private removeNow(): void {
    this.dino?.destroy();
    this.dino = null;
    this.ctx.dino.active = false;
    this.ctx.bus.emit('dino:left', {});
  }

  private contacts(dt: number, ctx: RaceContext, d: Dino): void {
    const front = DINO.length * DINO.capsuleFront, back = DINO.length * DINO.capsuleBack;
    const cap = dinoCapsule(this.walk.x, this.walk.y, this.walk.angle, front, back, DINO.capsuleRadius);
    const canHurt = this.mode === 'guard' && this.modeT >= DINO.graceSec;
    for (const car of ctx.players) {
      if (car.airborne || !capsuleHit(cap, car.x, car.y, CAR_RADIUS)) continue;
      const q = closestOnSegment(cap, car.x, car.y);
      let nx = car.x - q.x, ny = car.y - q.y;
      let l = Math.hypot(nx, ny);
      if (l < 1e-3) { nx = -Math.sin(this.walk.angle); ny = Math.cos(this.walk.angle); l = 1; }
      nx /= l; ny /= l;
      const v = car.velocity;
      const closing = -(v.x * nx + v.y * ny);
      if (canHurt && this.hitCooldown[car.player] <= 0 && closing >= DINO.ramMinSpeed) {
        this.ram(ctx, d, car.player, closing, nx, ny);
      } else if (closing < DINO.ramMinSpeed) {
        car.applyImpulse(nx * DINO.shoveSpeed * dt, ny * DINO.shoveSpeed * dt);
      }
    }
    if (ctx.npcs.size > 0) {
      for (const npc of [...ctx.npcs]) {
        if (npc.destroyed || !capsuleHit(cap, npc.x, npc.y, NPC_RADIUS)) continue;
        this.squash(ctx, d, npc);
      }
    }
  }

  private ram(ctx: RaceContext, d: Dino, id: PlayerId, closing: number, nx: number, ny: number): void {
    const car = ctx.players[id];
    this.hitCooldown[id] = DINO.ramCooldownSec;
    const other = (1 - id) as PlayerId;
    const team = ctx.players.length > 1 && isTeamHit(this.lastHit[other], this.clock, DINO.teamWindowSec);
    const dmg = ramDamage(closing, car.turbo, team, {
      minSpeed: DINO.ramMinSpeed, speedMax: DINO.ramSpeedMax, dmgMin: DINO.ramDamageMin, dmgMax: DINO.ramDamageMax,
      turboMult: DINO.turboMult, teamMult: DINO.teamMult,
    });
    this.lastHit[id] = this.clock;
    if (team) this.lastHit = [-1e9, -1e9];
    this.hp = Math.max(0, this.hp - dmg);
    this.hitBy.add(id);

    const bounce = Math.min(DINO.ramBounceMax, closing * 1.3 + DINO.ramBounceBase);
    car.applyImpulse(nx * bounce, ny * bounce, DINO.ramSpin * (id === 0 ? 1 : -1));
    this.walk.x -= nx * DINO.flinchStagger; this.walk.y -= ny * DINO.flinchStagger;
    d.flinch();
    d.setHealth(this.hp / DINO.maxHp);
    d.dust(car.x, car.y);
    services.audio.sfx('roar', { rate: 1.6, volume: 0.7, pan: this.panFor(ctx) });
    services.audio.sfx('crash', { volume: 0.8, pan: this.panFor(ctx) });
    services.input.rumble(id, 0.8, 300);
    ctx.camera.shake(id, 0.008, 250);
    ctx.bus.emit('dino:hit', { player: id, x: car.x, y: car.y });
    ctx.bus.emit('dino:damaged', { hp: this.hp, maxHp: DINO.maxHp, by: id, x: this.walk.x, y: this.walk.y });
    const color = team ? '#ff7ae0' : '#ffd34d';
    ctx.bus.emit('ui:popup', { player: id, text: team ? 'TEAM HIT!' : 'BONK!', world: { x: car.x, y: car.y - 40 }, color });
    if (team) {
      const o = ctx.players[other];
      ctx.bus.emit('ui:popup', { player: other, text: 'TEAM HIT!', world: { x: o.x, y: o.y - 40 }, color });
    }
    if (isDefeated(this.hp)) {
      this.mode = 'dizzy'; this.modeT = 0;
      d.setDizzy(true);
      d.setHealth(0.001);
    }
  }

  private defeat(ctx: RaceContext, d: Dino): void {
    this.mode = 'poof'; this.modeT = 0;
    d.poof();
    ctx.dino.active = false;
    const by = [...this.hitBy].sort() as PlayerId[];
    ctx.bus.emit('dino:defeated', { by, x: this.walk.x, y: this.walk.y });
    ctx.bus.emit('ui:banner', { text: 'DINO DEFEATED!', color: '#7CFC00', durationSec: 3 });
    services.audio.sfx('goal', { volume: 1 });
    services.audio.sfx('shockwave', { volume: 0.6 });
    ctx.camera.shake(null, 0.012, 500);
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

  private roar(ctx: RaceContext, d: Dino): void {
    this.roarTimer = ctx.rng.range(DINO.guardRoarSec[0], DINO.guardRoarSec[1]);
    d.roar();
    services.audio.sfx('roar', { pan: this.panFor(ctx), volume: 1 });
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

  private squash(ctx: RaceContext, d: Dino, npc: INpcVehicle): void {
    const x = npc.x, y = npc.y;
    ctx.npcs.delete(npc);
    npc.squash();
    ctx.bus.emit('dino:squash', { x, y });
    services.audio.sfx('squash', { pan: this.panFor(ctx), volume: 0.9 });
    d.popText(x, y - 30, 'SPLAT!', '#ffb02e', 70, 1000);
  }
}
