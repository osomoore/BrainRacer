import type Phaser from 'phaser';
import { hash, makeCanvas, type Ctx } from '../art/draw';
import { DEPTH } from '../config/gameConfig';
import { TEX } from '../core/assetKeys';
import {
  ROAD_E, ROAD_N, ROAD_S, ROAD_W, type IndustrialDecoration, type IndustrialLayout, type Vec2,
} from '../core/types';

export const INDUSTRIAL_TILESET_KEY = 'world_tileset_industrial';
export const INDUSTRIAL_BUILDING_TINT = 0x718eab;
export const INDUSTRIAL_SLAB_VARIANTS = 3;

const RAIL_WIDTH = 64;

type AddRect = (x: number, y: number, w: number, h: number, angle: number) => void;
type AddCircle = (x: number, y: number, radius: number) => void;

function paint(ctx: Ctx, color: string | CanvasGradient, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function grain(ctx: Ctx, size: number, color: string, seed: number): void {
  for (let i = 0; i < 260; i++) {
    const x = hash(i, 0, seed) * size;
    const y = hash(i, 1, seed) * size;
    const width = 1 + Math.floor(hash(i, 2, seed) * 3);
    paint(ctx, color, x, y, width, 1);
  }
}

/** Industrial roads occupy two tiles across. Paint the curb only on their outer edges. */
function drawRoadTile(ctx: Ctx, size: number, mask: number): void {
  paint(ctx, '#46576b', 0, 0, size, size);
  grain(ctx, size, '#7890ad2d', 17);
  const isHorizontal = (mask & (ROAD_E | ROAD_W)) === (ROAD_E | ROAD_W);
  const isVertical = (mask & (ROAD_N | ROAD_S)) === (ROAD_N | ROAD_S);
  const edges = [ROAD_N, ROAD_E, ROAD_S, ROAD_W];
  for (let side = 0; side < edges.length; side++) {
    const edge = edges[side];
    const northOrSouth = edge === ROAD_N || edge === ROAD_S;
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(side * Math.PI / 2);
    ctx.translate(-size / 2, -size / 2);
    if (!(mask & edge)) {
      paint(ctx, '#2a3c52', 0, 0, size, 8);
      paint(ctx, '#6b8296', 0, 8, size, 2);
    } else if (northOrSouth ? isHorizontal && !isVertical : isVertical && !isHorizontal) {
      // Each of the two adjacent tiles paints half of the shared dashed center line.
      for (let x = 17; x < size; x += 64) paint(ctx, '#dca85f', x, 0, 30, 2);
    }
    ctx.restore();
  }
}

function drawWaterTile(ctx: Ctx, size: number): void {
  paint(ctx, '#162b43', 0, 0, size, size);
  for (let i = 0; i < 48; i++) {
    const x = Math.floor(hash(i, 1, 66) * size);
    const y = Math.floor(hash(i, 2, 66) * size);
    const w = 6 + Math.floor(hash(i, 3, 66) * 24);
    const color = i % 4 === 0 ? '#3d67845b' : '#24445bb3';
    paint(ctx, color, x, y, w, 2);
    paint(ctx, color, x - size, y, w, 2);
  }
}

function drawSlabDetail(ctx: Ctx, variant: number): void {
  if (variant === 0) {
    // Flush utility trench with grate sections and steel edges.
    paint(ctx, '#243b50', 30, 69, 78, 12);
    paint(ctx, '#5f798b', 30, 69, 78, 1);
    paint(ctx, '#617684', 30, 80, 78, 1);
    for (let x = 36; x < 106; x += 5) paint(ctx, '#45627a', x, 73, 2, 4);
  } else if (variant === 1) {
    for (const y of [36, 88]) {
      paint(ctx, '#233b4d', 50, y, 28, 18);
      paint(ctx, '#648090', 51, y + 1, 26, 1);
      for (let row = y + 5; row < y + 15; row += 3) paint(ctx, '#4f6b7f', 54, row, 20, 1);
    }
  } else {
    // Painted corners indicate an empty equipment bay.
    for (const x of [28, 86]) for (const y of [25, 88]) {
      paint(ctx, '#8b826a', x, y, 14, 2);
      paint(ctx, '#8b826a', x === 28 ? x : x + 12, y === 25 ? y : y - 12, 2, 14);
    }
  }
}

/** One detached canvas is reused by WorldBuilder to draw and extrude each atlas cell. */
export function industrialTileSource(size: number): (index: number) => HTMLCanvasElement {
  const tile = document.createElement('canvas');
  tile.width = tile.height = size;
  const ctx = tile.getContext('2d')!;
  const concrete = ['#162b43', '#344455', '#374d61', '#314951', '#34495d', '#404b5d'];
  const roadEnd = concrete.length + 16;
  return (index) => {
    if (index >= concrete.length && index < roadEnd) drawRoadTile(ctx, size, index - concrete.length);
    else if (index === 0) drawWaterTile(ctx, size);
    else {
      const slab = index < roadEnd ? index : 4;
      paint(ctx, concrete[slab], 0, 0, size, size);
      grain(ctx, size, '#7f9cb42b', 5 + slab);
      paint(ctx, '#283b4b', 0, 0, size, 1);
      paint(ctx, '#283b4b', 0, 0, 1, size);
      // Expansion joints break up the wide yard slabs.
      paint(ctx, '#55708755', 0, size - 1, size, 1);
      paint(ctx, '#55708755', size - 1, 0, 1, size);
      if (index >= roadEnd) drawSlabDetail(ctx, index - roadEnd);
    }
    return tile;
  };
}

function addDecoration(
  scene: Phaser.Scene, decoration: IndustrialDecoration, objects: Phaser.GameObjects.GameObject[],
  addRect: AddRect, addCircle: AddCircle,
): void {
  const { kind, x, y, w, h, angle } = decoration;
  const depth = kind === 'loadingYard' ? DEPTH.decal - 2 : DEPTH.building;
  objects.push(scene.add.image(x, y, TEX.industrial[kind]).setDisplaySize(w, h).setRotation(angle).setDepth(depth));

  const localRect = (offsetY: number, width: number, height: number) => {
    addRect(x - offsetY * Math.sin(angle), y + offsetY * Math.cos(angle), width, height, angle);
  };
  switch (kind) {
    case 'bridge':
      for (const sign of [-1, 1]) localRect(sign * h * 111 / 256, w, h * 10 / 256);
      break;
    case 'factoryBay':
      for (const sign of [-1, 1]) localRect(sign * h * 108 / 256, w, h * 40 / 256);
      break;
    case 'gantry':
      for (const sign of [-1, 1]) localRect(sign * h * 90 / 224, w * 56 / 128, h * 32 / 224);
      break;
    case 'loadingYard':
      localRect(-h * 100 / 256, w * 228 / 256, h * 28 / 256);
      break;
    case 'waterTower':
      addCircle(x, y, Math.min(w, h) * 76 / 192);
      break;
  }
}

export function addIndustrialWorld(
  scene: Phaser.Scene, { decorations, rail }: IndustrialLayout, objects: Phaser.GameObjects.GameObject[],
  addRect: AddRect, addCircle: AddCircle,
): void {
  for (const decoration of decorations) addDecoration(scene, decoration, objects, addRect, addCircle);

  objects.push(addRailCircuit(scene, rail.points));
}

/** Bake mitered strips of the track texture into one continuous ground decal. */
function addRailCircuit(scene: Phaser.Scene, points: Vec2[]): Phaser.GameObjects.Image {
  const left = Math.floor(Math.min(...points.map((p) => p.x)) - RAIL_WIDTH);
  const top = Math.floor(Math.min(...points.map((p) => p.y)) - RAIL_WIDTH);
  const width = Math.ceil(Math.max(...points.map((p) => p.x)) - left + RAIL_WIDTH);
  const height = Math.ceil(Math.max(...points.map((p) => p.y)) - top + RAIL_WIDTH);
  const key = 'world-industrial-rail-circuit';
  const { ctx, done } = makeCanvas(scene, key, width, height);
  const source = scene.textures.get(TEX.industrial.rail).getSourceImage() as HTMLCanvasElement;
  const sleepers = ctx.createPattern(source, 'repeat-x')!;
  const angles = points.map((p, i) => {
    const next = points[(i + 1) % points.length];
    return Math.atan2(next.y - p.y, next.x - p.x);
  });
  const bevels = angles.map((angle, i) => {
    const turn = angle - angles[(i + angles.length - 1) % angles.length];
    return RAIL_WIDTH / 2 * Math.tan(turn / 2);
  });
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    const a = points[i], b = points[next];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    ctx.save();
    ctx.translate(a.x - left, a.y - top);
    ctx.rotate(angles[i]);
    ctx.translate(0, -RAIL_WIDTH / 2);
    ctx.beginPath();
    ctx.moveTo(-bevels[i], 0);
    ctx.lineTo(length + bevels[next], 0);
    ctx.lineTo(length - bevels[next], RAIL_WIDTH);
    ctx.lineTo(bevels[i], RAIL_WIDTH);
    ctx.closePath();
    ctx.fillStyle = sleepers;
    ctx.fill();
    ctx.restore();
  }
  done();
  return scene.add.image(left, top, key).setOrigin(0).setDepth(DEPTH.decal - 1);
}
