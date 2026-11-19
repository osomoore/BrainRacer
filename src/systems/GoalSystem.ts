/** Shared goal zones: pick, draw (world-space), arrival, teammate wait, completion. */
import Phaser from 'phaser';
import { DEPTH, GOALS } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import type { GoalState } from '../core/events';
import type { GameSystem, RaceContext } from '../core/race';
import { services } from '../core/services';
import type { PlayerId } from '../core/types';
import { signSceneFor } from '../data/places';
import { pickGoal } from './goalPick';

const SPARKLES = 8;
const CONFETTI_TINTS = [0xff4d4d, 0xffd43b, 0x4dabf7, 0x69db7c, 0xff922b, 0xe599f7];
const FONT = 'Arial Black, Arial, sans-serif';

interface Visuals {
  ring: Phaser.GameObjects.Image;
  beacon: Phaser.GameObjects.Image;
  sparkles: Phaser.GameObjects.Image[];
  label: Phaser.GameObjects.Text;
}

export class GoalSystem implements GameSystem {
  readonly name = 'goal';
  private ctx!: RaceContext;
  private offs: (() => void)[] = [];
  private vis: Visuals | null = null;
  private arrived = new Set<PlayerId>();
  private waitLeft = -1;
  private nextIn = -1;
  private nextId = 1;
  private started = false;
  private ended = false;
  private recent: string[] = [];
  private prev: { x: number; y: number } | null = null;
  private t = 0;
  private flareUntil = -1;
  private flare = 0;

  init(ctx: RaceContext): void {
    this.ctx = ctx;
    this.offs.push(
      ctx.bus.on('round:start', () => { this.started = true; this.spawn(); }),
      ctx.bus.on('round:end', () => { this.ended = true; }),
      ctx.bus.on('reward:granted', ({ reward, durationSec }) => {
        if (reward === 'magnet') this.flareUntil = Math.max(this.flareUntil, this.t + durationSec);
      }),
    );
  }

  update(dt: number, ctx: RaceContext): void {
    if (!this.started) return;
    this.t += dt;
    this.animate(dt);
    const goal = ctx.goal;
    if (!goal) {
      if (this.nextIn >= 0 && !this.ended) {
        this.nextIn -= dt;
        if (this.nextIn <= 0) { this.nextIn = -1; this.spawn(); }
      }
      return;
    }
    if (this.ended) return;

    for (const car of ctx.players) {
      if (this.arrived.has(car.player) || car.airborne) continue;
      if (Math.hypot(car.x - goal.x, car.y - goal.y) > goal.radius) continue;
      this.arrived.add(car.player);
      const waiting = ctx.players.some((p) => !this.arrived.has(p.player));
      const waitSec = waiting ? GOALS.teammateWaitSec : 0;
      if (waiting && this.waitLeft < 0) this.waitLeft = waitSec;
      ctx.bus.emit('goal:arrived', { goal, player: car.player, waitSec });
      services.audio.sfx('goalArrive');
      this.ringBurst(goal.x, goal.y, 0.5);
    }

    if (this.arrived.size > 0) {
      if (this.arrived.size >= ctx.players.length) this.complete(goal);
      else {
        this.waitLeft -= dt;
        if (this.waitLeft <= 0) this.complete(goal);
      }
    }
  }

  destroy(): void {
    for (const off of this.offs) off();
    this.offs = [];
    this.clearVisuals();
    this.ctx.goal = null;
  }

  // ───────────── goal lifecycle ─────────────
  private spawn() {
    const ctx = this.ctx;
    const isFirst = this.prev === null;
    const origin = this.prev ?? this.midpoint();
    const site = pickGoal(ctx.world.places, origin, isFirst, {
      min: GOALS.minDistance, max: GOALS.maxDistance, firstMin: GOALS.firstMin, firstMax: GOALS.firstMax,
      recentWords: this.recent.slice(-GOALS.recentWords),
    }, () => ctx.rng.next());
    if (!site) return;
    const goal: GoalState = {
      id: this.nextId++, x: site.front.x, y: site.front.y, radius: GOALS.radius,
      placeWord: site.word, sceneId: signSceneFor(site.word),
    };
    this.recent.push(site.word);
    this.prev = { x: goal.x, y: goal.y };
    this.arrived.clear();
    this.waitLeft = -1;
    ctx.goal = goal;
    this.buildVisuals(goal);
    ctx.bus.emit('goal:spawned', { goal });
  }

  private complete(goal: GoalState) {
    const ctx = this.ctx;
    const arrived = [...this.arrived].sort() as PlayerId[];
    ctx.bus.emit('goal:completed', { goal, arrived });
    services.audio.sfx('goal');
    this.confetti(goal.x, goal.y);
    this.ringBurst(goal.x, goal.y, 1);
    ctx.camera.shake(null, GOALS.shakeIntensity, GOALS.shakeMs);
    this.clearVisuals();
    ctx.goal = null;
    this.arrived.clear();
    this.waitLeft = -1;
    this.nextIn = GOALS.nextGoalDelaySec;
  }

  private midpoint() {
    const ps = this.ctx.players;
    if (!ps.length) return { x: 0, y: 0 };
    return { x: ps.reduce((a, p) => a + p.x, 0) / ps.length, y: ps.reduce((a, p) => a + p.y, 0) / ps.length };
  }

  // ───────────── visuals ─────────────
  private buildVisuals(goal: GoalState) {
    const s = this.ctx.scene;
    const ring = s.add.image(goal.x, goal.y, TEX.goalRing).setDepth(DEPTH.decal);
    const beacon = s.add.image(goal.x, goal.y, TEX.beacon).setOrigin(0.5, 1)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.worldUi).setTint(0xfff1a8);
    const sparkles = Array.from({ length: SPARKLES }, () =>
      s.add.image(goal.x, goal.y, TEX.fxSpark).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fx).setTint(0xfff3b0));
    const label = s.add.text(goal.x, goal.y - goal.radius - 90, (goal.placeWord ?? '').toUpperCase(), {
      fontFamily: FONT, fontSize: '120px', color: '#ffffff', stroke: '#14213d', strokeThickness: 18, align: 'center',
    }).setOrigin(0.5).setDepth(DEPTH.worldUi + 1).setShadow(0, 8, '#000000', 6, true, true);
    this.vis = { ring, beacon, sparkles, label };
    this.animate(0);
  }

  private clearVisuals() {
    if (!this.vis) return;
    const v = this.vis;
    this.vis = null;
    const fade = [v.ring, v.beacon, v.label, ...v.sparkles];
    this.ctx.scene.tweens.add({
      targets: fade, alpha: 0, duration: 350,
      onComplete: () => fade.forEach((o) => o.destroy()),
    });
  }

  private animate(dt: number) {
    const v = this.vis, goal = this.ctx.goal;
    if (!v || !goal) return;
    const t = this.t;
    const target = t < this.flareUntil ? 1 : 0;
    this.flare += (target - this.flare) * Math.min(1, dt * 6);
    const pulse = 1 + Math.sin(t * 3) * 0.06;
    const base = (goal.radius * 2) / 360;
    v.ring.setScale(base * pulse * (1 + this.flare * 0.15)).setRotation(t * 0.5);
    const k = (GOALS.magnetFlareScale - 1) * this.flare;
    v.beacon.setScale((4 + 4 * k) * (1 + Math.sin(t * 4) * 0.08), 16 + 16 * k)
      .setAlpha(Math.min(1, 0.55 + Math.sin(t * 2.5) * 0.12 + this.flare * 0.35));
    v.sparkles.forEach((sp, i) => {
      const a = t * 1.3 + (i / SPARKLES) * Math.PI * 2;
      const r = goal.radius * (0.85 + 0.12 * Math.sin(t * 2 + i));
      sp.setPosition(goal.x + Math.cos(a) * r, goal.y + Math.sin(a) * r).setScale(0.8 + 0.5 * Math.sin(t * 5 + i * 2) ** 2);
    });
    v.label.y = goal.y - goal.radius - 90 + Math.sin(t * 2.2) * 10;
  }

  private ringBurst(x: number, y: number, strength: number) {
    const s = this.ctx.scene;
    const img = s.add.image(x, y, TEX.fxRing).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.fx).setScale(0.3).setTint(0xffe066);
    s.tweens.add({ targets: img, scale: 1.6 + strength * 1.6, alpha: 0, duration: 650, ease: 'Cubic.Out', onComplete: () => img.destroy() });
  }

  private confetti(x: number, y: number) {
    const s = this.ctx.scene;
    const em = s.add.particles(x, y, TEX.fxConfetti, {
      speed: { min: 250, max: 750 }, angle: { min: 0, max: 360 }, lifespan: { min: 900, max: 1600 },
      scale: { start: 1.6, end: 0.6 }, rotate: { min: 0, max: 360 }, alpha: { start: 1, end: 0 },
      gravityY: 350, tint: CONFETTI_TINTS, emitting: false,
    }).setDepth(DEPTH.fx);
    em.explode(70);
    s.time.delayedCall(2000, () => em.destroy());
  }
}
