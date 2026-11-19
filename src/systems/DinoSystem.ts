import { DINO, DINO_LASER, DINO_RIDE, DINO_SMASH, PLAYER_COLORS } from '../config/gameConfig';
import { Dino } from '../entities/Dino';
import {
  capsuleHit, closestOnSegment, dinoCapsule, dist, isTeamHit, orbitStep, steer, wrapAngle, type Capsule, type DinoWalk,
} from '../entities/dinoAI';
import { addHits, clampInside, healthFrac, hitValue, newRideTimer, stepRide, type RideTimer } from '../entities/dinoRide';
import {
  beamHitsCircle, beamSideNormal, cancelLaser, chargeFrac, laserReady, newLaser, startLaser, stepLaser, sweepAngle, type LaserState, type LaserTiming,
} from '../entities/dinoLaser';
import type { GameSystem, INpcVehicle, IPlayerCar, RaceContext } from '../core/race';
import { services } from '../core/services';
import type { PlayerId, Vec2 } from '../core/types';

const CAR_RADIUS = 30;
/** tamed = beaten, dizzy and boardable; ridden = a player drives it; dismount = happy roar before the poof. */
type Mode = 'drop' | 'guard' | 'leaving' | 'tamed' | 'ridden' | 'dismount' | 'poof';
type DevWindow = Window & { __dinoDefeat?: () => void };

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
  private hits = 0;
  private hitsToDefeat: number = DINO.hitsToDefeat;
  private rideSec: number = DINO_RIDE.durationSec;
  private rider: PlayerId | null = null;
  private ride: RideTimer = newRideTimer(DINO_RIDE.durationSec);
  private question = [false, false];
  private roundOver = false;
  private hitBy = new Set<PlayerId>();
  private lastHit = [-1e9, -1e9];
  private faceT = 0;
  private devNow = false;
  private halfSpawned = false;
  private offs: (() => void)[] = [];
  private roarTimer = 0;
  private stepTimer = 0;
  private hitCooldown: number[] = [0, 0];
  private tossCooldown: number[] = [0, 0];
  private clock = 0;
  private laser: LaserState = newLaser(DINO_LASER.firstDelaySec);
  private laserDev = false;
  private laserHitCd: number[] = [0, 0];
  private readonly laserTm: LaserTiming = { chargeSec: DINO_LASER.chargeSec, fireSec: DINO_LASER.fireSec, arc: DINO_LASER.arc };

  init(ctx: RaceContext): void {
    this.ctx = ctx;
    const q = new URLSearchParams(location.search);
    this.devNow = q.get('dino') === 'now';
    this.laserDev = q.get('laser') === 'now';
    const hits = Number(q.get('dinohits'));
    if (hits >= 1) this.hitsToDefeat = Math.floor(hits);
    const rideSec = Number(q.get('dinoride'));
    if (rideSec > 0) this.rideSec = rideSec;
    // dev/e2e hook: beat the dino right now (it becomes tame and boardable)
    (window as DevWindow).__dinoDefeat = () => {
      const d = this.dino;
      if (d && (this.mode === 'guard' || this.mode === 'drop' || this.mode === 'leaving')) { this.hitBy.add(0); this.tame(ctx, d); }
    };
    this.offs.push(
      ctx.bus.on('goal:arrived', ({ goal, player, waitSec }) => {
        if (ctx.players.length < 2 || waitSec <= 0) return;
        if (this.dino && this.mode === 'leaving') this.removeNow();
        if (!this.dino) this.spawn(ctx, goal, player);
      }),
      ctx.bus.on('goal:completed', () => {
        if (this.dino && (this.mode === 'guard' || this.mode === 'drop')) this.startLeaving();
      }),
      ctx.bus.on('dino:ridden', ({ player }) => this.board(ctx, player)),
      ctx.bus.on('challenge:shown', ({ challenge }) => { this.question[challenge.player] = true; }),
      ctx.bus.on('challenge:resolved', ({ challenge }) => { this.question[challenge.player] = false; }),
      ctx.bus.on('round:end', () => { this.roundOver = true; }),
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
    d.updateTosses(dt);
    this.modeT += dt;
    for (let i = 0; i < 2; i++) {
      this.hitCooldown[i] -= dt;
      this.tossCooldown[i] -= dt;
      this.laserHitCd[i] -= dt;
    }
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
        const res = steer(this.walk, this.target, dt, { speed: DINO.guardSpeed, turnRate: DINO.turnRate, arriveRadius: 1, pauseSec: 0 });
        walking = res === 'walking';
        if (this.modeT > DINO.leaveTimeoutSec || this.offscreen(ctx)) { this.removeNow(); return; }
        break;
      }
      case 'tamed': {
        if (this.roundOver) break;
        d.setWobble(Math.sin(this.modeT * 9) * 0.12 * Math.min(1, this.modeT * 1.5));
        const shrinkAt = DINO_RIDE.tameSec - DINO.shrinkSec;
        if (this.modeT >= shrinkAt) {
          ctx.dino.tamed = false; // too late to hop on
          d.setMult(1 - Math.min(1, (this.modeT - shrinkAt) / DINO.shrinkSec) * 0.95);
        }
        if (this.modeT >= DINO_RIDE.tameSec) { this.poofOut(ctx, d); return; }
        break;
      }
      case 'ridden':
        walking = this.rideTick(dt, ctx);
        break;
      case 'dismount':
        if (this.modeT >= DINO_RIDE.dismountSec) { this.poofOut(ctx, d); return; }
        break;
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
      if (this.stepTimer <= 0) {
        this.stepTimer = this.mode === 'ridden' ? DINO_RIDE.stepIntervalSec : DINO.stepIntervalSec;
        this.step(ctx, d);
      }
    }

    this.laserTick(dt, ctx, d);

    if (this.mode === 'guard' && this.laser.phase === 'idle') {
      this.roarTimer -= dt;
      if (this.roarTimer <= 0) { this.faceT = DINO.faceSec; this.roar(ctx, d); }
    }
    if (this.mode === 'guard' || this.mode === 'leaving' || this.mode === 'drop') this.contacts(dt, ctx, d);
    else if (this.mode === 'ridden') this.rideContacts(ctx, d);
  }

  destroy(): void {
    for (const off of this.offs) off();
    this.offs = [];
    const w = window as DevWindow;
    if (w.__dinoDefeat) delete w.__dinoDefeat;
    this.rider = null;
    this.dino?.destroy();
    this.dino = null;
    if (this.ctx) this.ctx.dino.active = false;
  }

  // ───────────────────────── internals ─────────────────────────

  /** Spawn: drops in on the guard loop, on the side away from the waiting player. */
  private spawn(ctx: RaceContext, goal: { x: number; y: number; radius: number }, waiting: PlayerId): void {
    this.center = { x: goal.x, y: goal.y };
    this.guardR = goal.radius + DINO.orbitPad;
    this.waiting = waiting;
    const car = ctx.players[waiting];
    this.phase = car && dist(car, goal) >= 20 ? Math.atan2(goal.y - car.y, goal.x - car.x) : ctx.rng.range(0, Math.PI * 2);
    const pos = { x: this.center.x + Math.cos(this.phase) * this.guardR, y: this.center.y + Math.sin(this.phase) * this.guardR };
    const angle = this.phase + Math.PI / 2;
    this.walk = { x: pos.x, y: pos.y, angle, pauseLeft: 0 };
    this.dino = new Dino(ctx.scene, pos.x, pos.y, angle);
    this.dino.setMult(DINO.dropScale);
    this.mode = 'drop'; this.modeT = 0;
    this.hits = 0;
    this.rider = null;
    this.hitBy.clear();
    this.lastHit = [-1e9, -1e9];
    this.hitCooldown.fill(0);
    this.tossCooldown.fill(0);
    this.faceT = 0;
    this.laser = newLaser(this.laserDev ? 1.5 : DINO_LASER.firstDelaySec);
    this.laserHitCd.fill(0);
    const st = ctx.dino;
    st.active = true; st.x = pos.x; st.y = pos.y; st.angle = angle;
    st.tamed = false; st.rider = null; st.rideLeftSec = 0; st.rideTotalSec = 0;
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
    const cap = this.contactCapsule();
    for (const npc of ctx.npcs) {
      if (!npc.destroyed && this.touchesNpc(cap, npc)) this.squash(ctx, d, npc);
    }
    this.roar(ctx, d);
  }

  /** Slow stomping loop around the goal. Returns true if it moved. */
  private guard(dt: number, ctx: RaceContext): boolean {
    if (this.laser.phase === 'charge') {
      // turn to face the sweep centre; stand still while firing
      const m = DINO_LASER.turnRate * dt;
      const diff = wrapAngle(this.laser.baseAngle - this.walk.angle);
      this.walk.angle = wrapAngle(this.walk.angle + Math.max(-m, Math.min(m, diff)));
      return false;
    }
    if (this.laser.phase === 'fire') return false;
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
    orbitStep(this.walk, this.center, this.clock, dt, {
      speed: DINO.guardSpeed, turnRate: DINO.turnRate, radius: this.guardR, breathe: DINO.orbitBreathe,
      breatheW: DINO.orbitBreatheW, lookahead: DINO.orbitLookahead, returnTol: DINO.orbitReturnTol,
    });
    return true;
  }

  /** Laser eyes: telegraph (glow + faint aim line), then twin beams sweep and zap traffic / bounce players. */
  private laserTick(dt: number, ctx: RaceContext, d: Dino): void {
    const L = this.laser;
    if (this.mode !== 'guard') {
      if (L.phase !== 'idle') { cancelLaser(L, DINO_LASER.cooldownSec[0]); d.setLaser(0, false, 0); }
      return;
    }
    if (this.modeT < DINO.graceSec) return;
    const ev = stepLaser(L, dt, this.laserTm);
    if (ev === 'ended') {
      L.cooldown = this.laserDev ? DINO_LASER.devCooldownSec : ctx.rng.range(DINO_LASER.cooldownSec[0], DINO_LASER.cooldownSec[1]);
      d.setLaser(0, false, 0);
      return;
    }
    if (L.phase === 'idle') {
      const target = this.nearestPlayer(ctx);
      const canFire = this.faceT <= 0 && !d.roaring && !!target && dist(target, this.walk) <= DINO_LASER.rangeMax;
      if (target && laserReady(L, canFire)) {
        const base = Math.atan2(target.y - this.walk.y, target.x - this.walk.x) + ctx.rng.range(-DINO_LASER.aimRandom, DINO_LASER.aimRandom);
        startLaser(L, base, ctx.rng.next() < 0.5 ? 1 : -1);
        services.audio.sfx('turbo', { pan: this.panFor(ctx), volume: 0.6, rate: 1.4 });
      }
      return;
    }
    if (L.phase === 'charge') {
      d.setLaser(Math.max(0.01, chargeFrac(L, this.laserTm)), false, L.baseAngle - (L.dir * DINO_LASER.arc) / 2);
      return;
    }
    if (ev === 'fire') {
      services.audio.sfx('shockwave', { pan: this.panFor(ctx), volume: 0.7, rate: 1.6 });
      services.audio.sfx('pop', { pan: this.panFor(ctx), volume: 0.6, rate: 0.7 });
    }
    const ang = sweepAngle(L, this.laserTm);
    d.setLaser(0, true, ang);
    this.laserHits(ctx, d, ang);
  }

  private laserHits(ctx: RaceContext, d: Dino, ang: number): void {
    for (const eye of d.eyes()) {
      for (const car of ctx.players) {
        if (car.airborne || car.disabled || car.ghost || car.boardingPosition || this.laserHitCd[car.player] > 0) continue;
        if (!beamHitsCircle(eye, ang, DINO_LASER.length, DINO_LASER.hitHalfWidth, car, CAR_RADIUS)) continue;
        // harmless bounce: no damage, no points lost; brief slowdown + a sideways spin-out
        this.laserHitCd[car.player] = DINO_LASER.playerCooldownSec;
        const n = beamSideNormal(ang, eye, car);
        car.applyImpulse(n.x * DINO_LASER.playerPush, n.y * DINO_LASER.playerPush, DINO_LASER.playerSpin * (car.player === 0 ? 1 : -1));
        car.slow(DINO_LASER.playerSlowMult, DINO_LASER.playerSlowSec);
        d.zap(car.x, car.y);
        services.audio.sfx('pop', { pan: this.panFor(ctx), volume: 0.9 });
        services.input.rumble(car.player, 0.5, 220);
        ctx.camera.shake(car.player, 0.006, 200);
      }
      for (const npc of ctx.npcs) {
        if (npc.destroyed || !this.beamTouchesNpc(eye, ang, npc)) continue;
        const { x, y } = npc;
        d.toss(npc, beamSideNormal(ang, eye, npc));
        ctx.npcs.delete(npc);
        npc.destroy();
        d.zap(x, y);
        this.smashSound(ctx, x, y);
      }
    }
  }

  private beamTouchesNpc(eye: Vec2, ang: number, npc: INpcVehicle): boolean {
    const r = npc.spec.width / 2;
    const half = Math.max(0, npc.spec.length / 2 - r);
    const dx = Math.cos(npc.angle) * half, dy = Math.sin(npc.angle) * half;
    const hw = DINO_LASER.hitHalfWidth, len = DINO_LASER.length;
    return beamHitsCircle(eye, ang, len, hw, npc, r)
      || beamHitsCircle(eye, ang, len, hw, { x: npc.x + dx, y: npc.y + dy }, r)
      || beamHitsCircle(eye, ang, len, hw, { x: npc.x - dx, y: npc.y - dy }, r);
  }

  private nearestPlayer(ctx: RaceContext): IPlayerCar | null {
    let best: IPlayerCar | null = null, bd = Infinity;
    for (const p of ctx.players) { const k = dist(p, this.walk); if (k < bd) { bd = k; best = p; } }
    return best;
  }

  private startLeaving(): void {
    const d = this.dino;
    if (!d) return;
    this.mode = 'leaving'; this.modeT = 0;
    d.setHealth(1);
    const away = dist(this.walk, this.center) > 30 ? Math.atan2(this.walk.y - this.center.y, this.walk.x - this.center.x) : this.walk.angle;
    this.target = { x: this.walk.x + Math.cos(away) * 6000, y: this.walk.y + Math.sin(away) * 6000 };
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
    this.rider = null;
    const st = this.ctx.dino;
    st.active = false; st.tamed = false; st.rider = null; st.rideLeftSec = 0;
    this.ctx.bus.emit('dino:left', {});
  }

  private contactCapsule(): Capsule {
    const front = DINO.length * DINO.capsuleFront, back = DINO.length * DINO.capsuleBack;
    return dinoCapsule(this.walk.x, this.walk.y, this.walk.angle, front, back, DINO.capsuleRadius);
  }

  /** Sample the center and both rounded ends so a truck can be caught by its cab or its trailer. */
  private touchesNpc(cap: Capsule, npc: INpcVehicle): boolean {
    const r = npc.spec.width / 2;
    const half = Math.max(0, npc.spec.length / 2 - r);
    const dx = Math.cos(npc.angle) * half, dy = Math.sin(npc.angle) * half;
    return capsuleHit(cap, npc.x, npc.y, r)
      || capsuleHit(cap, npc.x + dx, npc.y + dy, r)
      || capsuleHit(cap, npc.x - dx, npc.y - dy, r);
  }

  private contactNormal(cap: Capsule, target: Vec2): Vec2 {
    const q = closestOnSegment(cap, target.x, target.y);
    const x = target.x - q.x, y = target.y - q.y;
    const length = Math.hypot(x, y);
    if (length < 1e-3) return { x: -Math.sin(this.walk.angle), y: Math.cos(this.walk.angle) };
    return { x: x / length, y: y / length };
  }

  private contacts(dt: number, ctx: RaceContext, d: Dino): void {
    const cap = this.contactCapsule();
    const canHurt = this.mode === 'guard' && this.modeT >= DINO.graceSec;
    for (const car of ctx.players) {
      if (car.airborne || car.disabled || car.boardingPosition || !capsuleHit(cap, car.x, car.y, CAR_RADIUS)) continue;
      const normal = this.contactNormal(cap, car);
      const v = car.velocity;
      const closing = -(v.x * normal.x + v.y * normal.y);
      if (canHurt && this.hitCooldown[car.player] <= 0 && closing >= DINO.ramMinSpeed) {
        this.ram(ctx, d, car.player, closing, normal.x, normal.y);
        if (this.mode !== 'guard') return;
      } else if (closing < DINO.ramMinSpeed) {
        if (canHurt && !car.ghost && this.tossCooldown[car.player] <= 0 && this.hitCooldown[car.player] <= 0) {
          this.tossPlayer(ctx, d, car, normal);
        } else {
          car.applyImpulse(normal.x * DINO.shoveSpeed * dt, normal.y * DINO.shoveSpeed * dt);
        }
      }
    }

    if (!canHurt) return;
    for (const npc of ctx.npcs) {
      if (npc.destroyed || !this.touchesNpc(cap, npc)) continue;
      const { x, y } = npc;
      d.toss(npc, this.contactNormal(cap, npc));
      ctx.npcs.delete(npc);
      npc.destroy();
      this.smashSound(ctx, x, y);
    }
  }

  private tossPlayer(ctx: RaceContext, d: Dino, car: IPlayerCar, normal: Vec2): void {
    this.tossCooldown[car.player] = DINO_SMASH.playerCooldownSec;
    ctx.bus.emit('vehicle:damage', { player: car.player, impact: DINO_SMASH.playerImpact });
    const v = car.velocity;
    const forward = v.x * normal.x + v.y * normal.y;
    const speed = Math.max(0, DINO_SMASH.playerLaunchSpeed - forward);
    car.applyImpulse(normal.x * speed, normal.y * speed);
    ctx.bus.emit('jump:request', { player: car.player, airSec: DINO_SMASH.playerAirSec });
    ctx.bus.emit('dino:hit', { player: car.player, x: car.x, y: car.y });
    d.smash(car.x, car.y);
    services.audio.sfx('crashBig', { pan: this.panFor(ctx), volume: 0.8 });
    services.input.rumble(car.player, 0.9, 260);
    ctx.camera.shake(car.player, 0.012, 260);
  }

  private ram(ctx: RaceContext, d: Dino, id: PlayerId, closing: number, nx: number, ny: number): void {
    const car = ctx.players[id];
    this.hitCooldown[id] = DINO.ramCooldownSec;
    const other = (1 - id) as PlayerId;
    const team = ctx.players.length > 1 && isTeamHit(this.lastHit[other], this.clock, DINO.teamWindowSec);
    // every counted ram is one hit (speed/turbo don't matter); a TEAM hit counts DINO.teamHits
    const res = addHits(this.hits, hitValue(team, DINO.teamHits), this.hitsToDefeat);
    this.lastHit[id] = this.clock;
    if (team) this.lastHit = [-1e9, -1e9];
    this.hits = res.hits;
    this.hitBy.add(id);

    const bounce = Math.min(DINO.ramBounceMax, closing * 1.3 + DINO.ramBounceBase);
    car.applyImpulse(nx * bounce, ny * bounce, DINO.ramSpin * (id === 0 ? 1 : -1));
    this.walk.x -= nx * DINO.flinchStagger; this.walk.y -= ny * DINO.flinchStagger;
    d.flinch();
    d.setHealth(healthFrac(this.hits, this.hitsToDefeat));
    d.dust(car.x, car.y);
    services.audio.sfx('roar', { rate: 1.6, volume: 0.7, pan: this.panFor(ctx) });
    services.audio.sfx('crash', { volume: 0.8, pan: this.panFor(ctx) });
    services.input.rumble(id, 0.8, 300);
    ctx.camera.shake(id, 0.008, 250);
    ctx.bus.emit('dino:hit', { player: id, x: car.x, y: car.y });
    ctx.bus.emit('dino:damaged', { hp: this.hitsToDefeat - this.hits, maxHp: this.hitsToDefeat, by: id, x: this.walk.x, y: this.walk.y });
    if (res.defeated) this.tame(ctx, d);
  }

  /** Beaten: points now, then dizzy stars for DINO_RIDE.tameSec while a player may hop on. */
  private tame(ctx: RaceContext, d: Dino): void {
    this.mode = 'tamed'; this.modeT = 0;
    d.setDizzy(true);
    d.setHealth(1); // bar hidden
    d.setLaser(0, false, 0);
    const by = [...this.hitBy].sort() as PlayerId[];
    ctx.bus.emit('dino:defeated', { by, x: this.walk.x, y: this.walk.y });
    ctx.bus.emit('ui:banner', { text: 'DINO DEFEATED!', color: '#7CFC00', durationSec: 3 });
    services.audio.sfx('goal', { volume: 1 });
    services.audio.sfx('shockwave', { volume: 0.6 });
    ctx.camera.shake(null, 0.012, 500);
    const st = ctx.dino;
    st.tamed = true; st.rider = null;
    ctx.bus.emit('dino:tamed', { x: this.walk.x, y: this.walk.y });
  }

  /** A player finished hopping on (VehicleConditionSystem): the dino is now driven through their car. */
  private board(ctx: RaceContext, player: PlayerId): void {
    const d = this.dino;
    const car = ctx.players[player];
    if (!d || !car || this.mode !== 'tamed' || this.rider !== null) {
      // too late (it poofed / someone else got it): send the player straight back to a car
      ctx.bus.emit('dino:rideEnded', { player, x: car?.x ?? this.walk.x, y: car?.y ?? this.walk.y });
      return;
    }
    this.mode = 'ridden'; this.modeT = 0;
    this.rider = player;
    this.ride = newRideTimer(this.rideSec);
    const st = ctx.dino;
    st.tamed = false; st.rider = player; st.rideLeftSec = this.rideSec; st.rideTotalSec = this.rideSec;
    d.setDizzy(false); d.setWobble(0); d.setMult(1); d.setHealth(1);
    d.setRider(car.chassis.texture.key, parseInt(PLAYER_COLORS[player].slice(1), 16));
    this.walk = { x: car.x, y: car.y, angle: car.angle, pauseLeft: 0 };
    this.stepTimer = 0;
    d.roar('ROAAAR!', '#ffd34d');
    services.audio.sfx('roar', { pan: this.panFor(ctx), volume: 0.9, rate: 1.25 });
    services.input.rumble(player, 0.7, 350);
    ctx.camera.shake(player, 0.01, 350);
  }

  /** Follow the rider's (invisible, collision-free) car; count the ride down outside question time. */
  private rideTick(dt: number, ctx: RaceContext): boolean {
    const rider = this.rider;
    const car = rider === null ? undefined : ctx.players[rider];
    if (rider === null || !car) { this.endRide(ctx); return false; }
    const { world } = ctx;
    const inside = clampInside(car, world.widthTiles * world.tileSize, world.heightTiles * world.tileSize, DINO_RIDE.edgePad);
    if (inside) {
      ctx.scene.matter.body.setPosition(car.body, inside, false);
      ctx.scene.matter.body.setVelocity(car.body, { x: 0, y: 0 });
    }
    this.walk.x = car.x; this.walk.y = car.y; this.walk.angle = car.angle;
    if (!this.roundOver && stepRide(this.ride, dt, this.question[rider])) { this.endRide(ctx); return false; }
    ctx.dino.rideLeftSec = this.ride.left;
    const v = car.velocity;
    return Math.hypot(v.x, v.y) >= DINO_RIDE.stepMinSpeed;
  }

  /** Time's up: the rider hops back to a car (VehicleConditionSystem), the dino roars happily and poofs. */
  private endRide(ctx: RaceContext): void {
    const player = this.rider;
    this.mode = 'dismount'; this.modeT = 0;
    this.rider = null;
    const st = ctx.dino;
    st.rider = null; st.rideLeftSec = 0;
    const d = this.dino;
    if (d) {
      d.setRider(null);
      d.roar('ROAAAR!', '#ffd34d');
    }
    services.audio.sfx('roar', { pan: this.panFor(ctx), volume: 0.8, rate: 1.35 });
    if (player !== null) ctx.bus.emit('dino:rideEnded', { player, x: this.walk.x, y: this.walk.y });
  }

  private poofOut(ctx: RaceContext, d: Dino): void {
    this.mode = 'poof'; this.modeT = 0;
    d.poof();
    const st = ctx.dino;
    st.active = false; st.tamed = false; st.rider = null;
    services.audio.sfx('pop', { volume: 0.9 });
    services.audio.sfx('shockwave', { volume: 0.5 });
  }

  /** Ridden: traffic in the way gets the comic toss; the other player's car is just pushed aside. */
  private rideContacts(ctx: RaceContext, d: Dino): void {
    const cap = this.contactCapsule();
    for (const car of ctx.players) {
      if (car.player === this.rider || car.airborne || car.boardingPosition || !capsuleHit(cap, car.x, car.y, CAR_RADIUS)) continue;
      const n = this.contactNormal(cap, car);
      const v = car.velocity;
      const out = v.x * n.x + v.y * n.y;
      if (out < DINO_RIDE.playerPush) car.applyImpulse(n.x * (DINO_RIDE.playerPush - out), n.y * (DINO_RIDE.playerPush - out));
    }
    for (const npc of ctx.npcs) {
      if (npc.destroyed || !this.touchesNpc(cap, npc)) continue;
      const { x, y } = npc;
      d.toss(npc, this.contactNormal(cap, npc));
      ctx.npcs.delete(npc);
      npc.destroy();
      ctx.bus.emit('dino:squash', { x, y });
      this.smashSound(ctx, x, y);
    }
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
    if (this.mode === 'ridden' && this.rider !== null) {
      ctx.camera.shake(this.rider, DINO_RIDE.stepShake, 110);
      services.input.rumble(this.rider, 0.25, 90);
    }
    const side = (Math.floor(this.clock / DINO.stepIntervalSec) % 2 === 0 ? -1 : 1) as -1 | 1;
    const f = d.foot(side);
    d.dust(f.x, f.y);
  }

  private squash(ctx: RaceContext, d: Dino, npc: INpcVehicle): void {
    const x = npc.x, y = npc.y;
    ctx.npcs.delete(npc);
    npc.squash();
    d.smash(x, y);
    ctx.bus.emit('dino:squash', { x, y });
    this.smashSound(ctx, x, y);
  }

  private smashSound(ctx: RaceContext, x: number, y: number): void {
    if (this.nearestPlayerDist(ctx) <= DINO.stepAudioRange) {
      services.audio.sfx('squash', { pan: this.panFor(ctx), volume: 0.9 });
    }
    ctx.camera.shakeAt(x, y, DINO.shakeRadius, 0.007, 150);
  }
}
