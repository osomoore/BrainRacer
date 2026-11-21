import type Phaser from 'phaser';
import { CAT, DEPTH, QUEUED_FEATURES as F } from '../config/gameConfig';
import { isQueuedMap, type QueuedMap } from '../config/queuedMaps';
import type { GameSystem, IPlayerCar, RaceContext } from '../core/race';
import { services } from '../core/services';
import { Tile, type Vec2 } from '../core/types';
import { ParticlePool } from '../fx/ParticlePool';
import { hasQueuedRail, queuedFeatureSites, queuedVolcanoPeak } from '../world/gen/queuedWorlds';
import { QUEUED_PALETTES } from '../world/queuedWorldArt';
import { advanceGate, overlapsGate, shuttlePosition, type GateCycle } from './queuedWorldCycle';
import { queuedEruptionTexture, queuedFeatureTextures, queuedLavaDropTexture, queuedPlaneTexture } from './queuedWorldFeatureArt';

type Sites = ReturnType<typeof queuedFeatureSites>;
type Mover = {
  sprite: Phaser.GameObjects.Image;
  offset: number;
  lateral: number;
  scatter?: { started: number; away: Vec2 };
};

export class QueuedWorldSystem implements GameSystem {
  readonly name = 'queuedWorld';
  private ctx?: RaceContext;
  private map!: QueuedMap;
  private sites!: Sites;
  private gateTiles: number[] = [];
  private objects: Phaser.GameObjects.GameObject[] = [];
  private signals: Phaser.GameObjects.Image[] = [];
  private movers: Mover[] = [];
  private touchedAt = new Map<IPlayerCar, number>();
  private deck?: Phaser.GameObjects.Image;
  private bridgeLeaves: Phaser.GameObjects.Image[] = [];
  private barrier!: Phaser.GameObjects.Image;
  private eruption?: Phaser.GameObjects.Image;
  private lavaDrips?: { pool: ParticlePool; key: string; previous?: Vec2; next: number; side: number };
  private plane?: Phaser.GameObjects.Image;
  private gate?: MatterJS.BodyType;
  private clock = 0;
  private cycle: GateCycle = { mode: 'open', elapsed: 0 };
  private ended = false;
  private offEnd?: () => void;

  init(ctx: RaceContext): void {
    if (!isQueuedMap(ctx.settings.map)) return;
    this.ctx = ctx;
    this.map = ctx.settings.map;
    this.sites = queuedFeatureSites(this.map, ctx.world);
    this.offEnd = ctx.bus.on('round:end', () => { this.ended = true; });
    if (new URLSearchParams(location.search).get('feature') === 'now') this.cycle.elapsed = F.openSec - F.testLeadSec;

    const { scene, world } = ctx;
    const { gate, mover } = this.sites;
    const art = queuedFeatureTextures(scene, this.map);
    const span = world.tileSize * F.gateSpanTiles;
    this.gateTiles = gate.tiles.map(i => world.tiles[i]);
    if (this.map === 'castle' || this.map === 'mushroom') this.addLiftBridge(gate, art.deck, world.tileSize, span);
    else this.deck = this.addImage(gate, art.deck, DEPTH.decal - 1, 'queued-shortcut-deck')
      .setRotation(gate.angle).setDisplaySize(world.tileSize, span);
    this.barrier = this.addImage(gate, art.gate, DEPTH.prop, 'queued-shortcut-barrier')
      .setRotation(gate.angle).setDisplaySize(F.gateDepthPx + 4, span);
    for (const side of [-1, 1]) {
      const edge = pointAlong(gate, 0, side * (span / 2 - 15));
      this.signals.push(this.addImage(edge, art.signal, DEPTH.prop + 1, 'queued-shortcut-signal'));
    }
    this.addShuttle(mover, art);
    if (this.map === 'volcano') {
      this.eruption = this.addImage(queuedVolcanoPeak(world), queuedEruptionTexture(scene), DEPTH.fx - 4, 'queued-volcano-eruption')
        .setOrigin(.5, .84);
      const key = queuedLavaDropTexture(scene);
      const pool = new ParticlePool(scene, F.lavaDrips.count)
        .prewarm(key, [{ depth: DEPTH.dino + 1, add: false, count: F.lavaDrips.count }]);
      this.lavaDrips = { key, pool, next: 0, side: 1 };
    }
    if (this.map === 'airport') {
      this.plane = this.addImage(mover, queuedPlaneTexture(scene), DEPTH.airborne + 1, 'queued-airport-plane');
    }
    this.drawGate();
    this.drawMovers();
  }

  update(dt: number, ctx: RaceContext): void {
    if (!this.ctx || this.ended || ctx.paused || ctx.questionBreak || ctx.timeExpired) return;
    this.clock += dt;
    const before = this.cycle.mode;
    this.cycle = advanceGate(this.cycle, dt, F, () => this.crossingOccupied(ctx));
    if (before !== this.cycle.mode) {
      if (this.cycle.mode === 'closed') this.closeGate(ctx);
      if (this.cycle.mode === 'open') this.openGate(ctx);
      if (this.cycle.mode === 'warning') this.warn(ctx);
    }
    this.drawGate();
    this.drawMovers();
    this.bumpCars(ctx);
    this.dripLava(dt, ctx.dino);
  }

  destroy(): void {
    this.offEnd?.();
    if (this.ctx) this.openGate(this.ctx);
    for (const object of this.objects) object.destroy();
    this.objects.length = 0;
    this.signals.length = 0;
    this.movers.length = 0;
    this.bridgeLeaves.length = 0;
    this.touchedAt.clear();
    this.lavaDrips?.pool.destroy();
    this.lavaDrips = undefined;
    this.ctx = undefined;
  }

  private addImage(at: Vec2, key: string, depth: number, name: string): Phaser.GameObjects.Image {
    const image = this.ctx!.scene.add.image(at.x, at.y, key).setDepth(depth).setName(name);
    this.objects.push(image);
    return image;
  }

  private addLiftBridge(gate: Sites['gate'], key: string, width: number, span: number): void {
    const { scene } = this.ctx!;
    const waterColor = Number.parseInt(QUEUED_PALETTES[this.map].floor[0].slice(1), 16);
    const channel = scene.add.rectangle(gate.x, gate.y, width, span, waterColor)
      .setRotation(gate.angle).setDepth(DEPTH.decal - 2);
    this.objects.push(channel);
    const texture = scene.textures.get(key);
    const { width: sourceWidth, height: sourceHeight } = texture.get();
    for (const side of [-1, 1]) {
      const frame = side === -1 ? 'west-leaf' : 'east-leaf';
      if (!texture.has(frame)) texture.add(frame, 0, side === -1 ? 0 : sourceWidth / 2, 0, sourceWidth / 2, sourceHeight);
      const hinge = pointAlong(gate, side * width / 2, 0);
      const leaf = scene.add.image(hinge.x, hinge.y, key, frame).setName('queued-bridge-leaf').setOrigin(side === -1 ? 0 : 1, .5)
        .setRotation(gate.angle).setDisplaySize(width / 2, span).setDepth(DEPTH.decal - 1);
      this.objects.push(leaf);
      this.bridgeLeaves.push(leaf);
    }
  }

  private addShuttle(mover: Sites['mover'], art: ReturnType<typeof queuedFeatureTextures>): void {
    if (hasQueuedRail(this.map)) return;
    const track = this.ctx!.scene.add.tileSprite(mover.x, mover.y, mover.length + 126, 78, art.track)
      .setDepth(DEPTH.decal - 2).setRotation(mover.angle).setName('queued-mover-track');
    this.objects.push(track);
    const config = F.movers[this.map];
    for (let i = 0; i < config.count; i++) {
      const offset = (i - (config.count - 1) / 2) * config.spacing;
      const lateral = (this.map === 'castle' || this.map === 'tundra') ? (i % 2 ? 20 : -20) : 0;
      const sprite = this.addImage(mover, art.mover, DEPTH.vehicle - 1, `queued-mover-${i}`).setScale(config.scale);
      this.movers.push({ sprite, offset, lateral });
    }
  }

  private crossingOccupied({ players, npcs, dino, world }: RaceContext): boolean {
    // Clear the whole marked deck before replacing its drivable tiles for jump landings.
    const area = { ...this.sites.gate, depth: world.tileSize, span: world.tileSize * F.gateSpanTiles };
    const vehicleOverlaps = (car: { x: number; y: number; spec: { length: number; width: number } }) =>
      overlapsGate(area, car, F.clearancePx + Math.hypot(car.spec.length, car.spec.width) / 2);
    return players.some(vehicleOverlaps) || [...npcs].some(car => !car.destroyed && vehicleOverlaps(car)) ||
      (dino.active && overlapsGate(area, dino, dino.radius + F.clearancePx));
  }

  private closeGate(ctx: RaceContext): void {
    const { x, y, angle, tiles } = this.sites.gate;
    const body = ctx.scene.matter.add.rectangle(x, y, F.gateDepthPx, ctx.world.tileSize * F.gateSpanTiles, {
      isStatic: true,
      angle,
      friction: .02,
      restitution: .23,
      label: `queued-gate-${this.map}`,
      collisionFilter: { category: CAT.static, mask: 0xffff, group: 0 },
      plugin: { owner: { kind: 'boundary' } },
    });
    this.gate = body as unknown as MatterJS.BodyType;
    for (const tile of tiles) ctx.world.tiles[tile] = Tile.Water;
    if (this.map === 'volcano') {
      ctx.camera.shakeAt(x, y, F.soundRadius, .012, 480);
      const volume = this.soundGain(ctx, { x, y });
      if (volume > 0) services.audio.sfx('stomp', { volume, rate: .72 });
    }
  }

  private openGate(ctx: RaceContext): void {
    if (!this.gate) return;
    ctx.scene.matter.world?.remove(this.gate);
    this.gate = undefined;
    this.sites.gate.tiles.forEach((tile, i) => { ctx.world.tiles[tile] = this.gateTiles[i]; });
  }

  private soundGain(ctx: RaceContext, position: Vec2): number {
    const distance = Math.min(...ctx.players.map(car => Math.hypot(car.x - position.x, car.y - position.y)));
    return Math.max(0, 1 - distance / F.soundRadius);
  }

  private warn(ctx: RaceContext): void {
    const volume = this.soundGain(ctx, this.sites.gate);
    if (volume > 0) services.audio.sfx('crossing', { volume });
  }

  private drawGate(): void {
    const closed = this.cycle.mode === 'closed';
    const warning = this.cycle.mode === 'warning';
    const lift = closed ? Math.min(1, this.cycle.elapsed / F.animationSec, (F.closedSec - this.cycle.elapsed) / F.animationSec) : 0;
    const flash = Math.floor(this.clock * F.signalBlinkHz * 2);
    this.barrier.setVisible(closed).setTint(this.map === 'volcano' ? 0xffb958 : 0xffffff);
    const deckWidth = this.ctx!.world.tileSize;
    if (this.deck) this.deck.setDisplaySize(deckWidth * (1 - lift * .62), this.deck.displayHeight)
      .setTint(closed ? (this.map === 'volcano' ? 0xff6c48 : 0x9b8bab) : 0xffffff);
    for (const leaf of this.bridgeLeaves) {
      leaf.setDisplaySize(deckWidth / 2 * (1 - lift * .76), leaf.displayHeight)
        .setTint(lift > .1 ? 0xb7a9c1 : 0xffffff);
    }
    this.signals.forEach((signal, i) => {
      signal.setTint(closed ? 0xff6b6b : warning ? (flash + i) % 2 ? 0xffc15d : 0xffe2a0 : 0x87e9ad);
    });
    if (this.eruption) {
      this.eruption.setVisible(closed).setAlpha(.92 * lift)
        .setScale(.68 + lift * (.72 + Math.sin(this.clock * 13) * .12));
    }
  }

  private drawMovers(): void {
    const route = this.sites.mover;
    if (this.plane) {
      const progress = (this.clock % F.airportPlanePeriodSec) / F.airportPlanePeriodSec;
      const position = pointAlong(route, (progress - .5) * (route.length + 320), 148);
      this.plane.setPosition(position.x, position.y).setRotation(route.angle)
        .setAlpha(Math.min(1, progress * 10, (1 - progress) * 10) * .92)
        .setScale(.78 + Math.sin(progress * Math.PI) * .32);
    }
    if (hasQueuedRail(this.map)) return;
    const config = F.movers[this.map];
    const travel = Math.max(0, (route.length - (config.count - 1) * config.spacing) / 2);
    const phase = this.clock + 3;
    const outbound = (phase % config.periodSec) < config.periodSec / 2;
    const head = shuttlePosition(phase, config.periodSec) * travel;
    for (const mover of this.movers) {
      const { sprite, offset, lateral, scatter } = mover;
      const slalom = this.map === 'tundra' ? Math.sin(phase * 2 + offset) * 15 : 0;
      const position = pointAlong(route, head + offset, lateral + slalom);
      if (scatter) {
        const age = (this.clock - scatter.started) / F.castleScatterSec;
        const shift = Math.sin(Math.PI * Math.min(1, age)) * F.castleScatterPx;
        position.x += scatter.away.x * shift;
        position.y += scatter.away.y * shift;
        if (age >= 1) mover.scatter = undefined;
      }
      sprite.setPosition(position.x, position.y).setRotation(route.angle).setFlipX(!outbound);
      if (this.map === 'volcano') sprite.setVisible(this.cycle.mode === 'closed');
    }
  }

  private bumpCars(ctx: RaceContext): void {
    for (const car of ctx.players) {
      if (car.airborne || car.disabled || car.riding || car.ghost) continue;
      if (this.clock - (this.touchedAt.get(car) ?? -Infinity) < F.moverBumpCooldownSec) continue;
      for (const mover of this.movers) {
        const { sprite } = mover;
        if (!sprite.visible || mover.scatter) continue;
        const dx = car.x - sprite.x, dy = car.y - sprite.y;
        const d = Math.hypot(dx, dy);
        if (d >= F.moverTouchRadius * sprite.scaleX + car.spec.width / 2) continue;
        const nx = d > 0 ? dx / d : -Math.sin(this.sites.mover.angle);
        const ny = d > 0 ? dy / d : Math.cos(this.sites.mover.angle);
        if (this.map === 'castle') mover.scatter = { started: this.clock, away: { x: -nx, y: -ny } };
        else car.applyImpulse(nx * F.moverBumpSpeed, ny * F.moverBumpSpeed);
        this.touchedAt.set(car, this.clock);
        services.audio.sfx('pop', { volume: .4 });
        break;
      }
    }
  }

  private dripLava(dt: number, boss: RaceContext['dino']): void {
    const drips = this.lavaDrips;
    if (!drips) return;
    drips.pool.update(dt);
    const previous = drips.previous;
    drips.previous = boss.active ? { x: boss.x, y: boss.y } : undefined;
    const { intervalSec, lifeSec, moveSpeed, fallSpeed } = F.lavaDrips;
    if (!boss.active || !previous || this.clock < drips.next ||
      Math.hypot(boss.x - previous.x, boss.y - previous.y) < moveSpeed * dt) return;

    const at = pointAlong(boss, -45, drips.side * 43);
    const vx = -Math.cos(boss.angle) * 36;
    drips.pool.spawn({ key: drips.key, x: at.x, y: at.y, vx, vy: fallSpeed, drag: 1.3,
      life: lifeSec, s0: .85, s1: .18, depth: DEPTH.dino + 1 });
    drips.next = this.clock + intervalSec;
    drips.side *= -1;
  }
}

function pointAlong(at: Vec2 & { angle: number }, forward: number, lateral: number): Vec2 {
  const cos = Math.cos(at.angle), sin = Math.sin(at.angle);
  return { x: at.x + cos * forward - sin * lateral, y: at.y + sin * forward + cos * lateral };
}
