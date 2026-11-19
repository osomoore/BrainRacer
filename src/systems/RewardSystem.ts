import Phaser from 'phaser';
import { DEPTH, PLAYER_COLORS, REWARDS } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import { ownerOf, type GameSystem, type IPlayerCar, type RaceContext } from '../core/race';
import type { Rng } from '../core/rng';
import { services } from '../core/services';
import type { PlayerId } from '../core/types';
import { ParticlePool } from '../fx/ParticlePool';
import { extendTurbo, pickFlavor, type Flavor } from './rewardPick';

const POPUP: Record<Flavor, string> = { rainbow: '🌈', shockwave: '💥', ghost: '👻', magnet: '🧲' };
const RAINBOW = [0xff3b30, 0xff9500, 0xffd60a, 0x34c759, 0x1e6fff, 0xa855f7];
const STEP_HZ = 60;

interface PState {
  turboLeft: number;
  flavor: Flavor | null;
  flavorLeft: number;
  lastFlavor: Flavor | null;
  aura: Phaser.GameObjects.Image;
  flameAcc: number; lineAcc: number; trailAcc: number; ghostAcc: number; swirlAcc: number;
  swirl: number;
}

const hex = (c: string) => parseInt(c.replace('#', ''), 16);

/** Correct-answer rewards (turbo + one random flavor) and gameplay FX (crash sparks, landing dust). */
export class RewardSystem implements GameSystem {
  readonly name = 'rewards';
  private ctx!: RaceContext;
  private pool!: ParticlePool;
  private rng!: Rng;
  private states: PState[] = [];
  private offs: (() => void)[] = [];
  private keyHandler?: (e: KeyboardEvent) => void;
  private clock = 0;

  init(ctx: RaceContext): void {
    this.ctx = ctx;
    this.rng = ctx.rng.fork(0x4d52);
    this.pool = new ParticlePool(ctx.scene, REWARDS.fxMaxParticles);
    this.states = ctx.players.map((car, i) => ({
      turboLeft: 0, flavor: null, flavorLeft: 0, lastFlavor: null,
      aura: ctx.scene.add.image(car.x, car.y, TEX.fxDust).setBlendMode(Phaser.BlendModes.ADD)
        .setTint(hex(PLAYER_COLORS[i % PLAYER_COLORS.length])).setDepth(DEPTH.vehicle - 1).setVisible(false),
      flameAcc: 0, lineAcc: 0, trailAcc: 0, ghostAcc: 0, swirlAcc: 0, swirl: 0,
    }));
    this.offs.push(ctx.bus.on('challenge:resolved', (e) => {
      if (e.result === 'correct') this.grant(e.challenge.player);
    }));
    this.offs.push(ctx.bus.on('vehicle:crash', (e) => this.crashFx(e.x, e.y, e.impact)));
    this.offs.push(ctx.bus.on('jump:land', (e) => this.dustRing(e.x, e.y)));

    if (new URLSearchParams(location.search).get('rewards') === '1') {
      const map: Record<string, Flavor> = { F1: 'rainbow', F2: 'shockwave', F3: 'ghost', F4: 'magnet' };
      this.keyHandler = (e) => {
        const f = map[e.code];
        if (!f) return;
        e.preventDefault();
        this.grant(0, f);
      };
      window.addEventListener('keydown', this.keyHandler);
    }
  }

  private color(p: PlayerId): number { return hex(PLAYER_COLORS[p % PLAYER_COLORS.length]); }

  grant(p: PlayerId, forced?: Flavor): void {
    const car = this.ctx.players[p];
    const st = this.states[p];
    if (!car || !st) return;
    const bus = this.ctx.bus;

    // TURBO (always; stacking extends)
    st.turboLeft = extendTurbo(st.turboLeft, REWARDS.turboSec, REWARDS.turboMaxSec);
    car.setTurbo(true);
    services.audio.sfx('turbo');
    services.input.rumble(p, 0.9, 350);
    this.ctx.camera.shake(p, 0.008, 120);
    bus.emit('ui:popup', { player: p, text: 'TURBO!', color: '#ffd60a' });
    bus.emit('reward:granted', { player: p, reward: 'turbo', durationSec: st.turboLeft });
    this.turboBurst(car, p);

    // FLAVOR
    const flavor = forced ?? pickFlavor(this.rng, REWARDS.flavorWeights, st.lastFlavor);
    st.lastFlavor = flavor;
    if (st.flavor) this.endFlavor(p, car, st);
    const dur = flavor === 'magnet' ? REWARDS.magnetSec : REWARDS.flavorSec;
    st.flavor = flavor;
    st.flavorLeft = dur;
    bus.emit('ui:popup', { player: p, text: POPUP[flavor] });
    bus.emit('reward:granted', { player: p, reward: flavor, durationSec: dur });
    switch (flavor) {
      case 'rainbow': this.starBurst(car.x, car.y, 28); break;
      case 'shockwave': this.shockwave(car, p); st.flavorLeft = REWARDS.shockwaveSec; break;
      case 'ghost': car.setGhost(true); break;
      case 'magnet': this.starBurst(car.x, car.y, 14, 0xffd24a); break;
    }
  }

  private endFlavor(p: PlayerId, car: IPlayerCar, st: PState): void {
    const f = st.flavor;
    if (!f) return;
    if (f === 'ghost') car.setGhost(false);
    st.flavor = null;
    st.flavorLeft = 0;
    this.ctx.bus.emit('reward:ended', { player: p, reward: f });
  }

  update(dt: number, ctx: RaceContext): void {
    this.clock += dt;
    for (let i = 0; i < this.states.length; i++) {
      const p = i as PlayerId;
      const car = ctx.players[p];
      const st = this.states[p];
      if (!car || !st) continue;

      if (st.turboLeft > 0) {
        st.turboLeft -= dt;
        if (st.turboLeft <= 0) {
          st.turboLeft = 0;
          car.setTurbo(false);
          ctx.bus.emit('reward:ended', { player: p, reward: 'turbo' });
        } else this.turboFx(car, st, dt);
      }
      const turbo = st.turboLeft > 0;
      const magnet = st.flavor === 'magnet';
      st.aura.setVisible(turbo || magnet);
      if (st.aura.visible) {
        const pulse = 1 + 0.12 * Math.sin(this.clock * 18);
        st.aura.setPosition(car.x, car.y).setScale((turbo ? 13 : 8) * pulse).setAlpha(turbo ? 1 : 0.7);
        st.aura.setTint(turbo ? this.color(p) : 0xffd24a);
      }

      if (st.flavor) {
        st.flavorLeft -= dt;
        if (st.flavorLeft <= 0) this.endFlavor(p, car, st);
        else if (st.flavor === 'rainbow') this.rainbowFx(car, st, dt);
        else if (st.flavor === 'ghost') this.ghostFx(car, st, dt);
        else if (st.flavor === 'magnet') this.magnetFx(car, st, dt);
      }
    }
    this.pool.update(dt);
  }

  // ───────── emitters ─────────
  private rear(car: IPlayerCar, off = 0.5): { x: number; y: number; c: number; s: number } {
    const c = Math.cos(car.angle), s = Math.sin(car.angle);
    const d = car.spec.length * off;
    return { x: car.x - c * d, y: car.y - s * d, c, s };
  }

  private turboFx(car: IPlayerCar, st: PState, dt: number): void {
    const r = this.rear(car);
    const v = car.velocity;
    st.flameAcc += dt * 90;
    while (st.flameAcc >= 1) {
      st.flameAcc -= 1;
      const sp = this.rng.range(250, 520);
      const a = car.angle + Math.PI + this.rng.range(-0.25, 0.25);
      const side = this.rng.range(-8, 8);
      this.pool.spawn({
        key: TEX.fxFlame, x: r.x - r.s * side, y: r.y + r.c * side,
        vx: v.x * 0.4 + Math.cos(a) * sp, vy: v.y * 0.4 + Math.sin(a) * sp,
        life: this.rng.range(0.25, 0.45), s0: 2.6, s1: 0.5, a0: 1, a1: 0, rot: a + Math.PI / 2,
        add: true, depth: DEPTH.vehicle - 1,
      });
    }
    st.lineAcc += dt * 40;
    while (st.lineAcc >= 1) {
      st.lineAcc -= 1;
      const side = this.rng.range(-170, 170);
      const ahead = this.rng.range(-120, 260);
      this.pool.spawn({
        key: TEX.fxConfetti, x: car.x + r.c * ahead - r.s * side, y: car.y + r.s * ahead + r.c * side,
        vx: -r.c * 900 + v.x * 0.2, vy: -r.s * 900 + v.y * 0.2, life: 0.28, s0: 1, s1: 1, sx: 9,
        a0: 0.9, a1: 0, rot: car.angle, add: true, depth: DEPTH.fx,
      });
    }
  }

  private turboBurst(car: IPlayerCar, p: PlayerId): void {
    const col = this.color(p);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      this.pool.spawn({ key: TEX.fxSpark, x: car.x, y: car.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, life: 0.45, s0: 1.8, s1: 0.4, add: true, tint: i % 2 ? 0xffd60a : col, drag: 3 });
    }
    this.ring(car.x, car.y, 260, 0.35, col);
  }

  private ring(x: number, y: number, radius: number, sec: number, tint: number): void {
    this.pool.spawn({ key: TEX.fxRing, x, y, life: sec, s0: 0.05, s1: radius / 118, a0: 1, a1: 0, add: true, tint });
  }

  private starBurst(x: number, y: number, n: number, tint?: number): void {
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2), sp = this.rng.range(200, 600);
      this.pool.spawn({
        key: TEX.fxStar, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: this.rng.range(0.6, 1.0),
        s0: this.rng.range(0.9, 1.6), s1: 0.2, spin: this.rng.range(-8, 8), drag: 2.5, add: true,
        tint: tint ?? RAINBOW[i % RAINBOW.length],
      });
    }
  }

  private rainbowFx(car: IPlayerCar, st: PState, dt: number): void {
    const r = this.rear(car, 0.4);
    st.trailAcc += dt * 55;
    while (st.trailAcc >= 1) {
      st.trailAcc -= 1;
      this.pool.spawn({
        key: TEX.fxRainbow, x: r.x, y: r.y, life: 0.9,
        s0: 1.7, s1: 1.3, a0: 1, a1: 0, rot: car.angle, depth: DEPTH.vehicle - 1,
      });
    }
    if (this.rng.chance(dt * 40)) {
      this.pool.spawn({
        key: TEX.fxStar, x: r.x + this.rng.range(-40, 40), y: r.y + this.rng.range(-40, 40), life: 0.8,
        vy: -30, s0: this.rng.range(0.5, 1.1), s1: 0, spin: 5, add: true, tint: this.rng.pick(RAINBOW),
      });
    }
  }

  private ghostFx(car: IPlayerCar, st: PState, dt: number): void {
    const spr = car.view.list[1] as Phaser.GameObjects.Image | undefined;
    st.ghostAcc += dt * 24;
    while (st.ghostAcc >= 1) {
      st.ghostAcc -= 1;
      if (!spr?.texture) continue;
      const sc = car.spec.length / spr.width;
      this.pool.spawn({
        key: spr.texture.key, x: car.x, y: car.y, rot: car.angle, life: 0.5,
        s0: sc, s1: sc * 1.1, a0: 0.55, a1: 0, tint: 0x9fd8ff, add: true, depth: DEPTH.vehicle - 1,
      });
    }
    if (this.rng.chance(dt * 20)) {
      this.pool.spawn({ key: TEX.fxStar, x: car.x + this.rng.range(-50, 50), y: car.y + this.rng.range(-50, 50), vy: -60, life: 0.7, s0: 0.8, s1: 0, add: true, tint: 0xd8f0ff });
    }
  }

  private magnetFx(car: IPlayerCar, st: PState, dt: number): void {
    st.swirl += dt * 7;
    st.swirlAcc += dt * 50;
    while (st.swirlAcc >= 1) {
      st.swirlAcc -= 1;
      const a = st.swirl + this.rng.range(0, 0.4), rad = this.rng.range(50, 90);
      this.pool.spawn({
        key: TEX.fxSpark, x: car.x + Math.cos(a) * rad, y: car.y + Math.sin(a) * rad,
        vx: -Math.sin(a) * 140, vy: Math.cos(a) * 140, life: 0.5, s0: 1.3, s1: 0.2, add: true, tint: 0xffd24a,
      });
    }
  }

  private shockwave(car: IPlayerCar, p: PlayerId): void {
    const R = REWARDS.shockwaveRadius;
    this.ring(car.x, car.y, R, REWARDS.shockwaveSec, 0xffffff);
    this.ring(car.x, car.y, R * 0.8, REWARDS.shockwaveSec * 1.2, this.color(p));
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      this.pool.spawn({ key: TEX.fxSpark, x: car.x, y: car.y, vx: Math.cos(a) * R * 2.2, vy: Math.sin(a) * R * 2.2, life: 0.4, s0: 1.6, s1: 0.5, add: true, drag: 4, tint: 0xfff2a8 });
    }
    services.audio.sfx('shockwave');
    this.ctx.camera.shakeAt(car.x, car.y, 1200, 0.012, 250);
    services.input.rumble(p, 1, 300);

    const push = (x: number, y: number) => {
      const dx = x - car.x, dy = y - car.y, d = Math.hypot(dx, dy);
      if (d > R) return null;
      const k = 1 - d / R, n = d < 1 ? { x: 1, y: 0 } : { x: dx / d, y: dy / d };
      return { f: REWARDS.shockwaveImpulse * (0.25 + 0.75 * k), n };
    };
    const seen = new Set<unknown>();
    for (const npc of this.ctx.npcs) {
      if (npc.destroyed) continue;
      seen.add(npc.body);
      const h = push(npc.x, npc.y);
      if (h) npc.applyImpulse(h.n.x * h.f * STEP_HZ, h.n.y * h.f * STEP_HZ, (this.rng.next() - 0.5) * 0.8 * h.f);
    }
    const bodies = (this.ctx.scene.matter.world as unknown as { localWorld: { bodies: MatterJS.BodyType[] } }).localWorld.bodies ?? [];
    for (const b of bodies) {
      if (b.isStatic || b.parent !== b || seen.has(b)) continue;
      const o = ownerOf(b);
      if (o && o.kind !== 'prop') continue;
      const h = push(b.position.x, b.position.y);
      if (!h) continue;
      this.ctx.scene.matter.body.setVelocity(b, { x: b.velocity.x + h.n.x * h.f, y: b.velocity.y + h.n.y * h.f });
    }
  }

  // ───────── crash / landing FX ─────────
  private crashFx(x: number, y: number, impact: number): void {
    if (impact <= REWARDS.crashSparkMin) return;
    const big = impact > REWARDS.crashSmokeMin;
    const n = big ? 14 : 8;
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2), sp = this.rng.range(150, 450);
      this.pool.spawn({
        key: TEX.fxSpark, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: this.rng.range(0.25, 0.5),
        s0: this.rng.range(0.8, 1.4), s1: 0.1, add: true, drag: 3, tint: this.rng.chance(0.5) ? 0xffd60a : 0xff8a1a,
      });
    }
    if (big) {
      for (let i = 0; i < 3; i++) {
        this.pool.spawn({
          key: TEX.fxSmoke, x: x + this.rng.range(-12, 12), y: y + this.rng.range(-12, 12), vx: this.rng.range(-40, 40), vy: this.rng.range(-60, -10),
          life: 0.8, s0: 0.8, s1: 2.2, a0: 0.7, a1: 0, tint: 0xcfcfcf, drag: 1.5,
        });
      }
    }
  }

  private dustRing(x: number, y: number): void {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      this.pool.spawn({
        key: TEX.fxDust, x, y, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, life: 0.55,
        s0: 1, s1: 2.6, a0: 0.9, a1: 0, tint: 0xd8c8a8, drag: 4,
      });
    }
  }

  destroy(): void {
    for (const off of this.offs) off();
    this.offs = [];
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    for (let i = 0; i < this.states.length; i++) {
      const p = i as PlayerId;
      const car = this.ctx.players[p];
      if (car) { try { car.setTurbo(false); car.setGhost(false); } catch { /* scene gone */ } }
      this.states[p].aura.destroy();
    }
    this.states = [];
    this.pool.destroy();
  }
}
