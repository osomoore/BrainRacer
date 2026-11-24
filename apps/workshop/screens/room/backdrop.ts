/** Baked room backdrops: Race Shop garage and Dino Lab laboratory, one texture per (workshop, layout). */
import type Phaser from 'phaser';
import type { WorkshopId } from '../../core/types';
import type { LayoutKind } from './layout';
import { paneSize } from './layout';

const INK = 0x1b1b3a;
type G = Phaser.GameObjects.Graphics;

export interface TankSpot { x: number; y: number; w: number; h: number }
export interface Backdrop { key: string; tanks: TankSpot[] }

function rr(g: G, x: number, y: number, w: number, h: number, r: number, fill: number, line = 5): void {
  g.fillStyle(fill, 1).fillRoundedRect(x, y, w, h, r);
  if (line > 0) { g.lineStyle(line, INK, 1).strokeRoundedRect(x, y, w, h, r); }
}
function circ(g: G, x: number, y: number, r: number, fill: number, line = 5): void {
  g.fillStyle(fill, 1).fillCircle(x, y, r);
  if (line > 0) g.lineStyle(line, INK, 1).strokeCircle(x, y, r);
}

function tire(g: G, x: number, y: number, r: number): void {
  circ(g, x, y, r, 0x2d2d4a); circ(g, x, y, r * 0.42, 0x8a93a6, 4);
}

function oilCan(g: G, x: number, y: number, s: number): void {
  rr(g, x - 26 * s, y - 70 * s, 52 * s, 70 * s, 8 * s, 0xe8232a);
  rr(g, x - 20 * s, y - 40 * s, 40 * s, 22 * s, 4 * s, 0xffd23f, 3);
  g.fillStyle(0xcfd8e3, 1).fillRect(x - 8 * s, y - 92 * s, 16 * s, 22 * s);
  g.lineStyle(4, INK, 1).strokeRect(x - 8 * s, y - 92 * s, 16 * s, 22 * s);
}

function drawGarage(g: G, w: number, h: number, kind: LayoutKind, floorY: number): void {
  // wall + stripe
  g.fillStyle(0xbfdcf0, 1).fillRect(0, 0, w, floorY);
  g.fillStyle(0xe8232a, 1).fillRect(0, floorY - 46, w, 26);
  g.fillStyle(0xffffff, 1).fillRect(0, floorY - 20, w, 8);
  // big garage door behind the model
  const dw = kind === 'wide' ? 860 : 440, dx = w / 2 - dw / 2, dy = kind === 'wide' ? 150 : 150, dh = floorY - 46 - dy - 14;
  rr(g, dx - 14, dy - 14, dw + 28, dh + 28, 10, 0x8a93a6);
  g.fillStyle(0xf4f7fb, 1).fillRect(dx, dy, dw, dh);
  const panels = 6;
  for (let i = 0; i < panels; i++) { g.lineStyle(4, 0xb8c4d6, 1).strokeRect(dx, dy + (dh / panels) * i, dw, dh / panels); }
  for (let i = 0; i < 4; i++) { g.fillStyle(0x9bd7ff, 1).fillRect(dx + 30 + i * (dw - 60) / 4, dy + 20, (dw - 60) / 4 - 14, 36); }
  // pegboard with tools (wide only: the sides are covered by signs in tall)
  if (kind === 'wide') {
    for (const px of [370, w - 370 - 180]) {
      rr(g, px, 90, 180, 170, 10, 0xe9c88a);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) g.fillStyle(0xb98a45, 1).fillCircle(px + 26 + i * 42, 120 + j * 50, 4);
      // wrench
      g.lineStyle(10, INK, 1).beginPath().moveTo(px + 30, 220).lineTo(px + 80, 128).strokePath();
      g.lineStyle(5, 0xcfd8e3, 1).beginPath().moveTo(px + 30, 220).lineTo(px + 80, 128).strokePath();
      circ(g, px + 84, 112, 16, 0xcfd8e3, 4);
      // hammer
      g.lineStyle(10, INK, 1).beginPath().moveTo(px + 140, 230).lineTo(px + 140, 130).strokePath();
      g.lineStyle(5, 0xc87a3a, 1).beginPath().moveTo(px + 140, 230).lineTo(px + 140, 130).strokePath();
      rr(g, px + 110, 106, 62, 28, 6, 0x8a93a6, 4);
    }
  }
  // floor
  g.fillStyle(0x9aa4b1, 1).fillRect(0, floorY, w, h - floorY);
  const hz = 24;
  for (let x = 0; x < w; x += hz * 2) { g.fillStyle(0xffd23f, 1).fillRect(x, floorY, hz, 16); g.fillStyle(INK, 1).fillRect(x + hz, floorY, hz, 16); }
  g.lineStyle(4, 0xffffff, 0.5);
  for (let x = 120; x < w; x += 300) g.strokeRect(x, floorY + 110, 160, 0);
  // props on the floor: tire stacks, oil cans, toolbox
  if (kind === 'wide') {
    for (const [sx, dir] of [[520, 1], [w - 520, -1]] as const) {
      tire(g, sx, floorY + 150, 62); tire(g, sx + dir * 30, floorY + 98, 56);
      oilCan(g, sx + dir * 110, floorY + 150, 1);
    }
    rr(g, 380, floorY + 190, 150, 74, 10, 0xe8232a); rr(g, 420, floorY + 168, 70, 30, 8, 0x8a93a6, 4);
    rr(g, w - 380 - 150, floorY + 190, 150, 74, 10, 0xffb12b);
  } else {
    tire(g, 330, floorY + 190, 54); oilCan(g, 410, floorY + 190, 0.9);
    tire(g, w - 330, floorY + 190, 54);
  }
}

function tank(g: G, x: number, y: number, tw: number, th: number, liquid: number): void {
  rr(g, x, y + th - 30, tw, 30, 8, 0x8a93a6);
  rr(g, x + 8, y, tw - 16, th - 24, 22, 0xe4f6ff, 5);
  g.fillStyle(liquid, 0.85).fillRoundedRect(x + 14, y + th * 0.3, tw - 28, th - 24 - th * 0.3 - 6, 14);
  g.fillStyle(0xffffff, 0.4).fillRoundedRect(x + 22, y + 22, 10, th - 90, 5);
  rr(g, x + tw / 2 - 18, y - 16, 36, 20, 6, 0x8a93a6, 4);
}

function fern(g: G, x: number, y: number, s: number): void {
  rr(g, x - 34 * s, y - 46 * s, 68 * s, 46 * s, 10 * s, 0xe08a4a);
  for (let i = -3; i <= 3; i++) {
    g.fillStyle(i % 2 ? 0x2fb84f : 0x5bc043, 1);
    g.fillEllipse(x + i * 18 * s, y - 100 * s + Math.abs(i) * 16 * s, 26 * s, 100 * s);
    g.lineStyle(4, INK, 1).strokeEllipse(x + i * 18 * s, y - 100 * s + Math.abs(i) * 16 * s, 26 * s, 100 * s);
  }
}

function ribs(g: G, cx: number, cy: number, s: number): void {
  g.lineStyle(10, INK, 1).beginPath().moveTo(cx - 90 * s, cy).lineTo(cx + 90 * s, cy).strokePath();
  g.lineStyle(5, 0xfff3d6, 1).beginPath().moveTo(cx - 90 * s, cy).lineTo(cx + 90 * s, cy).strokePath();
  for (let i = -3; i <= 3; i++) {
    const x = cx + i * 26 * s;
    g.lineStyle(10, INK, 1).beginPath().arc(x, cy, 44 * s - Math.abs(i) * 6 * s, 0.1, Math.PI - 0.1).strokePath();
    g.lineStyle(5, 0xfff3d6, 1).beginPath().arc(x, cy, 44 * s - Math.abs(i) * 6 * s, 0.1, Math.PI - 0.1).strokePath();
  }
}

function drawLab(g: G, w: number, h: number, kind: LayoutKind, floorY: number, tanks: TankSpot[]): void {
  g.fillStyle(0xcdeedd, 1).fillRect(0, 0, w, floorY);
  // lower tiles on the wall
  for (let x = 0; x < w; x += 70) for (let y = floorY - 210; y < floorY - 40; y += 70) {
    g.fillStyle(((x / 70 + y / 70) | 0) % 2 === 0 ? 0x8fd8d0 : 0xa9e4dd, 1).fillRect(x, y, 70, 70);
  }
  g.fillStyle(0x2b9aa0, 1).fillRect(0, floorY - 48, w, 20);
  // window with a moon
  const wx = w / 2 - (kind === 'wide' ? 250 : 190), ww = kind === 'wide' ? 500 : 380;
  rr(g, wx, 150, ww, 270, 18, 0x1c2f6b);
  circ(g, wx + ww * 0.78, 230, 40, 0xfff3b0, 4);
  for (const [sx, sy] of [[0.2, 0.25], [0.45, 0.6], [0.6, 0.3], [0.3, 0.75]] as const) g.fillStyle(0xffffff, 1).fillCircle(wx + ww * sx, 150 + 270 * sy, 5);
  g.lineStyle(10, 0xf4f7fb, 1).strokeRoundedRect(wx, 150, ww, 270, 18);
  g.fillStyle(0xf4f7fb, 1).fillRect(wx + ww / 2 - 5, 150, 10, 270);
  // fossil on the wall
  if (kind === 'wide') {
    ribs(g, 520, 160, 1.0);
    ribs(g, w - 520, 160, 1.0);
  }
  // floor: checker
  g.fillStyle(0xf1ecff, 1).fillRect(0, floorY, w, h - floorY);
  const t = 80;
  for (let x = 0; x < w; x += t) for (let y = floorY; y < h; y += t) {
    if ((((x / t) | 0) + (((y - floorY) / t) | 0)) % 2 === 0) { g.fillStyle(0xd5c8f5, 1).fillRect(x, y, t, t); }
  }
  g.fillStyle(0x2b9aa0, 1).fillRect(0, floorY, w, 12);
  // tanks (bubbling) and plants
  for (const k of tanks) tank(g, k.x, k.y, k.w, k.h, 0x6be28f);
  if (kind === 'wide') {
    fern(g, 420, floorY + 80, 1.15); fern(g, w - 420, floorY + 80, 1.15);
    fern(g, 560, floorY + 200, 0.9);
  } else {
    fern(g, 330, floorY + 220, 0.9); fern(g, w - 330, floorY + 220, 0.9);
  }
}

/** Bakes (once) the backdrop for a workshop and layout and returns its texture key and the tank spots (for bubbles). */
export function roomBackdrop(scene: Phaser.Scene, workshop: WorkshopId, kind: LayoutKind, floorY: number): Backdrop {
  const { w, h } = paneSize(kind);
  const key = `ws:room:${workshop}:${kind}`;
  const tanks: TankSpot[] = [];
  if (workshop === 'dino') {
    if (kind === 'wide') tanks.push({ x: 440, y: 260, w: 110, h: 330 }, { x: w - 550, y: 260, w: 110, h: 330 }, { x: 590, y: 330, w: 90, h: 260 }, { x: w - 680, y: 330, w: 90, h: 260 });
    else tanks.push({ x: 285, y: 200, w: 100, h: 340 }, { x: w - 385, y: 200, w: 100, h: 340 });
  }
  if (scene.textures.exists(key)) return { key, tanks };
  const g = scene.make.graphics({}, false);
  if (workshop === 'race') drawGarage(g, w, h, kind, floorY); else drawLab(g, w, h, kind, floorY, tanks);
  g.generateTexture(key, w, h);
  g.destroy();
  return { key, tanks };
}
