import Phaser from 'phaser';
import { WORLD_HOST, WORLD_PLAY } from '../config';
import { DEPTH, type WorldContext, type WorldPlayer } from '../core/runtime';
import type { Feature, SurfaceKind, Vec } from '../core/types';
import { bakeIcons, iconKey } from '../hud/icons';

type ParticleKind = 'dust' | 'mud' | 'splash' | 'snow' | 'poof' | 'exhaust';
type Particle = { image: Phaser.GameObjects.Image; vx: number; vy: number; life: number; age: number; spin: number };

const COLORS: Record<ParticleKind, number> = {
  dust: 0xcba66c, mud: 0x70513d, splash: 0x8fe8ed, snow: 0xf4ffff, poof: 0xffe4aa, exhaust: 0xff902e,
};
const PARTICLE_SIZE = 24;
const SHADOW_TEXTURE = 'world-creation-shadow';

function bakeShadow(scene: Phaser.Scene): void {
  if (scene.textures.exists(SHADOW_TEXTURE)) return;
  const size = 128;
  const half = size / 2;
  const texture = scene.textures.createCanvas(SHADOW_TEXTURE, size, size)!;
  const canvas = texture.getContext();
  const gradient = canvas.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, '#183b38');
  gradient.addColorStop(0.7, '#183b38');
  gradient.addColorStop(1, 'rgba(24, 59, 56, 0)');
  canvas.fillStyle = gradient;
  canvas.fillRect(0, 0, size, size);
  texture.refresh();
}

/** Baked and pooled cosmetic effects shared by the World play module. */
export class PlayEffects {
  private readonly particles: Particle[] = [];
  private readonly pool: Phaser.GameObjects.Image[] = [];
  private readonly shadows: { player: WorldPlayer; viewer: WorldPlayer; image: Phaser.GameObjects.Image }[] = [];
  private readonly off: (() => void)[] = [];
  private readonly signs: { image: Phaser.GameObjects.Image; life: number }[] = [];
  private readonly gapBumps = new Map<WorldPlayer, number>();
  private readonly bags = new Map<WorldPlayer, Phaser.GameObjects.Image>();
  private lastPushDust = -Infinity;

  constructor(private readonly ctx: WorldContext) {
    bakeShadow(ctx.scene);
    bakeIcons(ctx.scene);
    for (const viewer of ctx.players) {
      const bag = ctx.scene.add.image(0, 0, iconKey('bag')).setDepth(DEPTH.popups + 1).setVisible(false);
      ctx.showOnlyTo(bag, viewer);
      this.bags.set(viewer, bag);
      for (const player of ctx.players) {
        const image = ctx.scene.add.image(0, 0, SHADOW_TEXTURE).setDepth(DEPTH.players - 1).setVisible(false);
        ctx.showOnlyTo(image, viewer);
        this.shadows.push({ player, viewer, image });
      }
    }
    this.off.push(ctx.bus.on('obstacle:effect', ({ obstacle, effect }) => {
      if (effect === 'break') this.burst('poof', obstacle.at, 8);
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
      const speed = Math.hypot(move.vx, move.vy);
      if (!move.flying && move.airborne === 0 && speed > 18 && Math.random() < Math.min(1, dt * (6 + speed / 22))) {
        const kind = move.boost ? 'exhaust' : particleFor(this.ctx.world.surfaceAt(move.x, move.y).kind);
        const angle = Math.atan2(move.vy, move.vx);
        const x = move.x - Math.cos(angle) * 27, y = move.y - Math.sin(angle) * 27;
        if (kind === 'splash') {
          for (const side of [-1, 1]) {
            this.emit(kind, { x: x - side * Math.sin(angle) * 16, y: y + side * Math.cos(angle) * 16 },
              undefined, angle + side * 2.2);
          }
        } else if (kind === 'exhaust') {
          const tail = WORLD_HOST.playerLengths[player.traits.width - 1] / 2;
          this.emit(kind, { x: move.x - Math.cos(move.angle) * tail, y: move.y - Math.sin(move.angle) * tail },
            undefined, move.angle + Math.PI);
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
    this.shadows.forEach(({ image }) => image.destroy());
    this.bags.forEach(image => image.destroy());
    this.bags.clear();
    [...this.particles.map(p => p.image), ...this.pool, ...this.signs.map(s => s.image)].forEach(image => image.destroy());
    this.particles.length = 0; this.pool.length = 0; this.signs.length = 0;
    this.gapBumps.clear();
    this.shadows.length = 0;
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
    const shadow = WORLD_PLAY.shadow;
    for (const { player, viewer, image } of this.shadows) {
      const { move, sprite, traits } = player;
      image.setVisible(!!sprite);
      if (!sprite) continue;
      const length = WORLD_HOST.playerLengths[traits.width - 1] * shadow.lengthScale;
      const width = length * sprite.height / sprite.width;
      const rotation = this.ctx.viewRotation(viewer);
      const lift = move.flying ? WORLD_PLAY.flight.shadowOffset : Math.min(shadow.airOffset, move.airborne * 90);
      const offset = (shadow.offset + lift) / viewer.camera.zoom;
      image.setPosition(move.x + Math.sin(rotation) * offset, move.y + Math.cos(rotation) * offset)
        .setRotation(move.angle)
        .setDisplaySize(length * (1 + Math.min(0.42, move.airborne * 0.6)), width * (1 - Math.min(0.36, move.airborne * 0.45)))
        .setAlpha(move.flying || move.airborne > 0 ? shadow.airAlpha : shadow.groundAlpha);
    }
    const flight = WORLD_PLAY.flight;
    for (const [player, bag] of this.bags) {
      const left = (player.flapUntil ?? 0) - this.ctx.time;
      bag.setVisible(left > 0);
      if (left <= 0) continue;
      const rotation = this.ctx.viewRotation(player);
      const zoom = player.camera.zoom;
      const lift = flight.bagLift / zoom;
      const wobble = Math.sin((flight.flapSeconds - left) * 30) * 0.25;
      bag.setPosition(player.move.x - Math.sin(rotation) * lift, player.move.y - Math.cos(rotation) * lift)
        .setDisplaySize(flight.bagSize / zoom, flight.bagSize / zoom).setRotation(-rotation + wobble)
        .setAlpha(Math.min(1, left * 6));
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
      if (!player.move.flying && player.move.airborne === 0 && player.surface.kind === 'rough' && Math.hypot(player.move.vx, player.move.vy) > 20) {
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

function particleFor(surface: SurfaceKind): ParticleKind | undefined {
  if (surface === 'sand' || surface === 'rough' || surface === 'tallGrass') return 'dust';
  if (surface === 'mud' || surface === 'deepMud') return 'mud';
  if (surface === 'shallow' || surface === 'deep' || surface === 'hotSpring') return 'splash';
  if (surface === 'snow') return 'snow';
  return undefined;
}
