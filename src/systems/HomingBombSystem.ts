import Phaser from 'phaser';
import { DEPTH, HOMING_BOMB as B } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import type { GameSystem, IPlayerCar, RaceContext } from '../core/race';
import type { Rng } from '../core/rng';
import { services } from '../core/services';
import type { Vec2 } from '../core/types';
import { ensureBombArt } from '../art/homingBombArt';
import { bombPath, nearestBombTarget } from '../entities/homingBombAI';
import { ParticlePool } from '../fx/ParticlePool';
import { isDrivable } from '../world/geometry';

/** One slow, visible comic hazard at a time. Time advances only while the race runs. */
export class HomingBombSystem implements GameSystem {
  readonly name = 'homingBomb';
  private ctx!: RaceContext;
  private rng!: Rng;
  private particles!: ParticlePool;
  private sprite: Phaser.GameObjects.Image | null = null;
  private glow: Phaser.GameObjects.Image | null = null;
  private x = 0; private y = 0;
  private timer = 0; private pathTimer = 0; private clock = 0; private sparkTimer = 0;
  private path: Vec2[] = [];
  private reachable = false;
  private debug = false;
  private ended = false;
  private offEnd?: () => void;

  init(ctx: RaceContext): void {
    this.ctx = ctx; this.rng = ctx.rng.fork(0xb04b);
    this.debug = new URLSearchParams(location.search).get('bomb') === 'now';
    this.timer = this.debug ? B.debugSpawnSec : B.firstSpawnSec;
    this.particles = new ParticlePool(ctx.scene, B.particleLimit);
    ensureBombArt(ctx.scene);
    this.offEnd = ctx.bus.on('round:end', () => { this.ended = true; });
  }

  update(dt: number): void {
    if (this.ended || this.ctx.paused || this.ctx.questionBreak) return;
    this.clock += dt; this.particles.update(dt);
    if (!this.sprite) {
      this.timer -= dt;
      if (this.timer <= 0 && !this.spawn()) this.timer = 1;
      return;
    }
    const target = nearestBombTarget({ x: this.x, y: this.y }, this.ctx.players.filter(p => !p.airborne && !p.riding));
    if (!target) return;
    this.pathTimer -= dt;
    if (this.pathTimer <= 0) {
      const path = bombPath(this.ctx.world, { x: this.x, y: this.y }, target);
      this.reachable = path !== null; this.path = path ?? [];
      this.pathTimer = B.repathSec;
    }
    const point = this.path[0] ?? (this.reachable ? target : { x: this.x, y: this.y });
    const dx = point.x - this.x, dy = point.y - this.y, distance = Math.hypot(dx, dy);
    const step = Math.min(distance, target.spec.maxSpeed * B.speedFraction * dt);
    if (distance > 0) {
      const nx = this.x + dx / distance * step, ny = this.y + dy / distance * step;
      if (isDrivable(this.ctx.world, nx, ny)) { this.x = nx; this.y = ny; }
    }
    if (this.path.length && distance <= step + 0.01) this.path.shift();
    this.sprite.setPosition(this.x, this.y);
    this.glow!.setPosition(this.x + 60, this.y - 103).setScale(0.9 + 0.15 * Math.sin(this.clock * 15)).setAlpha(0.7 + 0.2 * Math.sin(this.clock * 19));
    this.sparkTimer -= dt;
    if (this.sparkTimer <= 0) {
      this.sparkTimer = 0.1;
      this.particles.spawn({ key: TEX.homingBombGlow, x: this.x + 40, y: this.y - 70, vx: this.rng.range(-40, 40), vy: this.rng.range(-100, -30), life: 0.35, s0: 0.12, s1: 0.02, add: true });
    }
    for (const p of this.ctx.players) {
      if (!p.airborne && !p.riding && Math.hypot(p.x - this.x, p.y - this.y) <= B.contactRadius) { this.explode(p); break; }
    }
  }

  private spawn(): boolean {
    const player = this.ctx.players[0]; if (!player) return false;
    const w = this.ctx.world, s = w.tileSize;
    const candidates: Vec2[] = [];
    for (let y = 0; y < w.heightTiles; y++) for (let x = 0; x < w.widthTiles; x++) {
      const p = { x: (x + 0.5) * s, y: (y + 0.5) * s };
      const d = Math.hypot(p.x - player.x, p.y - player.y);
      if (isDrivable(w, p.x, p.y) && d >= (this.debug ? B.debugSpawnDist : B.spawnMinDist) && d <= (this.debug ? B.debugSpawnDist + s * 2 : B.spawnMaxDist)) candidates.push(p);
    }
    this.rng.shuffle(candidates);
    const spot = candidates.find(p => bombPath(w, p, player) !== null);
    if (!spot) return false;
    this.x = spot.x; this.y = spot.y; this.path = []; this.pathTimer = 0;
    this.sprite = this.ctx.scene.add.image(this.x, this.y, TEX.homingBomb).setName('homing-bomb')
      .setDisplaySize(B.diameter, B.diameter).setDepth(DEPTH.vehicle + 1);
    this.glow = this.ctx.scene.add.image(this.x + 60, this.y - 103, TEX.homingBombGlow).setDepth(DEPTH.fx).setBlendMode(Phaser.BlendModes.ADD);
    return true;
  }

  private explode(player: IPlayerCar): void {
    let dx = player.x - this.x, dy = player.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.001) { dx = 1; dy = 0; } else { dx /= d; dy /= d; }
    player.applyImpulse(dx * B.impulse, dy * B.impulse, this.rng.chance(0.5) ? B.spin : -B.spin);
    player.slow(B.slowMult, B.slowSec);
    for (let i = 0; i < 20; i++) {
      const a = this.rng.range(0, Math.PI * 2), speed = this.rng.range(60, 260);
      this.particles.spawn({ key: TEX.homingBombGlow, x: this.x, y: this.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: this.rng.range(0.3, 0.7), s0: this.rng.range(0.3, 0.6), s1: 0.05, add: true });
    }
    this.ctx.camera.shakeAt(this.x, this.y, 1000, 0.008, 250);
    services.audio.sfx('crashBig'); services.input.rumble(player.player, 0.8, 250);
    this.sprite?.destroy(); this.glow?.destroy(); this.sprite = null; this.glow = null;
    this.timer = B.respawnSec; this.debug = false;
  }

  destroy(): void {
    this.offEnd?.(); this.sprite?.destroy(); this.glow?.destroy(); this.particles?.destroy();
    this.sprite = null; this.glow = null;
  }
}
