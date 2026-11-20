import type Phaser from 'phaser';
import { ellipse, fillStroke, rr } from '../art/draw';
import { CAT, DEPTH, SKY, SKY_DRAWBRIDGE } from '../config/gameConfig';
import type { GameSystem, RaceContext } from '../core/race';
import { services } from '../core/services';
import { Tile } from '../core/types';
import { isSkyBridgeDeck } from '../world/gen/sky';
import { box, dirigibleTexture, line, skyBridgeDeck, skyTexture } from '../world/skyArt';

/** Arm lights warn on arrival. Only a clear deck is locked and lifted for the airship. */
export class SkyBridgeSystem implements GameSystem {
  readonly name = 'skyBridge';
  private ctx?: RaceContext;
  private closure?: MatterJS.BodyType;
  private objects: Phaser.GameObjects.Image[] = [];
  private leaves: Phaser.GameObjects.Image[] = [];
  private arms: Phaser.GameObjects.Image[] = [];
  private signals: Phaser.GameObjects.Image[] = [];
  private ship?: Phaser.GameObjects.Image;
  private untilOpen = SKY.bridgeCycleSec - SKY.bridgeOpenSec;
  private openFor = 0;
  private clock = 0;
  private offEnd?: () => void;
  private ended = false;

  init(ctx: RaceContext): void {
    if (ctx.settings.map !== 'sky') return;
    this.ctx = ctx;
    this.offEnd = ctx.bus.on('round:end', () => { this.ended = true; });
    if (new URLSearchParams(location.search).get('sky') === 'now') this.untilOpen = SKY.bridgeWarningSec + SKY.bridgeTestLeadSec;
    const { left, right, row, height } = SKY_DRAWBRIDGE, ts = ctx.world.tileSize, scene = ctx.scene;
    const deckHeight = height * ts;
    const halfWidth = (right - left) * ts / 2;
    const y = (row + height / 2) * ts;
    const add = (x: number, y: number, key: string, depth: number, name: string) => {
      const image = scene.add.image(x, y, key).setDepth(depth).setName(name);
      this.objects.push(image);
      return image;
    };
    const deck = skyBridgeDeck(scene, halfWidth, deckHeight, true);
    this.leaves = [
      add(left * ts, y + 14, deck, DEPTH.ground + 2, 'sky-drawbridge-left').setOrigin(0, .5),
      add(right * ts, y + 14, deck, DEPTH.ground + 2, 'sky-drawbridge-right').setOrigin(0, .5).setFlipY(true).setRotation(Math.PI),
    ];
    const barrier = skyTexture(scene, 'drawbridge-gate', 28, deckHeight, c => {
      rr(c, 2, 4, 24, deckHeight - 8, 7); fillStroke(c, '#fff3cd', '#655174', 4);
      c.save(); rr(c, 4, 7, 20, deckHeight - 14, 5); c.clip();
      for (let yy = -10; yy < deckHeight; yy += 29) line(c, '#e77368', 12, 0, yy, 28, yy + 22);
      c.restore();
    });
    const signal = skyTexture(scene, 'drawbridge-signal', 49, 49, c => {
      rr(c, 4, 4, 41, 41, 10); fillStroke(c, '#534364', '#deb283', 4);
      ellipse(c, 24, 24, 15, 15); fillStroke(c, '#eee9f4', '#8b7890', 4);
      ellipse(c, 21, 19, 4, 4); fillStroke(c, '#fff8ef', null);
      box(c, '#d1a580', 4, 37, 41, 5);
    });
    for (const x of [left * ts, right * ts]) {
      this.arms.push(add(x, y, barrier, DEPTH.prop, 'sky-drawbridge-barrier').setVisible(false));
      for (const ey of [y - deckHeight / 2 + 16, y + deckHeight / 2 - 16]) {
        this.signals.push(add(x, ey, signal, DEPTH.prop + .5, 'sky-drawbridge-signal').setTint(0x9fe8c7));
      }
    }
    this.ship = add((left + right) * ts / 2, y, dirigibleTexture(scene, 2), DEPTH.ground - 1, 'sky-bridge-dirigible')
      .setRotation(-Math.PI / 2).setScale(1.18).setVisible(false);
  }

  update(dt: number, ctx: RaceContext): void {
    if (!this.ctx || this.ended || ctx.paused || ctx.questionBreak) return;
    this.clock += dt;
    if (this.closure) {
      this.openFor += dt;
      if (this.openFor >= SKY.bridgeOpenSec) this.reopen();
    } else {
      const wasWarning = this.untilOpen <= SKY.bridgeWarningSec;
      this.untilOpen = Math.max(0, this.untilOpen - dt);
      if (!wasWarning && this.untilOpen <= SKY.bridgeWarningSec) this.warn(ctx);
      if (this.untilOpen === 0 && this.clear(ctx)) this.lock(ctx);
    }

    const closed = !!this.closure;
    const warning = closed || this.untilOpen <= SKY.bridgeWarningSec;
    const lift = closed ? Math.min(1, this.openFor / SKY.bridgeLiftSec, (SKY.bridgeOpenSec - this.openFor) / SKY.bridgeLiftSec) : 0;
    for (const leaf of this.leaves) leaf.setScale(1 - lift * .89, 1).setTint(closed ? 0xffdfbb : 0xffffff);
    for (const arm of this.arms) arm.setVisible(closed);
    this.signals.forEach((signal, i) => signal.setTint(warning
      ? (Math.floor(this.clock * (closed ? 4 : 2)) + i) % 2 ? 0xff6460 : 0xffcf84
      : 0x9fe8c7));
    this.ship?.setVisible(closed).setY((SKY_DRAWBRIDGE.row + 1 + 8 - 16 * this.openFor / SKY.bridgeOpenSec) * ctx.world.tileSize)
      .setRotation(-Math.PI / 2 + Math.sin(this.clock * 1.6) * .032);
  }

  private warn(ctx: RaceContext): void {
    const { left, right, row, height } = SKY_DRAWBRIDGE;
    const size = ctx.world.tileSize;
    const x = (left + right) * size / 2, y = (row + height / 2) * size;
    const closest = Math.min(...ctx.players.map(car => Math.hypot(car.x - x, car.y - y)));
    const volume = Math.max(0, 1 - closest / SKY.bridgeSoundRadius);
    if (volume > 0) services.audio.sfx('crossing', { volume, rate: 0.82 });
  }

  private clear({ players, npcs, dino, world }: RaceContext): boolean {
    const ts = world.tileSize, { left, right, row, height } = SKY_DRAWBRIDGE;
    const overlaps = (x: number, y: number, radius: number) => {
      const pad = radius + SKY.bridgeClearance;
      return x >= left * ts - pad && x <= right * ts + pad && y >= row * ts - pad && y <= (row + height) * ts + pad;
    };
    return !players.some(car => overlaps(car.x, car.y, Math.hypot(car.spec.length, car.spec.width) / 2)) &&
      ![...npcs].some(car => !car.destroyed && overlaps(car.x, car.y, Math.hypot(car.spec.length, car.spec.width) / 2)) &&
      !(dino.active && overlaps(dino.x, dino.y, dino.radius));
  }

  private lock(ctx: RaceContext): void {
    const ts = ctx.world.tileSize, { left, right, row, height } = SKY_DRAWBRIDGE;
    const body = ctx.scene.matter.add.rectangle((left + right) * ts / 2, (row + height / 2) * ts,
      (right - left) * ts, height * ts, { isStatic: true, friction: .02, restitution: .2,
        collisionFilter: { category: CAT.static, mask: 0xffff, group: 0 }, plugin: { owner: { kind: 'boundary' } } });
    this.closure = body as unknown as MatterJS.BodyType;
    this.closure.label = 'sky-raised-drawbridge';
    this.openFor = 0;
    this.setDeck(Tile.Water);
  }

  private reopen(): void {
    if (!this.closure) return;
    this.ctx?.scene.matter.world?.remove(this.closure);
    this.closure = undefined;
    this.untilOpen = SKY.bridgeCycleSec - SKY.bridgeOpenSec;
    this.openFor = 0;
    this.setDeck(Tile.Road);
  }

  private setDeck(tile: Tile): void {
    const world = this.ctx?.world;
    if (!world) return;
    const { left, right, row, height } = SKY_DRAWBRIDGE;
    for (let x = left; x < right; x++) for (let y = row; y < row + height; y++) {
      if (isSkyBridgeDeck(x, y)) world.tiles[y * world.widthTiles + x] = tile;
    }
  }

  destroy(): void {
    this.offEnd?.();
    this.reopen();
    for (const object of this.objects) object.destroy();
    this.objects = [];
    this.ctx = undefined;
  }
}
