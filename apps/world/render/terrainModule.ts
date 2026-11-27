import type Phaser from 'phaser';
import { WORLD_TERRAIN_RENDER } from '../config';
import { visibilityRadius } from '../logic/rules';
import { DEPTH, type WorldContext, type WorldModule } from '../core/runtime';
import { chunkKey, LruCache, prioritizeChunks, type ChunkRequest } from './terrainCore';
import { bakeTerrain } from './terrainBake';

interface BakedChunk { image: Phaser.GameObjects.Image; textureKey: string }
interface DarknessLayer { image: Phaser.GameObjects.Image; canvas: HTMLCanvasElement; texture: Phaser.Textures.CanvasTexture;
  dark: number; radius: number; x: number; y: number }

/** Progressive, bounded terrain texture renderer. */
export default class TerrainModule implements WorldModule {
  static order = 300;
  private ctx!: WorldContext;
  private readonly chunks = new LruCache<BakedChunk>(WORLD_TERRAIN_RENDER.cacheChunks);
  private readonly ownedChunks = new Set<BakedChunk>();
  private readonly overlays: DarknessLayer[] = [];
  private baked = 0;
  private bakeMs = 0;
  private sequence = 0;

  /** Read-only profiling counters for the dev terrain view. */
  get stats(): Readonly<{ chunksBaked: number; totalBakeMs: number }> {
    return { chunksBaked: this.baked, totalBakeMs: this.bakeMs };
  }

  init(ctx: WorldContext): void {
    this.ctx = ctx;
    ctx.players.forEach((player) => {
      const key = `world-dark-${player.index}-${this.sequence++}`;
      const width = Math.max(1, Math.ceil(player.camera.width));
      const height = Math.max(1, Math.ceil(player.camera.height));
      const canvas = ctx.scene.textures.createCanvas(key, width, height);
      if (canvas) {
        const c = canvas.getSourceImage() as HTMLCanvasElement;
        const overlay = ctx.scene.add.image(player.camera.x, player.camera.y, key)
          .setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.darkness).setVisible(false);
        ctx.showOnlyTo(overlay, player);
        this.overlays.push({ image: overlay, canvas: c, texture: canvas, dark: -1, radius: -1, x: -Infinity, y: -Infinity });
      }
    });
  }

  update(_dt: number): void {
    this.updateDarkness();
    const size = WORLD_TERRAIN_RENDER.chunkSize;
    const span = size;
    const requests = new Map<string, ChunkRequest>();
    const pinned = new Set<string>();
    for (const player of this.ctx.players) {
      const cam = player.camera;
      // Include corners rotated outside Phaser's unrotated worldView bounds.
      const corners = [
        cam.getWorldPoint(cam.x, cam.y), cam.getWorldPoint(cam.x + cam.width, cam.y),
        cam.getWorldPoint(cam.x, cam.y + cam.height), cam.getWorldPoint(cam.x + cam.width, cam.y + cam.height),
      ];
      const left = Math.floor(Math.min(...corners.map((point) => point.x)) / span);
      const right = Math.floor(Math.max(...corners.map((point) => point.x)) / span);
      const top = Math.floor(Math.min(...corners.map((point) => point.y)) / span);
      const bottom = Math.floor(Math.max(...corners.map((point) => point.y)) / span);
      const px = player.move.x, py = player.move.y;
      const consider = (x: number, y: number, visible: boolean): void => {
        const key = chunkKey(x, y);
        if (visible) pinned.add(key);
        if (this.chunks.get(key)) return;
        const dx = (x + 0.5) * span - px, dy = (y + 0.5) * span - py;
        const request = { x, y, dx, dy, visible, distance: Math.hypot(dx, dy) / span, heading: player.move.angle };
        const old = requests.get(key);
        if (!old || (visible && !old.visible)
          || (visible === Boolean(old.visible) && request.distance < old.distance)) requests.set(key, request);
      };
      for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) consider(x, y, true);
      const aheadX = Math.cos(player.move.angle), aheadY = Math.sin(player.move.angle);
      if (pinned.size < WORLD_TERRAIN_RENDER.cacheChunks) {
        for (let step = 1; step <= WORLD_TERRAIN_RENDER.prefetchRings; step++) {
          consider(Math.floor((px + aheadX * span * step) / span), Math.floor((py + aheadY * span * step) / span), false);
        }
      }
    }

    const ordered = prioritizeChunks([...requests.values()]);
    for (const request of ordered.slice(0, WORLD_TERRAIN_RENDER.bakePerFrame)) {
      const x = request.x * span, y = request.y * span;
      const key = chunkKey(request.x, request.y);
      const textureKey = `world-terrain-${this.sequence++}`;
      const bleed = 1;
      const texture = this.ctx.scene.textures.createCanvas(textureKey, size + bleed * 2, size + bleed * 2);
      if (!texture) continue;
      const canvas = texture.getSourceImage() as HTMLCanvasElement;
      const context = canvas.getContext('2d');
      if (!context) { this.ctx.scene.textures.remove(textureKey); continue; }
      const started = performance.now();
      bakeTerrain(context, this.ctx.world, x - bleed, y - bleed, size + bleed * 2, WORLD_TERRAIN_RENDER.cellSize);
      texture.refresh();
      this.bakeMs += performance.now() - started;
      this.baked++;
      const image = this.ctx.scene.add.image(x - bleed, y - bleed, textureKey)
        .setOrigin(0).setDepth(DEPTH.ground);
      const chunk = { image, textureKey };
      this.ownedChunks.add(chunk);
      const evicted = this.chunks.set(key, chunk, pinned);
      if (evicted) this.removeChunk(evicted);
    }
  }

  destroy(): void {
    this.ownedChunks.forEach((chunk) => this.removeChunk(chunk));
    this.chunks.clear();
    this.overlays.forEach(({ image, texture }) => {
      const key = texture.key;
      image.destroy();
      if (this.ctx.scene.textures.exists(key)) this.ctx.scene.textures.remove(key);
    });
    this.overlays.length = 0;
  }

  private updateDarkness(): void {
    this.ctx.players.forEach((player, i) => {
      const layer = this.overlays[i];
      if (!layer) return;
      const dark = player.surface.dark;
      const visible = dark > 0.03;
      layer.image.setVisible(visible);
      if (!visible) return;
      const radius = visibilityRadius(dark, player.traits);
      const cam = player.camera;
      // Phaser exposes camera rotation at runtime; the installed Camera declaration omits it.
      const rotation = (cam as Phaser.Cameras.Scene2D.Camera & { rotation: number }).rotation;
      const pivotX = cam.width * cam.originX;
      const pivotY = cam.height * cam.originY;
      const dx = player.move.x - cam.midPoint.x;
      const dy = player.move.y - cam.midPoint.y;
      const cos = Math.cos(rotation), sin = Math.sin(rotation);
      const projectedX = pivotX + cam.zoom * (dx * cos - dy * sin);
      const projectedY = pivotY + cam.zoom * (dx * sin + dy * cos);
      // Keep the dim layer viewport-sized; project the player into its clear circle independently.
      layer.image.setPosition(pivotX, pivotY)
        .setRotation(-rotation).setDisplaySize(cam.width / cam.zoom, cam.height / cam.zoom);
      const lightRadius = radius * cam.zoom;
      if (Math.abs(dark - layer.dark) < 0.015 && Math.abs(lightRadius - layer.radius) < 2
        && Math.abs(projectedX - layer.x) < 2 && Math.abs(projectedY - layer.y) < 2) return;
      const g = layer.canvas.getContext('2d');
      if (!g) return;
      g.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
      g.fillStyle = `rgba(0,0,0,${Math.min(0.94, dark * 0.92)})`;
      g.fillRect(0, 0, layer.canvas.width, layer.canvas.height);
      g.globalCompositeOperation = 'destination-out';
      g.beginPath();
      const edge = g.createRadialGradient(projectedX, projectedY,
        lightRadius * 0.76, projectedX, projectedY, lightRadius);
      edge.addColorStop(0, 'rgba(0,0,0,1)');
      edge.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = edge;
      g.arc(projectedX, projectedY, lightRadius, 0, Math.PI * 2);
      g.fill();
      g.globalCompositeOperation = 'source-over';
      layer.texture.refresh();
      layer.dark = dark;
      layer.radius = lightRadius;
      layer.x = projectedX;
      layer.y = projectedY;
    });
  }

  private removeChunk(chunk: BakedChunk): void {
    this.ownedChunks.delete(chunk);
    chunk.image.destroy();
    if (this.ctx.scene.textures.exists(chunk.textureKey)) this.ctx.scene.textures.remove(chunk.textureKey);
  }
}
