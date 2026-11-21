import type Phaser from 'phaser';
import { ellipse, fillStroke, makeCanvas, poly, rr, type Ctx } from '../art/draw';
import { TEX } from '../core/assetKeys';
import type { QueuedMap } from '../config/queuedMaps';

const INK = '#222239';
type Palette = { deck: string; trim: string; dark: string; light: string };
const PALETTES: Record<QueuedMap, Palette> = {
  brickworks: { deck: '#a07b47', trim: '#ffc767', dark: '#423833', light: '#66d697' },
  mushroom: { deck: '#947497', trim: '#fbd2a2', dark: '#513756', light: '#ff8ea8' },
  tundra: { deck: '#6596b4', trim: '#dbf8ff', dark: '#325978', light: '#86e0fa' },
  volcano: { deck: '#685068', trim: '#ffc069', dark: '#40273d', light: '#ff804b' },
  candy: { deck: '#a35ca4', trim: '#fff5da', dark: '#693166', light: '#ff95d3' },
  castle: { deck: '#a98562', trim: '#f7cf6f', dark: '#634a44', light: '#8dadc8' },
  airport: { deck: '#525e70', trim: '#f5d97c', dark: '#30394b', light: '#87dcf1' },
  house: { deck: '#b58966', trim: '#f9d99e', dark: '#705049', light: '#63cdd9' },
};

export function queuedRailPalette(map: QueuedMap): Palette {
  return PALETTES[map];
}

function bake(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void): string {
  if (!scene.textures.exists(key)) {
    const { ctx, done } = makeCanvas(scene, key, w, h);
    draw(ctx);
    done();
  }
  return key;
}

function box(c: Ctx, fill: string, x: number, y: number, w: number, h: number): void {
  c.fillStyle = fill;
  c.fillRect(x, y, w, h);
}

function round(c: Ctx, fill: string | CanvasGradient, x: number, y: number, w: number, h: number, r = 6): void {
  rr(c, x, y, w, h, r);
  fillStroke(c, fill, INK, 3);
}

function disc(c: Ctx, fill: string, x: number, y: number, rx: number, ry = rx): void {
  ellipse(c, x, y, rx, ry);
  fillStroke(c, fill, null);
}

export function queuedSignalTexture(scene: Phaser.Scene): string {
  return bake(scene, TEX.queuedFeature.signal, 45, 45, c => {
    round(c, '#454353', 4, 4, 37, 37, 11);
    disc(c, '#c6c8cf', 22, 22, 14);
    disc(c, '#fffdf8', 22, 22, 11);
    disc(c, '#ffffff', 19, 18, 4);
  });
}

export function queuedFeatureTextures(scene: Phaser.Scene, map: QueuedMap) {
  const p = PALETTES[map];
  const keys = TEX.queuedFeature;
  const deck = bake(scene, keys.deck(map), 128, 256, c => {
    box(c, p.dark, 0, 0, 128, 256);
    box(c, p.deck, 8, 3, 112, 250);
    const seam = map === 'brickworks' || map === 'castle' || map === 'house';
    for (let y = 16; y <= 244; y += 16) {
      box(c, p.dark, seam ? 8 : 10, y, seam ? 112 : 18, 2);
      if (!seam) box(c, p.dark, 100, y, 18, 2);
    }
    for (const y of [5, 245]) {
      box(c, p.dark, 0, y, 128, 7);
      box(c, p.trim, 0, y, 128, 3);
    }
    for (const x of [3, 116]) for (let y = 18; y < 234; y += 32) {
      box(c, p.trim, x, y, 9, 15);
    }
  });
  const gate = bake(scene, keys.gate(map), 54, 256, c => drawGate(c, map, p));
  const signal = queuedSignalTexture(scene);
  return { deck, gate, signal };
}

type ShuttleMap = 'tundra' | 'volcano' | 'castle';

export function queuedShuttleTextures(scene: Phaser.Scene, map: ShuttleMap) {
  const p = PALETTES[map];
  const track = bake(scene, TEX.queuedFeature.track(map), 192, 78, c => drawTrack(c, map, p));
  const mover = bake(scene, TEX.queuedFeature.mover(map), 140, 84, c => drawMover(c, map, p));
  return { track, mover };
}

function drawGate(c: Ctx, map: QueuedMap, p: Palette): void {
  if (map === 'volcano') {
    c.beginPath();
    c.moveTo(26, 0);
    for (let y = 0; y <= 256; y += 8) c.lineTo(48 + Math.sin(y * .12) * 5, y);
    for (let y = 256; y >= 0; y -= 8) c.lineTo(6 + Math.sin(y * .16) * 5, y);
    c.closePath();
    fillStroke(c, '#ee6237', '#642b3f', 3);
    for (let y = 9; y < 255; y += 15) {
      disc(c, '#ff9a51', 27 + Math.sin(y * .07) * 8, y, 12, 10);
      disc(c, '#ffdc68', 29 + Math.sin(y * .16) * 7, y + 2, 6, 6);
    }
    return;
  }
  round(c, p.dark, 5, 3, 44, 250, map === 'brickworks' ? 0 : 6);
  box(c, p.light, 10, 7, 34, 242);
  if (map === 'brickworks' || map === 'castle') {
    for (let y = 13; y < 238; y += 27) {
      box(c, p.dark, 9, y + 10, 37, 4);
      if (map === 'brickworks') box(c, p.dark, y % 2 ? 19 : 34, y - 13, 4, 23);
      else for (const x of [15, 39]) disc(c, p.trim, x, y + 2, 3);
    }
  } else if (map === 'mushroom') {
    for (let y = 18; y < 240; y += 28) {
      disc(c, '#c0506c', 27, y, 17, 13);
      disc(c, '#fff4d6', 22, y - 3, 6);
      disc(c, '#fff4d6', 34, y + 4, 4);
    }
  } else if (map === 'tundra') {
    for (let y = 15; y < 234; y += 26) {
      poly(c, [9, y, 33, y + 7, 44, y + 20, 9, y + 16]);
      fillStroke(c, p.trim, p.dark, 2);
    }
  } else if (map === 'house') {
    round(c, '#7ba8c9', 9, 12, 36, 232, 12);
    for (const y of [72, 130, 187]) {
      disc(c, '#fff6d7', 30, y, 10, 7);
      for (const dx of [-6, 0, 6]) disc(c, '#fff6d7', 30 + dx, y - 11, 3);
    }
  } else {
    for (let y = 13; y < 238; y += 25) {
      poly(c, [10, y, 44, y + 12, 44, y + 21, 10, y + 9]);
      fillStroke(c, map === 'candy' ? '#fff8e6' : p.dark, null);
    }
  }
  for (const y of [5, 236]) round(c, p.trim, 3, y, 48, 15, 3);
}

function drawTrack(c: Ctx, map: ShuttleMap, p: Palette): void {
  if (map === 'volcano') {
    poly(c, [0, 29, 30, 25, 64, 29, 94, 19, 136, 28, 168, 21, 192, 29, 192, 51, 165, 56, 139, 49, 100, 61, 64, 50, 37, 55, 0, 51]);
    fillStroke(c, '#3f2534', '#5c3548', 4);
    return;
  }
  const snow = map === 'tundra';
  box(c, snow ? '#d4f0fa' : '#99815f', 0, 9, 192, 60);
  for (const y of [19, 55]) box(c, snow ? '#a0cfe4' : '#70533e', 0, y, 192, 4);
  for (let x = 4; x < 192; x += 24) for (const y of [13, 63]) box(c, p.trim, x, y, 6, 3);
}

function drawMover(c: Ctx, map: ShuttleMap, p: Palette): void {
  disc(c, '#191c2e55', 72, 50, 61, 28);
  if (map === 'volcano') {
    for (const [x, y, rx, ry] of [[32, 42, 19, 12], [63, 44, 23, 17], [91, 38, 27, 18], [116, 49, 15, 10]]) {
      disc(c, '#a43d3c', x, y, rx, ry);
      disc(c, '#ff753c', x - 1, y - 2, rx * .75, ry * .72);
      disc(c, '#ffce68', x + 1, y - 4, rx * .38, ry * .42);
    }
    return;
  }
  if (map === 'tundra') {
    for (const y of [30, 57]) {
      round(c, p.trim, 16, y, 109, 9, 4);
      box(c, p.dark, 22, y, 12, 2);
    }
    round(c, '#d45669', 49, 27, 32, 37, 10);
    round(c, '#e85d8f', 70, 30, 31, 29, 12);
    round(c, '#fff2b9', 92, 35, 17, 19, 7);
    box(c, '#346183', 101, 37, 10, 15);
    return;
  }
  if (map === 'castle') {
    for (const y of [23, 61]) {
      disc(c, '#57373c', 41, y, 10, 6);
      disc(c, '#57373c', 89, y, 11, 6);
    }
    round(c, '#986a4c', 25, 23, 84, 42, 17);
    round(c, p.trim, 98, 32, 31, 24, 8);
    round(c, '#a23852', 46, 25, 40, 38, 5);
    disc(c, '#dbe4e6', 65, 44, 13, 13);
    disc(c, '#445975', 73, 44, 8, 8);
    return;
  }
}

export function queuedPlaneTexture(scene: Phaser.Scene): string {
  return bake(scene, TEX.queuedFeature.mover('airport-plane'), 230, 166, c => {
    poly(c, [117, 68, 80, 9, 62, 9, 79, 78, 79, 88, 62, 157, 80, 157, 117, 98]);
    fillStroke(c, '#d1e0ef', INK, 3);
    poly(c, [56, 68, 36, 44, 22, 44, 33, 80, 33, 86, 22, 122, 36, 122, 56, 98]);
    fillStroke(c, '#6abacd', INK, 3);
    round(c, '#faf4df', 17, 67, 195, 31, 15);
    round(c, '#497991', 165, 70, 34, 25, 10);
    box(c, '#e4796c', 57, 73, 101, 3);
    box(c, '#e4796c', 57, 88, 101, 3);
    for (const y of [40, 109]) round(c, '#638aa7', 97, y, 36, 17, 7);
  });
}

export function queuedEruptionTexture(scene: Phaser.Scene): string {
  return bake(scene, TEX.queuedFeature.eruption, 160, 192, c => {
    for (const [x, y, r, fill] of [[80, 151, 36, '#f6513d'], [67, 123, 34, '#f78047'], [91, 106, 30, '#ffb753'], [73, 82, 29, '#ffc26b'], [92, 57, 25, '#f58c55'], [75, 37, 19, '#d38276']] as const) {
      disc(c, fill, x, y, r, r * .84);
      disc(c, '#ffec9c', x - 7, y + 4, r * .47, r * .43);
    }
    for (const [x, y, r] of [[37, 77, 6], [118, 91, 5], [129, 47, 7], [47, 26, 5]]) disc(c, '#ffe484', x, y, r);
  });
}

export function queuedLavaDropTexture(scene: Phaser.Scene): string {
  return bake(scene, TEX.queuedFeature.mover('volcano-drop'), 24, 30, c => {
    c.beginPath();
    c.moveTo(12, 2);
    c.bezierCurveTo(15, 8, 22, 14, 22, 20);
    c.bezierCurveTo(22, 30, 2, 30, 2, 20);
    c.bezierCurveTo(2, 14, 8, 11, 12, 2);
    fillStroke(c, '#ff813a', '#ae3b43', 3);
    disc(c, '#ffe486', 10, 18, 4, 6);
  });
}
