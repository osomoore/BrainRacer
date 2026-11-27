import Phaser from 'phaser';
import { WORLD_PLAY } from '../config';
import { DEPTH, type WorldContext, type WorldPlayer } from '../core/runtime';
import type { Feature, Obstacle, SurfaceKind, Vec } from '../core/types';

type ParticleKind = 'dust' | 'mud' | 'splash' | 'snow' | 'poof';
type Particle = { image: Phaser.GameObjects.Image; vx: number; vy: number; life: number; age: number; spin: number };

const COLORS: Record<ParticleKind, number> = { dust: 0xcba66c, mud: 0x70513d, splash: 0x8fe8ed, snow: 0xf4ffff, poof: 0xffe4aa };
const PARTICLE_SIZE = 24;

/** Baked and pooled cosmetic effects shared by the World play module. */
export class PlayEffects {
  private readonly particles: Particle[] = [];
  private readonly pool: Phaser.GameObjects.Image[] = [];
  private readonly shadows = new Map<WorldPlayer, Phaser.GameObjects.Ellipse>();
  private readonly off: (() => void)[] = [];
  private readonly signs: { image: Phaser.GameObjects.Image; life: number }[] = [];
  private readonly bends = new Map<string, { obstacle: Obstacle; life: number; image?: Phaser.GameObjects.Image; scaleY?: number }>();
  private readonly gapBumps = new Map<WorldPlayer, number>();
  private lastPushDust = -Infinity;

  constructor(private readonly ctx: WorldContext) {
    for (const player of ctx.players) {
      const shadow = ctx.scene.add.ellipse(player.move.x, player.move.y + 13, 78, 36, 0x183b38, 0.36)
        .setDepth(19).setVisible(false);
      this.shadows.set(player, shadow);
    }
    this.off.push(ctx.bus.on('obstacle:effect', ({ obstacle, effect }) => {
      if (effect === 'break') this.burst('poof', obstacle.at, 8);
      if (effect === 'pass' && obstacle.kind === 'bush' && !this.bends.has(obstacle.id)) {
        this.bends.set(obstacle.id, { obstacle, life: BEND_SECONDS });
      }
      if (effect === 'push' && ctx.time - this.lastPushDust > 0.09) {
        this.lastPushDust = ctx.time;
        this.burst('dust', obstacle.at, 2);
      }
    }));
    this.off.push(ctx.bus.on('player:swap', ({ player }) => this.burst('poof', player.move, 10)));
    this.off.push(ctx.bus.on('player:respawn', ({ player, at }) => this.burst('poof', at, 12, player)));
    ctx.scene.events.on('postupdate', this.postUpdate, this);
  }

  /** Call once per frame; emits a short trail while moving over loose surfaces. */
  update(dt: number): void {
    for (const player of this.ctx.players) {
      const { move } = player;
      const shadow = this.shadows.get(player)!;
      shadow.setPosition(move.x, move.y + 13 + Math.min(16, move.airborne * 30))
        .setScale(1 + Math.min(0.42, move.airborne * 0.6), 1 - Math.min(0.36, move.airborne * 0.45))
        .setAlpha(move.airborne > 0 ? 0.2 : 0.36).setVisible(true);
      const speed = Math.hypot(move.vx, move.vy);
      if (move.airborne === 0 && speed > 18 && Math.random() < Math.min(1, dt * (6 + speed / 22))) {
        const kind = particleFor(this.ctx.world.surfaceAt(move.x, move.y).kind);
        const angle = Math.atan2(move.vy, move.vx);
        const x = move.x - Math.cos(angle) * 27, y = move.y - Math.sin(angle) * 27;
        if (kind === 'splash') {
          for (const side of [-1, 1]) {
            this.emit(kind, { x: x - side * Math.sin(angle) * 16, y: y + side * Math.cos(angle) * 16 },
              undefined, angle + side * 2.2);
          }
        } else if (kind) this.emit(kind, { x, y });
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) {
        p.image.setVisible(false);
        this.pool.push(p.image);
        this.particles.splice(i, 1);
        continue;
      }
      p.image.x += p.vx * dt;
      p.image.y += p.vy * dt;
      p.vy -= 18 * dt;
      p.image.rotation += p.spin * dt;
      const t = p.age / p.life;
      p.image.setAlpha(1 - t).setScale(0.65 + t * 0.8);
    }
    for (let i = this.signs.length - 1; i >= 0; i--) {
      const sign = this.signs[i]; sign.life -= dt;
      sign.image.setAlpha(Math.min(1, sign.life * 2));
      if (sign.life <= 0) { sign.image.destroy(); this.signs.splice(i, 1); }
    }
    for (const bend of this.bends.values()) bend.life -= dt;
  }

  /** Aim the sign toward the detour from the approach, where both players can see their own cue. */
  blocked(player: WorldPlayer, feature: Feature): void {
    this.burst('poof', player.move, 3, player);
    if (feature.kind === 'jump') {
      this.gapBumps.set(player, this.ctx.time);
      return;
    }
    if (!feature.bypass) return;
    const { move, camera } = player;
    // Generated bridge bypasses run on the opposite side from the canyon and tunnel paths.
    const side = feature.kind === 'bridge' ? 1 : -1;
    const angle = feature.dir + side * Math.PI / 2;
    const distance = 110 / camera.zoom;
    const image = this.ctx.scene.add.image(move.x + Math.cos(angle) * distance, move.y + Math.sin(angle) * distance,
      this.texture('sign')).setDisplaySize(48 / camera.zoom, 48 / camera.zoom).setRotation(angle + Math.PI / 2)
      .setDepth(DEPTH.popups);
    this.ctx.showOnlyTo(image, player);
    this.signs.push({ image, life: WORLD_PLAY.bumpCooldown });
  }

  destroy(): void {
    this.off.forEach(off => off());
    this.ctx.scene.events.off('postupdate', this.postUpdate, this);
    this.shadows.forEach(shadow => shadow.destroy());
    [...this.particles.map(p => p.image), ...this.pool, ...this.signs.map(s => s.image)].forEach(image => image.destroy());
    this.particles.length = 0; this.pool.length = 0; this.signs.length = 0;
    this.bends.clear();
    this.gapBumps.clear();
    this.shadows.clear();
  }

  private emit(kind: ParticleKind, at: Vec, player?: WorldPlayer, travelAngle = Math.random() * Math.PI * 2): void {
    if (this.particles.length >= 180) return;
    const image = this.pool.pop() ?? this.ctx.scene.add.image(0, 0, this.texture(kind));
    image.cameraFilter = 0;
    image.setTexture(this.texture(kind)).setPosition(at.x, at.y).setDepth(21).setRotation(Math.random() * Math.PI)
      .setAlpha(1).setScale(0.65).setVisible(true);
    if (player) this.ctx.showOnlyTo(image, player);
    const speed = 16 + Math.random() * 42;
    this.particles.push({ image, vx: Math.cos(travelAngle) * speed, vy: Math.sin(travelAngle) * speed,
      life: 0.35 + Math.random() * 0.25, age: 0, spin: (Math.random() - 0.5) * 3 });
  }

  private burst(kind: ParticleKind, at: Vec, count: number, player?: WorldPlayer): void {
    for (let i = 0; i < count; i++) this.emit(kind, at, player);
  }

  private postUpdate(): void {
    for (const [id, bend] of this.bends) {
      const { x, y } = bend.obstacle.at;
      if (!bend.image) {
        bend.image = this.ctx.scene.children.list.find((object): object is Phaser.GameObjects.Image =>
          object instanceof Phaser.GameObjects.Image && object.visible && object.x === x && object.y === y
          && object.texture.key === 'world:w5a:obstacle:bush');
        bend.scaleY = bend.image?.scaleY;
      }
      if (bend.image && bend.scaleY !== undefined && bend.image.x === x && bend.image.y === y) {
        const squash = Math.sin(Math.PI * Math.max(0, bend.life / BEND_SECONDS)) * 0.4;
        bend.image.scaleY = bend.scaleY * (1 - squash);
      }
      if (bend.life <= 0) this.bends.delete(id);
    }
    for (const player of this.ctx.players) {
      if (!player.sprite) continue;
      const sinceBump = this.ctx.time - (this.gapBumps.get(player) ?? -Infinity);
      if (sinceBump < 0.3) {
        const progress = sinceBump / 0.3;
        player.sprite.scaleX *= 1 - Math.sin(progress * Math.PI * 2) * (1 - progress) * 0.24;
        continue;
      }
      this.gapBumps.delete(player);
      if (player.move.airborne === 0 && player.surface.kind === 'rough' && Math.hypot(player.move.vx, player.move.vy) > 20) {
        const phase = this.ctx.time * 34 + player.index * 1.7;
        player.sprite.x = player.move.x + Math.sin(phase) * 1.7;
        player.sprite.y = player.move.y + Math.cos(phase * 1.31) * 1.3;
      }
    }
  }

  private texture(kind: ParticleKind | 'sign'): string {
    const key = `world:w6:effect:${kind}`;
    if (this.ctx.scene.textures.exists(key)) return key;
    const g = this.ctx.scene.make.graphics({ x: 0, y: 0 });
    if (kind === 'sign') {
      g.fillStyle(0xfff1bc).fillRoundedRect(2, 2, 44, 44, 8).lineStyle(3, 0x654c38).strokeRoundedRect(2, 2, 44, 44, 8);
      g.fillStyle(0x348b72).fillTriangle(12, 18, 34, 18, 23, 7).fillRect(20, 17, 6, 18);
    } else {
      g.fillStyle(COLORS[kind], kind === 'poof' ? 0.9 : 0.82);
      if (kind === 'snow') g.fillCircle(12, 12, 8);
      else if (kind === 'splash') g.fillTriangle(12, 1, 22, 21, 2, 21);
      else g.fillEllipse(12, 12, 18, kind === 'mud' ? 12 : 15);
    }
    g.generateTexture(key, kind === 'sign' ? 48 : PARTICLE_SIZE, kind === 'sign' ? 48 : PARTICLE_SIZE);
    g.destroy();
    return key;
  }
}

const BEND_SECONDS = 0.38;

function particleFor(surface: SurfaceKind): ParticleKind | undefined {
  if (surface === 'sand' || surface === 'rough' || surface === 'tallGrass') return 'dust';
  if (surface === 'mud' || surface === 'deepMud') return 'mud';
  if (surface === 'shallow' || surface === 'deep' || surface === 'hotSpring') return 'splash';
  if (surface === 'snow') return 'snow';
  return undefined;
}
