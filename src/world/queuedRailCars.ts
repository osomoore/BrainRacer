import type Phaser from 'phaser';
import { bodyGrad, ellipse, fillStroke, makeCanvas, poly, rr, type Ctx } from '../art/draw';
import { TEX } from '../core/assetKeys';
import type { QueuedRailMap } from './gen/queuedWorlds';

const THEMES = {
  brickworks: { bright: '#ffc34e', shade: '#a85b29', glass: '#bfe5e2', cargo: ['#d15e48', '#6daf8e', '#f0bd5b'] },
  mushroom: { bright: '#ec7899', shade: '#77385c', glass: '#e3e4b7', cargo: ['#e98a79', '#b894d6', '#f9d999'] },
  candy: { bright: '#ee9ad1', shade: '#97488d', glass: '#b7f3f6', cargo: ['#ef73a7', '#64c8bc', '#f8c85a'] },
  airport: { bright: '#f9df8b', shade: '#39788c', glass: '#a8e9ff', cargo: ['#e89059', '#5bb9c5', '#baabd9'] },
  house: { bright: '#f17a62', shade: '#8c4249', glass: '#afedf6', cargo: ['#ecad6c', '#60bdd2', '#8ec083'] },
} as const;

const INK = '#242737';
const WIDTH = 144;
const HEIGHT = 92;
const CAR_LENGTH = 108;
const CAR_WIDTH = 58;
const CORNER = 8;

function shape(c: Ctx, x: number, y: number, w: number, h: number, color: string | CanvasGradient, r = 4): void {
  rr(c, x, y, w, h, r);
  fillStroke(c, color, INK, 2);
}

function dot(c: Ctx, x: number, y: number, r: number, color: string): void {
  ellipse(c, x, y, r, r);
  fillStroke(c, color, null);
}

function wagonCargo(c: Ctx, map: QueuedRailMap, variant: number): void {
  const theme = THEMES[map];
  const color = (i: number) => theme.cargo[(i + variant - 1) % theme.cargo.length];
  for (const [i, x] of [39, 72, 104].entries()) {
    const y = i % 2 ? 48 : 43;
    if (map === 'candy' || map === 'mushroom') {
      dot(c, x, y, 13, color(i));
      dot(c, x - 3, y - 3, 3, '#fff1be');
      dot(c, x + 4, y + 3, 2, '#fff1be');
      if (map === 'candy') {
        c.strokeStyle = '#fffae4';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(x, y, 7, i, Math.PI * 1.7 + i);
        c.stroke();
      }
      continue;
    }
    c.save();
    c.translate(x, y);
    c.rotate((i - 1) * 0.16);
    shape(c, -13, -12, 26, 25, color(i), map === 'brickworks' ? 1 : 4);
    c.fillStyle = '#ffe8bba9';
    if (map === 'brickworks') {
      for (const bx of [-7, 6]) for (const by of [-6, 6]) dot(c, bx, by, 3, '#ffe8bb91');
    } else {
      c.fillRect(-12, -6, 24, 2);
      c.fillRect(-12, 5, 24, 2);
      shape(c, -6, -5, 12, 7, theme.shade, 2);
    }
    c.restore();
  }
}

function paintCar(c: Ctx, map: QueuedRailMap, variant: number): void {
  const p = THEMES[map];
  const engine = variant === 0;
  const x = (WIDTH - CAR_LENGTH) / 2, y = (HEIGHT - CAR_WIDTH) / 2;
  rr(c, x + 4, y + 5, CAR_LENGTH, CAR_WIDTH, CORNER);
  fillStroke(c, '#22223248', null);
  shape(c, x, y, CAR_LENGTH, CAR_WIDTH, p.shade, CORNER);
  for (const axle of [40, 103]) for (const side of [y, y + CAR_WIDTH - 8]) {
    shape(c, axle - 8, side, 16, 8, '#343d4d', 2);
    c.fillStyle = '#84949a';
    c.fillRect(axle - 5, side + 2, 10, 2);
  }
  shape(c, x + 8, y + 7, CAR_LENGTH - 16, CAR_WIDTH - 14, p.bright, 7);
  if (!engine) {
    shape(c, x + 12, y + 10, CAR_LENGTH - 24, CAR_WIDTH - 20, '#454255', 5);
    wagonCargo(c, map, variant);
    for (const cy of [y + 7, y + CAR_WIDTH - 7]) {
      for (const cx of [x + 11, WIDTH - x - 11]) dot(c, cx, cy, 2.2, '#fff0cf');
    }
    return;
  }
  shape(c, x + 9, y + 10, 35, CAR_WIDTH - 20, bodyGrad(c, x, y, 42, 36, p.bright, p.shade), 7);
  shape(c, 26, 28, 11, 36, p.glass, 4);
  shape(c, 51, 27, 12, 38, p.glass, 4);
  if (map === 'airport' || map === 'mushroom') {
    shape(c, 69, 29, 47, 34, p.shade, 8);
    for (const dx of [77, 90, 103]) {
      c.fillStyle = p.glass;
      c.fillRect(dx, 35, 5, 22);
    }
  } else {
    shape(c, 66, 34, 48, 24, p.shade, 9);
    for (const dx of [75, 89]) {
      c.fillStyle = p.bright;
      c.fillRect(dx, 34, 4, 24);
    }
    dot(c, 106, 46, 10, INK);
    dot(c, 106, 46, 6, map === 'candy' ? '#ffacd3' : '#78848d');
  }
  poly(c, [116, 33, 124, 37, 124, 55, 116, 59]);
  fillStroke(c, '#574658', INK, 1.5);
  for (const cy of [33, 59]) {
    dot(c, 118, cy, 5, '#fef4c2');
    dot(c, 119, cy, 2, '#ffffff');
  }
}

export function queuedRailCar(scene: Phaser.Scene, map: QueuedRailMap, variant: number, scale: number) {
  const key = TEX.queuedFeature.railCar(map, variant);
  if (!scene.textures.exists(key)) {
    const { ctx, done } = makeCanvas(scene, key, WIDTH, HEIGHT);
    paintCar(ctx, map, variant);
    done();
  }
  return { key, length: CAR_LENGTH * scale, width: CAR_WIDTH * scale, cornerRadius: CORNER * scale };
}
