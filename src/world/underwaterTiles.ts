import { ellipse, fillStroke, hash, lin, radial, type Ctx } from '../art/draw';
import { ROAD_E, ROAD_N, ROAD_S, ROAD_W, Tile, type WorldData } from '../core/types';
import { isUnderwaterCrossing } from './gen/underwater';

export const UNDERWATER_TILESET_KEY = 'world_tileset_underwater';

export function underwaterTileIndex(world: WorldData, i: number): number {
  const tile = world.tiles[i];
  if (tile === Tile.Road) {
    const { tileSize, widthTiles } = world;
    const x = (i % widthTiles + 0.5) * tileSize;
    const y = (Math.floor(i / widthTiles) + 0.5) * tileSize;
    return isUnderwaterCrossing(x, y, tileSize) ? 0 : 6 + (world.roadMask[i] & 15);
  }
  return tile === Tile.Water ? 0 : tile === Tile.Building ? 2 : 4;
}

function deepWater(c: Ctx, s: number): void {
  c.fillStyle = '#113a54';
  c.fillRect(0, 0, s, s);
  for (let i = 0; i < 16; i++) {
    const x = hash(i, 7) * s, y = hash(i, 19) * s, radius = 4 + 13 * hash(i, 28);
    for (const dx of [-s, 0, s]) for (const dy of [-s, 0, s]) {
      const cx = x + dx, cy = y + dy;
      ellipse(c, cx, cy, radius, radius);
      fillStroke(c, radial(c, cx, cy, 0, radius, [[0, '#5095a718'], [1, '#5095a700']]), null);
    }
  }
}

const sides = [[ROAD_N, 0], [ROAD_E, Math.PI / 2], [ROAD_S, Math.PI], [ROAD_W, -Math.PI / 2]];

function road(c: Ctx, s: number, mask: number): void {
  const unit = s / 128;
  c.save();
  c.scale(unit, unit);
  c.fillStyle = '#294d63';
  c.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 38; i++) {
    c.fillStyle = i % 2 ? '#345b6a' : '#254459';
    c.fillRect(hash(i, 11) * 128, hash(i, 27) * 128, 3, 1);
  }
  for (const [side, angle] of sides) {
    c.save();
    c.translate(64, 64);
    c.rotate(angle);
    c.translate(-64, -64);
    if (!(mask & side)) {
      c.fillStyle = lin(c, 0, 0, 0, 34, [[0, '#123951'], [0.18, '#367a86'], [0.37, '#6fc9bf'], [1, '#416b7510']]);
      c.fillRect(0, 0, 128, 34);
      c.fillStyle = '#83f0d0';
      c.fillRect(0, 9, 128, 3);
      c.fillStyle = '#d5ffed';
      c.fillRect(24, 9, 37, 3);
    } else if (mask === (ROAD_E | ROAD_W | ROAD_S) && side === ROAD_S ||
               mask === (ROAD_E | ROAD_W | ROAD_N) && side === ROAD_N ||
               mask === (ROAD_N | ROAD_S | ROAD_E) && side === ROAD_E ||
               mask === (ROAD_N | ROAD_S | ROAD_W) && side === ROAD_W) {
      c.fillStyle = '#c8dcd68c';
      c.fillRect(42, 125, 44, 3);
    }
    c.restore();
  }
  c.restore();
}

export function underwaterTileSource(size: number): (index: number) => HTMLCanvasElement {
  return index => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const c = canvas.getContext('2d')!;
    if (index >= 6) road(c, size, index - 6);
    else if (index === 0) deepWater(c, size);
    else {
      c.fillStyle = '#31596e';
      c.fillRect(0, 0, size, size);
      c.strokeStyle = '#365f72';
      c.strokeRect(0, 0, size, size);
      c.strokeRect(size * 0.14, size * 0.14, size * 0.72, size * 0.72);
    }
    return canvas;
  };
}
