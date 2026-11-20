import type Phaser from 'phaser';
import { TEX } from '../core/assetKeys';
import { UNDERGROUND_VEHICLE_KINDS, UNDERGROUND_VEHICLES, type UndergroundVehicleKind } from '../entities/undergroundVehicles';
import { fillStroke, lin, makeCanvas, poly, rr } from './draw';

type Ctx = CanvasRenderingContext2D;

function plate(c: Ctx, color: string | CanvasGradient, x: number, y: number, w: number, h: number, radius = 3): void {
  rr(c, x, y, w, h, radius);
  fillStroke(c, color, '#101423', 1.8);
}

function shape(c: Ctx, color: string, points: number[]): void {
  poly(c, points);
  fillStroke(c, color, '#13172a', 1.7);
}

function light(c: Ctx, x: number, y: number, col: string, reach = 10): void {
  c.save();
  c.shadowColor = col; c.shadowBlur = reach;
  c.fillStyle = col; c.fillRect(x, y, 3, 4);
  c.restore();
}

function wheels(c: Ctx, xs: number[], width = 13): void {
  for (const x of xs) for (const y of [1, 32]) {
    plate(c, '#2c3146', x, y, width, 7, 2);
    c.fillStyle = '#636b85'; c.fillRect(x + 3, y + 2, width - 6, 1.5);
  }
}

function glass(c: Ctx, x: number, y: number, w: number, h: number): void {
  plate(c, lin(c, x, y, x + w, y, [[0, '#222644'], [1, '#90eaf8']]), x, y, w, h, 4);
  c.fillStyle = '#d6ffff'; c.fillRect(x + w - 4, y + 3, 1.5, h - 6);
}

function ore(c: Ctx, x: number, y: number, color: string): void {
  shape(c, color, [x - 5, y + 2, x - 3, y - 4, x + 2, y - 5, x + 6, y - 1, x + 3, y + 5]);
  c.fillStyle = '#dbfffa'; c.fillRect(x - 2, y - 3, 4, 1.4);
}

const body: Record<UndergroundVehicleKind, (c: Ctx) => void> = {
  caveBuggy: c => {
    wheels(c, [8, 44], 11);
    shape(c, '#b9bd47', [4, 11, 11, 6, 44, 6, 58, 12, 60, 20, 58, 28, 44, 34, 11, 34, 4, 29]);
    plate(c, '#37374b', 17, 8, 22, 24, 6);
    plate(c, '#a5c8d1', 20, 11, 5, 18, 2);
    plate(c, '#557d5a', 36, 9, 7, 22, 2);
    glass(c, 31, 10, 8, 20);
    c.fillStyle = '#648042'; c.fillRect(44, 18, 13, 4);
    light(c, 55, 11, '#fff7a1'); light(c, 55, 25, '#fff7a1');
  },
  crystalRunner: c => {
    wheels(c, [10, 44], 13);
    shape(c, '#2975a9', [4, 8, 22, 7, 36, 11, 48, 10, 62, 17, 62, 23, 48, 30, 36, 29, 22, 33, 4, 32, 9, 20]);
    shape(c, '#42e5e8', [10, 8, 27, 9, 35, 14, 22, 15, 9, 13]);
    shape(c, '#42e5e8', [10, 32, 27, 31, 35, 26, 22, 25, 9, 27]);
    glass(c, 22, 14, 24, 12);
    light(c, 54, 14, '#b4faff'); light(c, 54, 22, '#b4faff');
    light(c, 9, 9, '#eea4ff'); light(c, 9, 27, '#eea4ff');
  },
  surveyRover: c => {
    wheels(c, [6, 25, 46], 12);
    plate(c, '#a655ab', 3, 6, 58, 28, 5);
    plate(c, '#443459', 8, 10, 30, 20, 3);
    plate(c, '#c89bff', 10, 12, 20, 16, 5);
    plate(c, '#52416d', 13, 15, 15, 10, 4);
    c.strokeStyle = '#d9abff'; c.lineWidth = 2;
    c.beginPath(); c.arc(20, 20, 6, -1, 1); c.stroke();
    glass(c, 40, 9, 14, 22);
    light(c, 57, 9, '#dfbfff'); light(c, 57, 27, '#dfbfff');
  },
  oreHauler: c => {
    wheels(c, [5, 17, 48], 11);
    plate(c, '#577d80', 3, 5, 58, 30, 4);
    plate(c, '#749b9c', 5, 6, 35, 28, 3);
    plate(c, '#30374c', 8, 9, 29, 22, 2);
    for (const [x, y] of [[14, 14], [19, 24], [24, 15], [30, 22]]) ore(c, x, y, '#52e0cd');
    plate(c, '#c7cb67', 41, 8, 17, 24, 4);
    glass(c, 47, 10, 10, 20);
    light(c, 58, 8, '#e6fd92'); light(c, 58, 27, '#e6fd92');
  },
  rockCrusher: c => {
    for (const y of [1, 30]) {
      plate(c, '#384056', 3, y, 43, 9, 4);
      c.fillStyle = '#b1a586';
      for (let x = 7; x < 43; x += 5) c.fillRect(x, y + 2, 2, 5);
    }
    plate(c, '#bc603a', 4, 6, 45, 28, 5);
    plate(c, '#f7bd58', 15, 8, 31, 24, 4);
    plate(c, '#5d4439', 7, 11, 9, 18, 3);
    glass(c, 25, 10, 14, 20);
    shape(c, '#a6a6bd', [43, 10, 57, 6, 62, 3, 62, 37, 57, 34, 43, 30]);
    plate(c, '#575975', 54, 5, 6, 30, 2);
    for (const y of [7, 14, 21, 28]) shape(c, '#eee2c9', [59,y, 64,y+2, 64,y+5, 59,y+5]);
    light(c, 44, 8, '#ffcf61'); light(c, 44, 27, '#ffcf61');
  },
};

export function ensureUndergroundVehicleArt(scene: Phaser.Scene): void {
  for (const kind of UNDERGROUND_VEHICLE_KINDS) {
    const { texture, spec } = UNDERGROUND_VEHICLES[kind];
    if (scene.textures.exists(texture)) continue;
    const { ctx, done } = makeCanvas(scene, texture, spec.length, spec.width);
    ctx.scale(spec.length / 65, spec.width / 40);
    body[kind](ctx);
    done();
  }
}

export function ensureUndergroundOreArt(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEX.underground.oreCrate)) return;
  const crate = makeCanvas(scene, TEX.underground.oreCrate, 40, 40);
  plate(crate.ctx, '#93614e', 2, 2, 36, 36, 4);
  plate(crate.ctx, '#3f374f', 6, 6, 28, 28, 2);
  for (const [x, y] of [[12, 12], [22, 16], [15, 26], [27, 26]]) ore(crate.ctx, x, y, '#68dfc8');
  crate.done();
  const chip = makeCanvas(scene, TEX.underground.oreChip, 16, 16);
  ore(chip.ctx, 7, 8, '#9effc7');
  chip.done();
}
