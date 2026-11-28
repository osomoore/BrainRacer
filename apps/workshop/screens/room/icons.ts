/** Baked 96x96 aspect icons for the station signs (one per aspect, per workshop) and the little kid character. */
import Phaser from 'phaser';
import type { WorkshopId } from '../../core/types';

export const ICON = 96;
const INK = 0x1b1b3a;

type G = Phaser.GameObjects.Graphics;
const pt = (x: number, y: number) => new Phaser.Geom.Point(x, y);

function poly(g: G, pts: [number, number][], fill: number): void {
  const p = pts.map(([x, y]) => pt(x, y));
  g.fillStyle(fill, 1).fillPoints(p, true);
  g.strokePoints(p, true);
}
function disc(g: G, x: number, y: number, r: number, fill: number): void {
  g.fillStyle(fill, 1).fillCircle(x, y, r);
  g.strokeCircle(x, y, r);
}
function rrect(g: G, x: number, y: number, w: number, h: number, r: number, fill: number): void {
  g.fillStyle(fill, 1).fillRoundedRect(x, y, w, h, r);
  g.strokeRoundedRect(x, y, w, h, r);
}
function path(g: G, pts: [number, number][]): void {
  g.beginPath().moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) g.lineTo(x, y);
  g.strokePath();
}

export function globeTexture(scene: Phaser.Scene): string {
  const key = 'ws:room-globe';
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  g.lineStyle(6, INK, 1);
  disc(g, 48, 48, 43, 0x2b8cff);
  g.lineStyle(4, 0xffffff, 1).strokeCircle(48, 48, 28).strokeEllipse(48, 48, 25, 56);
  path(g, [[20, 48], [76, 48]]);
  g.lineStyle(4, INK, 1);
  disc(g, 78, 78, 16, 0xffd23f);
  path(g, [[71, 71], [78, 78], [85, 71]]);
  path(g, [[78, 78], [78, 86]]);
  g.generateTexture(key, 96, 96);
  g.destroy();
  return key;
}

function starPoints(cx: number, cy: number, ro: number, ri: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const r = i % 2 === 0 ? ro : ri;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

function drawIcon(g: G, workshop: WorkshopId, aspect: string): void {
  g.lineStyle(5, INK, 1);
  switch (aspect) {
    case 'wheels':
      disc(g, 48, 48, 38, 0x2d2d4a); disc(g, 48, 48, 17, 0xcfd8e3);
      g.lineStyle(5, 0xcfd8e3, 1);
      for (let a = 0; a < 4; a++) {
        const r = a * Math.PI / 2 + 0.4;
        path(g, [[48 + Math.cos(r) * 17, 48 + Math.sin(r) * 17], [48 + Math.cos(r) * 30, 48 + Math.sin(r) * 30]]);
      }
      break;
    case 'engine':
      rrect(g, 14, 36, 68, 44, 8, 0xe8232a);
      for (const x of [24, 42, 60]) rrect(g, x, 18, 14, 20, 4, 0xcfd8e3);
      rrect(g, 4, 50, 14, 16, 4, 0x8a93a6); disc(g, 48, 58, 9, 0xffd23f);
      break;
    case 'gears': {
      const pts: [number, number][] = [];
      for (let i = 0; i < 16; i++) {
        const a = i * Math.PI / 8;
        const r = i % 2 === 0 ? 42 : 30;
        pts.push([48 + Math.cos(a) * r, 48 + Math.sin(a) * r]);
      }
      poly(g, pts, 0xffb12b); disc(g, 48, 48, 12, 0xfff3c4);
      break;
    }
    case 'springs': {
      const zig: [number, number][] = [[48, 8], [70, 22], [26, 36], [70, 50], [26, 64], [70, 78], [48, 90]];
      g.lineStyle(11, INK, 1); path(g, zig);
      g.lineStyle(5, 0x2fb84f, 1); path(g, zig);
      break;
    }
    case 'bumpers':
      rrect(g, 20, 58, 14, 22, 3, 0x8a93a6); rrect(g, 62, 58, 14, 22, 3, 0x8a93a6);
      rrect(g, 6, 34, 84, 28, 14, 0xcfd8e3);
      break;
    case 'paint': case 'color': {
      const c = workshop === 'dino' ? 0x2fb84f : 0x2b8cff;
      poly(g, [[48, 6], [76, 52], [20, 52]], c);
      disc(g, 48, 58, 28, c);
      g.fillStyle(0xffffff, 0.55).fillCircle(38, 54, 7);
      if (workshop === 'dino') { g.fillStyle(0xffd23f, 1).fillCircle(60, 64, 6); g.fillStyle(0xff5a5f, 1).fillCircle(46, 74, 6); }
      break;
    }
    case 'body':
      if (workshop === 'race') {
        poly(g, [[28, 44], [40, 22], [64, 22], [76, 44]], 0x9bd7ff); rrect(g, 8, 40, 80, 32, 12, 0xe8232a);
        disc(g, 28, 74, 11, 0x2d2d4a); disc(g, 68, 74, 11, 0x2d2d4a);
      } else {
        g.fillStyle(0x2fb84f, 1).fillEllipse(48, 52, 80, 62); g.strokeEllipse(48, 52, 80, 62);
        g.fillStyle(0xd9f5c8, 1).fillEllipse(48, 64, 48, 30);
      }
      break;
    case 'shape':
      rrect(g, 6, 8, 40, 40, 6, 0xffd23f); disc(g, 70, 30, 20, 0x2bb3ff); poly(g, [[28, 90], [50, 52], [72, 90]], 0xff5a5f);
      break;
    case 'size':
      rrect(g, 6, 50, 30, 30, 6, 0xffd23f); rrect(g, 44, 14, 46, 66, 8, 0x2fb84f);
      g.lineStyle(6, INK, 1); path(g, [[6, 90], [90, 90]]);
      break;
    case 'extra':
      poly(g, starPoints(48, 50, 42, 18), 0xffd23f);
      break;
    case 'head':
      disc(g, 44, 50, 34, 0x2fb84f); rrect(g, 50, 52, 42, 26, 12, 0x2fb84f);
      disc(g, 52, 38, 10, 0xffffff); disc(g, 55, 38, 5, INK); poly(g, [[26, 22], [34, 2], [42, 20]], 0xffd23f);
      break;
    case 'teeth':
      rrect(g, 6, 22, 84, 52, 18, 0xff8a8a);
      for (let i = 0; i < 5; i++) poly(g, [[14 + i * 15, 24], [22 + i * 15, 24], [18 + i * 15, 46]], 0xffffff);
      for (let i = 0; i < 4; i++) poly(g, [[22 + i * 15, 72], [30 + i * 15, 72], [26 + i * 15, 52]], 0xffffff);
      break;
    case 'claws':
      for (let i = 0; i < 3; i++) poly(g, [[16 + i * 28, 16], [36 + i * 28, 16], [28 + i * 28, 84]], 0xfff3c4);
      break;
    case 'legs':
      rrect(g, 30, 4, 26, 62, 12, 0x2fb84f); poly(g, [[26, 66], [84, 66], [84, 88], [18, 88]], 0x2fb84f);
      break;
    case 'move':
      for (const [x, y] of [[26, 28], [62, 62]] as const) {
        disc(g, x, y + 8, 14, 0x2fb84f);
        for (const dx of [-14, 0, 14]) disc(g, x + dx, y - 12, 6, 0x2fb84f);
      }
      break;
    case 'tail':
      poly(g, [[6, 70], [30, 30], [58, 40], [90, 10], [78, 70], [40, 86]], 0x2fb84f);
      break;
    default:
      disc(g, 48, 48, 36, 0xffd23f);
  }
}

/** Texture key of the aspect's icon (baked once). */
export function aspectIconTexture(scene: Phaser.Scene, workshop: WorkshopId, aspect: string): string {
  const key = `ws:aicon:${workshop}:${aspect}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  drawIcon(g, workshop, aspect);
  g.generateTexture(key, ICON, ICON);
  g.destroy();
  return key;
}

export function starTexture(scene: Phaser.Scene, d = 48, fill = 0xffd23f): string {
  const key = `ws:star:${d}:${fill.toString(16)}`;
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  g.lineStyle(4, INK, 1);
  poly(g, starPoints(d / 2, d / 2 + 1, d / 2 - 3, d / 5), fill);
  g.generateTexture(key, d, d);
  g.destroy();
  return key;
}

export function bubbleTexture(scene: Phaser.Scene): string {
  const key = 'ws:bubble';
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({}, false);
  g.fillStyle(0xffffff, 0.35).fillCircle(16, 16, 13);
  g.lineStyle(3, 0xffffff, 0.9).strokeCircle(16, 16, 13);
  g.fillStyle(0xffffff, 0.8).fillCircle(11, 11, 3);
  g.generateTexture(key, 32, 32);
  g.destroy();
  return key;
}

/** Character textures: head + torso in the player's color, and a shoe piece. */
export const KID_W = 90;
export const KID_H = 120;
export function kidTextures(scene: Phaser.Scene, color: number): { body: string; leg: string } {
  const body = `ws:kid:${color.toString(16)}`;
  const leg = 'ws:kid:leg';
  if (!scene.textures.exists(body)) {
    const g = scene.make.graphics({}, false);
    g.lineStyle(5, INK, 1);
    rrect(g, 20, 62, 50, 50, 16, color);
    rrect(g, 6, 68, 18, 34, 9, color); rrect(g, 66, 68, 18, 34, 9, color);
    disc(g, 45, 36, 28, 0xffd9b0);
    g.fillStyle(0x5b3a1e, 1).fillRoundedRect(16, 8, 58, 22, 11);
    disc(g, 34, 42, 4, INK); disc(g, 56, 42, 4, INK);
    g.lineStyle(4, INK, 1); g.beginPath().arc(45, 48, 9, 0.3, Math.PI - 0.3).strokePath();
    g.generateTexture(body, KID_W, KID_H);
    g.destroy();
  }
  if (!scene.textures.exists(leg)) {
    const g = scene.make.graphics({}, false);
    g.lineStyle(5, INK, 1);
    rrect(g, 4, 2, 24, 28, 10, 0x2b4a9f);
    g.generateTexture(leg, 32, 34);
    g.destroy();
  }
  return { body, leg };
}
