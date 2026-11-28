import type Phaser from 'phaser';
import type { BiomeId, HexCoord } from '../core/types';
import type { WorldContext, WorldModule, WorldPlayer } from '../core/runtime';
import { WORLD } from '../config';
import { BIOME_IDS } from '../core/types';
import { hexKey } from '../gen/hex';

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

/** Position on the minimap's north-up tile grid, relative to an axial origin. */
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
  root: Phaser.GameObjects.Container;
  terrain: Phaser.GameObjects.Container;
  markers: Phaser.GameObjects.Container;
  visited: Set<string>;
  tiles: Map<string, Phaser.GameObjects.Image>;
  otherArrow: Phaser.GameObjects.Image;
  north: Phaser.GameObjects.Image;
  origin: { x: number; y: number };
  scale: number;
  center: HexCoord;
};

const keyForBiome = (biome: BiomeId) => `world-minimap-tile-${biome}`;
const MAP_SIZE = 180;
const WORLD_SCALE = RADIUS / WORLD.hexSize;
const MAP_ORIGIN = { q: 0, r: 0 };

export default class MinimapModule implements WorldModule {
  static order = 400;
  private ctx!: WorldContext;
  private maps: PlayerMap[] = [];

  init(ctx: WorldContext): void {
    this.ctx = ctx;
    this.createTextures(ctx.scene);
    for (const player of ctx.players) this.createPlayerMap(player);
  }

  update(): void {
    for (const map of this.maps) {
      const { player, origin } = map;
      if (map.center.q !== player.hex.q || map.center.r !== player.hex.r) {
        map.visited = revealHexes(map.visited, player.hex);
        this.updateTiles(map);
        this.updateMarkers(map);
        map.center = { ...player.hex };
      }

      const camera = player.camera;
      const rotation = this.ctx.viewRotation(player);
      const cameraRotation = (camera as Phaser.Cameras.Scene2D.Camera & { rotation: number }).rotation;
      const point = fixedScreenPoint(origin, camera, camera.zoom, cameraRotation);
      map.root.setPosition(point.x, point.y).setRotation(-cameraRotation).setScale(map.scale / camera.zoom);

      const cos = Math.cos(rotation), sin = Math.sin(rotation);
      const x = player.move.x * WORLD_SCALE, y = player.move.y * WORLD_SCALE;
      map.terrain.setRotation(rotation).setPosition(-x * cos + y * sin, -x * sin - y * cos);
      // Fade whole tiles before their corners can reach the rim. Rings outside the backdrop
      // stay cached until the next hex crossing, so scrolling never clips a tile abruptly.
      for (const tile of map.tiles.values()) {
        const distance = Math.hypot(tile.x - x, tile.y - y);
        tile.setAlpha(Math.max(0, Math.min(1, (74 - distance) / 12)));
      }
      for (const marker of map.markers.list as Phaser.GameObjects.Image[]) {
        const distance = Math.hypot(marker.x - x, marker.y - y);
        marker.setAlpha(Math.max(0, Math.min(1, (74 - distance) / 12)));
      }

      map.north.setPosition(82 * sin, -82 * cos);
      const other = this.ctx.players.find(({ index }) => index !== player.index);
      if (other) {
        const dx = (other.move.x - player.move.x) * WORLD_SCALE;
        const dy = (other.move.y - player.move.y) * WORLD_SCALE;
        const scale = 1 / Math.max(1, Math.hypot(dx, dy) / 72);
        map.otherArrow.setPosition((dx * cos - dy * sin) * scale, (dx * sin + dy * cos) * scale)
          .setRotation(other.move.angle + rotation);
        // Both cars spawn at the same point in split screen.
        if (dx === 0 && dy === 0) map.otherArrow.x = 5;
      }
    }
  }

  destroy(): void {
    for (const map of this.maps) map.root.destroy();
    this.maps = [];
  }

  private createPlayerMap(player: WorldPlayer): void {
    const { scene } = this.ctx;
    const { width } = player.camera;
    const size = Math.min(MAP_SIZE, width * 0.26);
    const origin = { x: width - size / 2 - 22, y: size / 2 + 22 };
    const backdrop = scene.add.image(0, 0, 'world-minimap-backdrop').setDisplaySize(MAP_SIZE, MAP_SIZE);
    const otherArrow = scene.add.image(0, 0, 'world-minimap-other').setDisplaySize(17, 13)
      .setVisible(this.ctx.players.length > 1);
    const arrow = scene.add.image(0, 0, 'world-minimap-arrow').setDisplaySize(19, 15).setRotation(-Math.PI / 2);
    const north = scene.add.image(0, 0, 'world-minimap-north').setDisplaySize(17, 17);
    const markers = scene.add.container(0, 0);
    const terrain = scene.add.container(0, 0, [markers]);
    const root = scene.add.container(origin.x, origin.y, [backdrop, terrain, otherArrow, arrow, north])
      .setDepth(10000).setScrollFactor(0);
    this.ctx.showOnlyTo(root, player);
    this.maps.push({ player, root, terrain, markers, visited: new Set(), tiles: new Map(), otherArrow, north,
      center: { q: Number.NaN, r: Number.NaN }, origin, scale: size / MAP_SIZE });
  }

  private updateTiles(map: PlayerMap): void {
    const { player } = map;
    const nearby = new Map(this.ctx.world.hexesNear(player.move.x, player.move.y, 3)
      .map(coord => [hexKey(coord), coord]));
    for (const [key, image] of map.tiles) {
      if (nearby.has(key)) continue;
      image.destroy();
      map.tiles.delete(key);
    }
    for (const [key, coord] of nearby) {
      if (map.tiles.has(key) || !map.visited.has(key)) continue;
      const plan = this.ctx.world.plan(coord);
      const { x, y } = minimapPosition(coord, MAP_ORIGIN);
      const image = this.ctx.scene.add.image(x, y, keyForBiome(plan.biome)).setDisplaySize(2 * RADIUS, 2 * RADIUS);
      map.terrain.addAt(image, map.terrain.length - 1);
      map.tiles.set(key, image);
    }
  }

  private updateMarkers(map: PlayerMap): void {
    map.markers.removeAll(true);
    const { player } = map;
    for (const coord of this.ctx.world.hexesNear(player.move.x, player.move.y, 3)) {
      if (!map.tiles.has(hexKey(coord))) continue;
      const plan = this.ctx.world.plan(coord);
      if (plan.home) this.addMarker(map, coord, 'world-minimap-home');
    }
  }

  private addMarker(map: PlayerMap, coord: HexCoord, texture: string): void {
    const { x, y } = minimapPosition(coord, MAP_ORIGIN);
    map.markers.add(this.ctx.scene.add.image(x, y, texture).setDisplaySize(9, 9));
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
    this.bakeTexture(scene, 'world-minimap-north', 32, (g) => {
      g.fillStyle(0x102b35, 1); g.fillCircle(16, 16, 15);
      g.lineStyle(3, 0xf4f2d8, 1);
      g.beginPath(); g.moveTo(10, 23); g.lineTo(10, 9); g.lineTo(22, 23); g.lineTo(22, 9); g.stroke();
    });
    this.bakeTexture(scene, 'world-minimap-arrow', 32, (g) => {
      g.fillStyle(0xffe35b, 1); g.lineStyle(2, 0x382e17, 1); g.beginPath(); g.moveTo(28, 16); g.lineTo(5, 4); g.lineTo(9, 16); g.lineTo(5, 28); g.closePath(); g.fill(); g.stroke();
    });
    this.bakeTexture(scene, 'world-minimap-other', 32, (g) => {
      g.fillStyle(0xff8570, 1); g.lineStyle(2, 0x39251d, 1); g.beginPath(); g.moveTo(28, 16); g.lineTo(5, 4); g.lineTo(9, 16); g.lineTo(5, 28); g.closePath(); g.fill(); g.stroke();
    });
    this.bakeTexture(scene, 'world-minimap-home', 24, (g) => { g.fillStyle(0xffdf58, 1); g.fillCircle(12, 12, 10); g.lineStyle(2, 0x45331a); g.strokeCircle(12, 12, 10); });
  }

  private bakeTexture(scene: Phaser.Scene, key: string, size: number, draw: (g: Phaser.GameObjects.Graphics) => void): void {
    if (scene.textures.exists(key)) return;
    const graphics = scene.make.graphics({ x: 0, y: 0 });
    draw(graphics);
    graphics.generateTexture(key, size, size);
    graphics.destroy();
  }
}
