import { ellipse, fillStroke, hash, lin, radial, type Ctx } from '../art/draw';
import { ROAD_E, ROAD_N, ROAD_S, ROAD_W, Tile, type WorldData } from '../core/types';
import { isUnderwaterCrossing, isUnderwaterGlassPlaza, isUnderwaterGlassRoad } from './gen/underwater';

export const UNDERWATER_TILESET_KEY = 'world_tileset_underwater';

export function underwaterTileIndex(world: WorldData, i: number): number {
  const tile = world.tiles[i];
  const { tileSize, widthTiles } = world;
  const tx = i % widthTiles, ty = Math.floor(i / widthTiles);
  if (tile === Tile.Road) {
    const x = (tx + 0.5) * tileSize, y = (ty + 0.5) * tileSize;
    return isUnderwaterCrossing(x, y, tileSize) || isUnderwaterGlassRoad(tx, ty) ? 0 : 6 + (world.roadMask[i] & 15);
  }
  if (tile === Tile.Water) return 0;
  if (tile === Tile.Building) return 2;
  if (isUnderwaterGlassPlaza(tx, ty)) return 3;
  return tx % 2 === ty % 2 ? 4 : hash(tx, ty) > .46 ? 1 : 5;
}

export function paintDeepWater(c: Ctx, s: number): void {
  c.fillStyle = lin(c, 0, 0, s, s, [[0, '#1b5167'], [.48, '#113b57'], [1, '#132941']]);
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

function glassFloor(c: Ctx, s: number): void {
  const rim = s * .09;
  c.fillStyle = lin(c, 0, 0, s, s, [[0, '#7edaee60'], [.42, '#3d92b04b'], [1, '#2954767d']]);
  c.fillRect(rim, rim, s - 2 * rim, s - 2 * rim);
  c.strokeStyle = '#244f68';
  c.lineWidth = 2 * rim;
  c.strokeRect(0, 0, s, s);
  c.strokeStyle = '#79d5d3';
  c.lineWidth = 2;
  c.strokeRect(rim, rim, s - 2 * rim, s - 2 * rim);
  c.strokeStyle = '#bfefde89';
  c.beginPath();
  c.moveTo(rim * 2, rim * 4);
  c.lineTo(rim * 4, rim * 2);
  c.lineTo(rim * 6, rim * 2);
  c.stroke();
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

function metalDeck(c: Ctx, s: number, index: number): void {
  c.save();
  c.scale(s / 128, s / 128);
  const dark = index === 5 ? '#24485f' : index === 2 ? '#294c65' : '#315a6d';
  const light = index === 5 ? '#396b7c' : index === 2 ? '#345b73' : '#3b6b7c';
  c.fillStyle = lin(c, 0, 0, 128, 128, [[0, light], [1, dark]]);
  c.fillRect(0, 0, 128, 128);
  c.strokeStyle = '#22485d';
  c.lineWidth = 2;
  c.strokeRect(3, 3, 122, 122);
  c.strokeStyle = '#5b879366';
  c.lineWidth = 1;
  c.strokeRect(7, 7, 114, 114);
  for (const [x, y] of [[13, 13], [115, 13], [13, 115], [115, 115]]) {
    ellipse(c, x, y, 2.4, 2.4);
    fillStroke(c, '#78a1a0', '#284c61', 1.1);
  }
  if (index === 1 || index === 5) {
    c.fillStyle = index === 1 ? '#87b8a5' : '#dabd86';
    c.fillRect(51, 6, 26, 2);
    c.fillRect(51, 120, 26, 2);
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
    else if (index === 0) return canvas;
    else if (index === 3) glassFloor(c, size);
    else metalDeck(c, size, index);
    return canvas;
  };
}
