import type Phaser from 'phaser';
import { WORLD_TERRAIN_RENDER as RENDER } from '../config';
import { DEPTH, type WorldContext, type WorldModule } from '../core/runtime';
import { chunkKey, LruCache, prioritizeChunks, type ChunkRequest } from './terrainCore';
import { bakeTerrain, type TerrainAtmosphere } from './terrainBake';

interface BakedChunk extends TerrainAtmosphere {
  image: Phaser.GameObjects.Image;
  textureKey: string;
}
interface AtmosphereLayer {
  image: Phaser.GameObjects.Image;
  texture: Phaser.Textures.CanvasTexture;
  heat: CanvasRenderingContext2D;
  pattern: CanvasPattern;
  previous?: string;
  atlas?: AtmosphereAtlas;
}
interface AtmosphereAtlas extends TerrainAtmosphere {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function heatPattern(context: CanvasRenderingContext2D): CanvasPattern {
  const tile = document.createElement('canvas');
  tile.width = 120;
  tile.height = RENDER.heatWaveSpacing;
  const g = tile.getContext('2d')!;
  g.fillStyle = 'rgba(244,166,60,0.2)';
  g.fillRect(0, 0, tile.width, tile.height);
  for (const [offset, color] of [[1.5, '#b76b38'], [0, '#fff4be']] as const) {
    g.beginPath();
    for (let x = 0; x <= tile.width; x++) {
      const y = tile.height / 2 + 3 * Math.sin(x * 6 * Math.PI / tile.width) + offset;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.lineWidth = 1.4;
    g.strokeStyle = color;
    g.stroke();
  }
  return context.createPattern(tile, 'repeat')!;
}

/** Stitch at mask resolution before rotating to avoid bright seams between rotated chunks. */
function stitchMasks(chunks: readonly BakedChunk[], key: string): AtmosphereAtlas {
  const size = RENDER.chunkSize;
  const left = Math.min(...chunks.map(chunk => chunk.image.x + 1));
  const top = Math.min(...chunks.map(chunk => chunk.image.y + 1));
  const width = Math.max(...chunks.map(chunk => chunk.image.x + 1)) + size - left;
  const height = Math.max(...chunks.map(chunk => chunk.image.y + 1)) + size - top;
  const atlas: AtmosphereAtlas = { key, x: left, y: top, width, height };
  for (const kind of ['dark', 'heat'] as const) {
    if (!chunks.some(chunk => chunk[kind])) continue;
    const canvas = document.createElement('canvas');
    const scale = RENDER.atmosphereScale;
    canvas.width = width * scale;
    canvas.height = height * scale;
    const g = canvas.getContext('2d')!;
    for (const chunk of chunks) {
      const mask = chunk[kind];
      if (mask) g.drawImage(mask, (chunk.image.x + 1 - left) * scale, (chunk.image.y + 1 - top) * scale);
    }
    atlas[kind] = canvas;
  }
  return atlas;
}

/** Progressive, bounded terrain texture renderer. */
export default class TerrainModule implements WorldModule {
  static order = 300;
  private ctx!: WorldContext;
  private readonly chunks = new LruCache<BakedChunk>(RENDER.cacheChunks);
  private readonly ownedChunks = new Set<BakedChunk>();
  private readonly overlays: AtmosphereLayer[] = [];
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
      const width = Math.ceil(player.camera.width * RENDER.atmosphereScale);
      const height = Math.ceil(player.camera.height * RENDER.atmosphereScale);
      const texture = ctx.scene.textures.createCanvas(key, width, height);
      if (texture) {
        const scratch = document.createElement('canvas');
        scratch.width = width;
        scratch.height = height;
        const heat = scratch.getContext('2d')!;
        const overlay = ctx.scene.add.image(player.camera.x, player.camera.y, key)
          .setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH.darkness).setVisible(false);
        ctx.showOnlyTo(overlay, player);
        this.overlays[player.index] = { image: overlay, texture, heat, pattern: heatPattern(heat) };
      }
    });
  }

  update(_dt: number): void {
    const size = RENDER.chunkSize;
    const span = size;
    const requests = new Map<string, ChunkRequest>();
    const pinned = new Set<string>();
    const views: string[][] = [];
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
      const visibleKeys = views[player.index] = [] as string[];
      const consider = (x: number, y: number, visible: boolean): void => {
        const key = chunkKey(x, y);
        if (visible) {
          pinned.add(key);
          visibleKeys.push(key);
        }
        if (this.chunks.get(key)) return;
        const dx = (x + 0.5) * span - px, dy = (y + 0.5) * span - py;
        const request = { x, y, dx, dy, visible, distance: Math.hypot(dx, dy) / span, heading: player.move.angle };
        const old = requests.get(key);
        if (!old || (visible && !old.visible)
          || (visible === Boolean(old.visible) && request.distance < old.distance)) requests.set(key, request);
      };
      for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) consider(x, y, true);
      const aheadX = Math.cos(player.move.angle), aheadY = Math.sin(player.move.angle);
      if (pinned.size < RENDER.cacheChunks) {
        for (let step = 1; step <= RENDER.prefetchRings; step++) {
          consider(Math.floor((px + aheadX * span * step) / span), Math.floor((py + aheadY * span * step) / span), false);
        }
      }
    }

    const ordered = prioritizeChunks([...requests.values()]);
    for (const request of ordered.slice(0, RENDER.bakePerFrame)) {
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
      const atmosphere = bakeTerrain(context, this.ctx.world, x - bleed, y - bleed, size + bleed * 2, RENDER.cellSize);
      texture.refresh();
      this.bakeMs += performance.now() - started;
      this.baked++;
      const image = this.ctx.scene.add.image(x - bleed, y - bleed, textureKey)
        .setOrigin(0).setDepth(DEPTH.ground);
      const chunk = { image, textureKey, ...atmosphere };
      this.ownedChunks.add(chunk);
      const evicted = this.chunks.set(key, chunk, pinned);
      if (evicted) this.removeChunk(evicted);
    }
    this.updateAtmosphere(views);
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

  private updateAtmosphere(views: readonly string[][]): void {
    this.ctx.players.forEach((player) => {
      const layer = this.overlays[player.index];
      if (!layer) return;
      const masks = views[player.index].flatMap(key => {
        const chunk = this.chunks.get(key);
        return chunk && (chunk.dark || chunk.heat) ? [chunk] : [];
      });
      layer.image.setVisible(masks.length > 0);
      if (!masks.length) {
        layer.atlas = undefined;
        layer.previous = undefined;
        return;
      }
      const atlasKey = masks.map(chunk => chunk.textureKey).join('|');
      if (layer.atlas?.key !== atlasKey) layer.atlas = stitchMasks(masks, atlasKey);
      const atlas = layer.atlas;
      const cam = player.camera;
      const rotation = this.ctx.viewRotation(player);
      const pivotX = cam.width * cam.originX;
      const pivotY = cam.height * cam.originY;
      layer.image.setPosition(pivotX, pivotY)
        .setRotation(-rotation).setDisplaySize(cam.width / cam.zoom, cam.height / cam.zoom);

      const scale = RENDER.atmosphereScale;
      const zoom = cam.zoom * scale;
      const radius = RENDER.lightRadius[player.traits.light] * zoom;
      const hasHeat = !!atlas.heat;
      const phase = hasHeat ? Math.floor(this.ctx.time * RENDER.heatWaveSpeed * RENDER.heatWaveSpacing) : 0;
      const midX = cam.scrollX + pivotX, midY = cam.scrollY + pivotY;
      const drawKey = [midX, midY, rotation, zoom, radius, player.move.x, player.move.y, phase, atlasKey].join('|');
      if (drawKey === layer.previous) return;
      layer.previous = drawKey;
      const g = layer.texture.context;
      const { width, height } = g.canvas;
      const cos = Math.cos(rotation), sin = Math.sin(rotation);
      const drawMasks = (target: CanvasRenderingContext2D, kind: keyof TerrainAtmosphere) => {
        target.clearRect(0, 0, width, height);
        target.save();
        target.translate(pivotX * scale, pivotY * scale);
        target.rotate(rotation);
        target.scale(zoom, zoom);
        target.translate(-midX, -midY);
        const mask = atlas[kind];
        if (mask) target.drawImage(mask, atlas.x, atlas.y, atlas.width, atlas.height);
        target.restore();
      };
      drawMasks(g, 'dark');
      if (radius > 0) {
        const dx = player.move.x - midX, dy = player.move.y - midY;
        const x = pivotX * scale + zoom * (dx * cos - dy * sin);
        const y = pivotY * scale + zoom * (dx * sin + dy * cos);
        g.globalCompositeOperation = 'destination-out';
        const edge = g.createRadialGradient(x, y, radius * 0.48, x, y, radius);
        edge.addColorStop(0, 'rgba(0,0,0,1)');
        edge.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = edge;
        g.fillRect(x - radius, y - radius, 2 * radius, 2 * radius);
        g.globalCompositeOperation = 'source-over';
      }
      if (hasHeat) {
        const { heat, pattern } = layer;
        drawMasks(heat, 'heat');
        heat.save();
        heat.globalCompositeOperation = 'source-in';
        heat.fillStyle = pattern;
        const offset = phase % RENDER.heatWaveSpacing;
        heat.translate(0, -offset);
        heat.fillRect(0, offset, width, height);
        heat.restore();
        g.save();
        g.globalAlpha = RENDER.heatWaveAlpha;
        g.drawImage(heat.canvas, 0, 0);
        g.restore();
      }
      layer.texture.refresh();
    });
  }

  private removeChunk(chunk: BakedChunk): void {
    this.ownedChunks.delete(chunk);
    chunk.image.destroy();
    if (this.ctx.scene.textures.exists(chunk.textureKey)) this.ctx.scene.textures.remove(chunk.textureKey);
  }
}
