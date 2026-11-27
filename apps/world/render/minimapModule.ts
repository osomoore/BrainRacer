import type Phaser from 'phaser';
import type { BiomeId, HexCoord, Quest } from '../core/types';
import type { WorldContext, WorldModule, WorldPlayer } from '../core/runtime';
import { WORLD } from '../config';
import { BIOME_IDS } from '../core/types';
import { hexKey, hexToWorld } from '../gen/hex';

const RADIUS = 14;
const DIRECTIONS = [{ q: 1, r: 0 }, { q: 0, r: 1 }, { q: -1, r: 1 }, { q: -1, r: 0 }, { q: 0, r: -1 }, { q: 1, r: -1 }];
const BIOME_COLOR: Record<BiomeId, number> = {
  meadow: 0x76b95a, mud: 0x80623c, rocky: 0x92958b, lake: 0x409bc0, darkwood: 0x355b46,
  snow: 0xd7e9ef, desert: 0xd8ae55, jungle: 0x4c9b59, canyon: 0xc86f48, geyser: 0xc9849c,
};

/** Returns the session reveal: the visited hex plus its six immediate neighbors. */
export function revealHexes(visited: ReadonlySet<string>, coord: HexCoord): Set<string> {
  const revealed = new Set(visited);
  revealed.add(hexKey(coord));
  for (let edge = 0; edge < 6; edge++) {
    const d = DIRECTIONS[edge];
    revealed.add(hexKey({ q: coord.q + d.q, r: coord.r + d.r }));
  }
  return revealed;
}

/** Axial hex position in a north-up minimap, relative to the current hex. */
export function minimapPosition(coord: HexCoord, center: HexCoord, radius = RADIUS): { x: number; y: number } {
  const q = coord.q - center.q, r = coord.r - center.r;
  return { x: Math.sqrt(3) * radius * (q + r / 2), y: 1.5 * radius * r };
}

/** World-space position whose camera projection lands at a fixed screen point. */
export function fixedScreenPoint(
  point: { x: number; y: number }, viewport: { x: number; y: number; width: number; height: number }, zoom: number, rotation: number,
): { x: number; y: number } {
  // Scroll-factor-zero objects are positioned in viewport-local coordinates; Phaser adds viewport.x/y itself.
  const px = viewport.width / 2, py = viewport.height / 2;
  const dx = (point.x - px) / (zoom || 1), dy = (point.y - py) / (zoom || 1);
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  return { x: px + dx * cos + dy * sin, y: py - dx * sin + dy * cos };
}

type PlayerMap = {
  player: WorldPlayer;
  objects: Phaser.GameObjects.Image[];
  revealed: Set<string>;
  tileObjects: Map<string, Phaser.GameObjects.Image>;
  markers: Phaser.GameObjects.Image[];
  arrow: Phaser.GameObjects.Image;
  otherArrow: Phaser.GameObjects.Image;
  backdrop: Phaser.GameObjects.Image;
  origin: { x: number; y: number };
  markerSignature: string;
  center: HexCoord;
};

const keyForBiome = (biome: BiomeId) => `world-minimap-tile-${biome}`;

export default class MinimapModule implements WorldModule {
  static order = 400;
  private ctx!: WorldContext;
  private maps: PlayerMap[] = [];
  private visited = new Map<WorldPlayer, Set<string>>();
  private textureIndex = 0;

  init(ctx: WorldContext): void {
    this.ctx = ctx;
    this.createTextures(ctx.scene);
    for (const player of ctx.players) this.createPlayerMap(player);
  }

  update(): void {
    for (const map of this.maps) {
      const { player, origin } = map;
      const hexChanged = map.center.q !== player.hex.q || map.center.r !== player.hex.r;
      if (hexChanged) {
        const visited = revealHexes(this.visited.get(player) ?? new Set<string>(), player.hex);
        this.visited.set(player, visited);
        const visibleReveal = new Set(this.ctx.world.hexesNear(player.move.x, player.move.y, 3)
          .map(hexKey).filter((key) => visited.has(key)));
        this.rebuildTiles(map, visibleReveal);
        map.center = { ...player.hex };
      }

      const markerSignature = `${hexKey(player.hex)}|${player.save.quests.map(({ quest, carrying }) => `${quest.id}:${carrying}`).join(';')}`;
      if (map.markerSignature !== markerSignature) {
        this.updateMarkers(map);
        map.markerSignature = markerSignature;
      }
      for (const other of this.ctx.players) {
        const p = other.index === player.index ? { x: 0, y: 0 } : this.relativePlayerPosition(player, other);
        const arrow = other.index === player.index ? map.arrow : map.otherArrow;
        const length = Math.hypot(p.x, p.y);
        const clampTo = 75;
        const scale = length > clampTo ? clampTo / length : 1;
        arrow.setPosition(origin.x + p.x * scale, origin.y + p.y * scale).setRotation(other.move.angle)
          .setVisible(other.index === player.index || this.ctx.players.length > 1);
        arrow.setData('screenX', origin.x + p.x * scale);
        arrow.setData('screenY', origin.y + p.y * scale);
        arrow.setData('screenRotation', other.move.angle);
      }
      if (this.ctx.players.length > 1 && this.ctx.players[0].move.x === this.ctx.players[1].move.x
          && this.ctx.players[0].move.y === this.ctx.players[1].move.y) {
        map.otherArrow.setData('screenX', origin.x + 5);
      }
      this.layoutObjects(map);
    }
  }

  destroy(): void {
    for (const map of this.maps) {
      map.objects.forEach((object) => object.destroy());
    }
    this.maps = [];
  }

  private createPlayerMap(player: WorldPlayer): void {
    const scene = this.ctx.scene;
    const viewport = cameraRect(player.camera);
    const size = Math.min(180, viewport.width * 0.26);
    const x = viewport.width - size / 2 - 22;
    const y = size / 2 + 22;
    const backdrop = scene.add.image(x, y, 'world-minimap-backdrop').setDepth(10000);
    backdrop.setDisplaySize(size, size);
    const arrow = scene.add.image(x, y, 'world-minimap-arrow').setDepth(10002).setDisplaySize(15, 19);
    const otherArrow = scene.add.image(x, y, 'world-minimap-other').setDepth(10002).setDisplaySize(13, 17).setVisible(false);
    const objects: Phaser.GameObjects.Image[] = [backdrop, arrow, otherArrow];
    this.ctx.showOnlyTo(backdrop, player);
    this.ctx.showOnlyTo(arrow, player);
    this.ctx.showOnlyTo(otherArrow, player);
    for (const object of objects) {
      object.setScrollFactor(0);
      object.setData({ screenX: object.x, screenY: object.y, screenRotation: 0, baseScaleX: object.scaleX, baseScaleY: object.scaleY });
    }
    this.maps.push({ player, objects, revealed: new Set(), tileObjects: new Map(), markers: [], arrow, otherArrow, backdrop,
      markerSignature: '', center: { q: Number.NaN, r: Number.NaN }, origin: { x, y } });
  }

  private rebuildTiles(map: PlayerMap, revealed: Set<string>): void {
    for (const image of map.tileObjects.values()) image.destroy();
    map.tileObjects.clear();
    const center = map.player.hex;
    for (const key of revealed) {
      const [q, r] = key.split(',').map(Number);
      const coord = { q, r };
      const plan = this.ctx.world.plan(coord);
      const point = minimapPosition(coord, center);
      const image = this.ctx.scene.add.image(map.origin.x + point.x, map.origin.y + point.y, keyForBiome(plan.biome))
        .setDepth(10001).setDisplaySize(2 * RADIUS, 2 * RADIUS);
      this.ctx.showOnlyTo(image, map.player);
      image.setScrollFactor(0);
      image.setData({ screenX: map.origin.x + point.x, screenY: map.origin.y + point.y, screenRotation: 0,
        baseScaleX: image.scaleX, baseScaleY: image.scaleY });
      map.tileObjects.set(key, image);
      map.objects.push(image);
    }
    map.revealed = revealed;
  }

  private updateMarkers(map: PlayerMap): void {
    for (const marker of map.markers) marker.destroy();
    map.markers = [];
    const { player } = map;
    for (const coord of this.ctx.world.hexesNear(player.move.x, player.move.y, 3)) {
      const plan = this.ctx.world.plan(coord);
      if (!map.revealed.has(hexKey(coord))) continue;
      if (plan.home) this.addMarker(map, coord, 'world-minimap-home');
      for (const active of player.save.quests) {
        const quest = active.quest;
        const target = !active.carrying && quest.kind === 'fetch'
          ? plan.items.some((item) => item.item === quest.item && plan.biome === quest.fromBiome)
          : questTarget(quest, coord, plan.biome, !!plan.home);
        if (target) this.addMarker(map, coord, 'world-minimap-quest');
      }
    }
    // Keep managed camera contents aligned after markers have been replaced.
    map.objects = [
      map.backdrop, map.arrow, map.otherArrow,
      ...map.tileObjects.values(), ...map.markers,
    ];
  }

  private addMarker(map: PlayerMap, coord: HexCoord, texture: string): void {
    const offset = minimapPosition(coord, map.player.hex);
    const image = this.ctx.scene.add.image(map.origin.x + offset.x, map.origin.y + offset.y, texture)
      .setDepth(10002).setDisplaySize(9, 9);
    this.ctx.showOnlyTo(image, map.player);
    image.setScrollFactor(0);
    image.setData({ screenX: map.origin.x + offset.x, screenY: map.origin.y + offset.y, screenRotation: 0,
      baseScaleX: image.scaleX, baseScaleY: image.scaleY });
    map.markers.push(image);
  }

  private layoutObjects(map: PlayerMap): void {
    const camera = map.player.camera;
    const viewport = cameraRect(camera);
    const zoom = camera.zoom || 1;
    const rotation = (camera as unknown as { rotation: number }).rotation;
    for (const object of map.objects) {
      const data = object.data.values;
      const point = fixedScreenPoint({ x: data.screenX, y: data.screenY }, viewport, zoom, rotation);
      object.setPosition(point.x, point.y);
      object.setRotation(data.screenRotation - rotation);
      object.setScale(data.baseScaleX / zoom, data.baseScaleY / zoom);
    }
  }

  private relativePlayerPosition(player: WorldPlayer, other: WorldPlayer): { x: number; y: number } {
    const playerCenter = hexToWorld(player.hex), otherCenter = hexToWorld(other.hex);
    const hexOffset = minimapPosition(other.hex, player.hex);
    const scale = RADIUS / WORLD.hexSize;
    return {
      x: hexOffset.x + ((other.move.x - otherCenter.x) - (player.move.x - playerCenter.x)) * scale,
      y: hexOffset.y + ((other.move.y - otherCenter.y) - (player.move.y - playerCenter.y)) * scale,
    };
  }

  private createTextures(scene: Phaser.Scene): void {
    for (const biome of BIOME_IDS) {
      this.bakeTexture(scene, keyForBiome(biome), 64, (g) => {
        g.fillStyle(BIOME_COLOR[biome], 1); g.lineStyle(3, 0xeaf5dc, 0.8);
        g.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (-30 + i * 60) * Math.PI / 180;
          const x = 32 + 31 * Math.cos(angle), y = 32 + 31 * Math.sin(angle);
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.closePath(); g.fill(); g.stroke();
      });
    }
    this.bakeTexture(scene, 'world-minimap-backdrop', 192, (g) => {
      g.fillStyle(0x102b35, 0.88); g.fillCircle(96, 96, 94); g.lineStyle(4, 0xf4f2d8, 0.9); g.strokeCircle(96, 96, 93);
    });
    this.bakeTexture(scene, 'world-minimap-arrow', 32, (g) => {
      g.fillStyle(0xffe35b, 1); g.lineStyle(2, 0x382e17, 1); g.beginPath(); g.moveTo(28, 16); g.lineTo(5, 4); g.lineTo(9, 16); g.lineTo(5, 28); g.closePath(); g.fill(); g.stroke();
    });
    this.bakeTexture(scene, 'world-minimap-other', 32, (g) => {
      g.fillStyle(0xff8570, 1); g.lineStyle(2, 0x39251d, 1); g.beginPath(); g.moveTo(28, 16); g.lineTo(5, 4); g.lineTo(9, 16); g.lineTo(5, 28); g.closePath(); g.fill(); g.stroke();
    });
    this.bakeTexture(scene, 'world-minimap-home', 24, (g) => { g.fillStyle(0xffdf58, 1); g.fillCircle(12, 12, 10); g.lineStyle(2, 0x45331a); g.strokeCircle(12, 12, 10); });
    this.bakeTexture(scene, 'world-minimap-quest', 24, (g) => { g.fillStyle(0xf276d2, 1); g.fillCircle(12, 12, 10); g.lineStyle(2, 0x44213f); g.strokeCircle(12, 12, 10); });
  }

  private bakeTexture(scene: Phaser.Scene, key: string, size: number, draw: (g: Phaser.GameObjects.Graphics) => void): void {
    if (scene.textures.exists(key)) return;
    const textureKey = `${key}-${this.textureIndex++}`;
    const graphics = scene.make.graphics({ x: 0, y: 0 });
    draw(graphics);
    graphics.generateTexture(textureKey, size, size);
    graphics.destroy();
    scene.textures.renameTexture(textureKey, key);
  }
}

function cameraRect(camera: Phaser.Cameras.Scene2D.Camera) {
  return { x: camera.x, y: camera.y, width: camera.width, height: camera.height,
    right: camera.x + camera.width, top: camera.y };
}

function questTarget(quest: Quest, coord: HexCoord, biome: BiomeId, home: boolean): boolean {
  if (quest.goal.kind === 'giver') return coord.q === quest.giverHex.q && coord.r === quest.giverHex.r;
  if (quest.goal.kind === 'home') return home;
  return biome === quest.goal.biome;
}
