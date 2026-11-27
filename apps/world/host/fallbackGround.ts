import { WORLD, WORLD_HOST } from '../config';
import { DEPTH, type WorldContext, type WorldModule } from '../core/runtime';
import type { BiomeId, HexPlan } from '../core/types';
import { corners } from '../gen/hex';
import { nearbyHexes } from './liveWorld';

const colors: Record<BiomeId, string> = {
  meadow: '#63975c', mud: '#9b7656', rocky: '#838784', lake: '#6d9b92', darkwood: '#415f4b',
  snow: '#c7dde1', desert: '#d3a766', jungle: '#4f8d65', canyon: '#b98161', geyser: '#92a996',
};
const rasterScale = 0.25;
const width = Math.ceil(WORLD.hexSize * Math.sqrt(3) * rasterScale) + 2;
const height = Math.ceil(2 * WORLD.hexSize * rasterScale) + 2;

/** Temporary ground with the generated roads for orientation. TerrainModule replaces it. */
export class FallbackGround implements WorldModule {
  private ctx!: WorldContext;
  private readonly hexes = new Map<string, Phaser.GameObjects.Image>();

  init(ctx: WorldContext): void { this.ctx = ctx; }

  update(): void {
    const { players, world } = this.ctx;
    const needed = nearbyHexes(world, players, 1);
    for (const [key, coord] of needed) {
      const plan = world.plan(coord);
      const close = players.some(({ move, camera }) => {
        // Bounding circle covers the rotated viewport plus the forward camera offset.
        const lookAhead = (WORLD_HOST.camera.carScreenY - 0.5) * camera.height;
        const reach = (Math.hypot(camera.width, camera.height) / 2 + lookAhead) / camera.zoom;
        return Math.hypot(move.x - plan.center.x, move.y - plan.center.y) <= WORLD.hexSize + reach;
      });
      if (!close) needed.delete(key);
    }
    for (const [key, image] of this.hexes) {
      if (needed.has(key)) continue;
      this.remove(key, image);
      this.hexes.delete(key);
    }
    for (const [key, coord] of needed) {
      if (!this.hexes.has(key)) this.hexes.set(key, this.bake(key, world.plan(coord)));
    }
  }

  destroy(): void {
    for (const [key, image] of this.hexes) this.remove(key, image);
    this.hexes.clear();
  }

  private bake(key: string, plan: HexPlan): Phaser.GameObjects.Image {
    const { scene } = this.ctx;
    const texture = scene.textures.createCanvas(`world:w5a:ground:${key}`, width, height)!;
    const c = texture.context;
    c.translate(width / 2, height / 2);
    c.scale(rasterScale, rasterScale);
    c.translate(-plan.center.x, -plan.center.y);
    c.beginPath();
    const [first, ...rest] = corners(plan.coord);
    c.moveTo(first.x, first.y);
    for (const p of rest) c.lineTo(p.x, p.y);
    c.closePath();
    c.fillStyle = colors[plan.biome];
    c.fill();
    c.clip();

    c.lineJoin = 'round';
    c.lineCap = 'round';
    for (const road of [...plan.roads].sort((a, b) => a.width - b.width)) {
      const [start, ...points] = road.points;
      if (!start || !points.length) continue;
      c.beginPath();
      c.moveTo(start.x, start.y);
      for (const p of points) c.lineTo(p.x, p.y);
      c.setLineDash([]);
      c.lineWidth = road.width + 12;
      c.strokeStyle = '#665846';
      c.stroke();
      c.lineWidth = road.width;
      c.strokeStyle = road.kind === 'road' ? '#afa28c' : '#bd9d72';
      c.stroke();
      if (road.kind === 'road') {
        c.lineWidth = 4;
        c.strokeStyle = '#e9d7a6';
        c.setLineDash([28, 38]);
        c.stroke();
      }
    }
    texture.refresh();
    return scene.add.image(plan.center.x, plan.center.y, texture)
      .setScale(1 / rasterScale).setDepth(DEPTH.ground);
  }

  private remove(key: string, image: Phaser.GameObjects.Image): void {
    image.destroy();
    this.ctx.scene.textures.remove(`world:w5a:ground:${key}`);
  }
}
