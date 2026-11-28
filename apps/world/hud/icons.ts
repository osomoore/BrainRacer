import type Phaser from 'phaser';

/** Picture icons, baked once into 128 px textures `world-icon:<name>` (never drawn in a live Graphics). */
export type IconName = 'hand' | 'horn' | 'swap' | 'lab' | 'tick' | 'cross' | 'play' | 'home' | 'exit' | 'pause'
  | 'star' | 'quest' | 'roar' | 'rocket' | 'wings' | 'winch' | 'bag';
export const ICON_SIZE = 128;
export const iconKey = (name: IconName) => `world-icon:${name}`;

const INK = 0x1c2540;
const WHITE = 0xffffff;

type Prim =
  | { t: 'rr'; x: number; y: number; w: number; h: number; r: number }
  | { t: 'c'; x: number; y: number; r: number }
  | { t: 'poly'; pts: { x: number; y: number }[] };
const rr = (x: number, y: number, w: number, h: number, r = 6): Prim => ({ t: 'rr', x, y, w, h, r });
const circ = (x: number, y: number, r: number): Prim => ({ t: 'c', x, y, r });
const poly = (...p: number[]): Prim => ({ t: 'poly', pts: Array.from({ length: p.length / 2 }, (_, i) => ({ x: p[2 * i], y: p[2 * i + 1] })) });

function fillPrim(g: Phaser.GameObjects.Graphics, p: Prim, grow: number): void {
  if (p.t === 'rr') g.fillRoundedRect(p.x - grow, p.y - grow, p.w + grow * 2, p.h + grow * 2, p.r + grow);
  else if (p.t === 'c') g.fillCircle(p.x, p.y, p.r + grow);
  else if (grow === 0) g.fillPoints(p.pts, true);
  else {
    // Grow a polygon around its centroid and stroke it so the outline stays even.
    g.fillPoints(p.pts, true);
    g.lineStyle(grow * 2, INK, 1).strokePoints(p.pts, true);
  }
}

/** Dark outline first (grown shapes), then the fills on top. */
function shapes(g: Phaser.GameObjects.Graphics, list: Prim[], fill: number, outline = 5): void {
  g.fillStyle(INK, 1);
  for (const p of list) fillPrim(g, p, outline);
  g.fillStyle(fill, 1);
  for (const p of list) fillPrim(g, p, 0);
}

function arrow(g: Phaser.GameObjects.Graphics, x1: number, x2: number, y: number, fill: number): void {
  const d = Math.sign(x2 - x1);
  shapes(g, [rr(Math.min(x1, x2 - d * 8), y - 5, Math.abs(x2 - x1) - 8, 10, 3), poly(x2, y, x2 - d * 22, y - 15, x2 - d * 22, y + 15)], fill, 3);
}

const DRAW: Record<IconName, (g: Phaser.GameObjects.Graphics) => void> = {
  hand: g => {
    shapes(g, [rr(36, 62, 62, 54, 16), rr(36, 22, 14, 56, 7), rr(52, 12, 14, 66, 7), rr(68, 16, 14, 62, 7), rr(84, 28, 14, 50, 7),
      rr(14, 64, 36, 15, 7)], WHITE);
  },
  horn: g => {
    shapes(g, [rr(16, 50, 28, 30, 6), poly(40, 50, 90, 22, 90, 108, 40, 80), rr(86, 20, 12, 90, 6), rr(22, 80, 16, 26, 5)], 0xffd54a);
    g.lineStyle(7, WHITE, 1);
    for (const r of [14, 26]) { g.beginPath(); g.arc(104, 65, r, -0.9, 0.9, false); g.strokePath(); }
  },
  roar: g => {
    shapes(g, [rr(14, 30, 62, 36, 16), rr(19, 80, 57, 20, 10), poly(14, 48, 39, 56, 35, 99, 12, 95)], 0x95e283);
    g.fillStyle(INK, 1).fillCircle(61, 43, 5);
    g.fillStyle(WHITE, 1).fillTriangle(48, 64, 57, 77, 64, 64);
    g.lineStyle(7, WHITE, 1);
    for (const r of [14, 29]) { g.beginPath(); g.arc(94, 71, r, -0.92, 0.92, false); g.strokePath(); }
  },
  rocket: g => {
    shapes(g, [poly(48, 79, 34, 116, 65, 101, 77, 80)], 0xffc44d);
    shapes(g, [poly(50, 59, 29, 72, 27, 94, 56, 81), poly(69, 69, 66, 96, 91, 83, 92, 54)], 0xff6d64);
    shapes(g, [poly(42, 74, 55, 44, 77, 22, 108, 14, 103, 46, 87, 72, 59, 92)], WHITE);
    shapes(g, [circ(80, 46, 11)], 0x6ec6ff, 3);
  },
  wings: g => {
    shapes(g, [poly(61, 64, 44, 38, 10, 24, 17, 61, 32, 79, 52, 88, 62, 102),
      poly(67, 64, 84, 38, 118, 24, 111, 61, 96, 79, 76, 88, 66, 102)], 0xcfeaff);
    g.lineStyle(5, INK, 1).lineBetween(25, 52, 46, 69).lineBetween(103, 52, 82, 69);
  },
  winch: g => {
    shapes(g, [rr(10, 26, 66, 57, 10), rr(68, 51, 36, 12, 5)], 0xffd54a);
    shapes(g, [circ(42, 55, 16)], 0xd9edfb, 4);
    for (const [width, color] of [[20, INK], [11, WHITE]] as const) {
      g.lineStyle(width, color, 1).beginPath().arc(96, 84, 19, -Math.PI / 2, Math.PI, false).strokePath();
    }
  },
  bag: g => {
    shapes(g, [rr(47, 18, 34, 28, 10)], WHITE);
    shapes(g, [rr(23, 36, 82, 76, 17)], 0xf6ae4e);
    shapes(g, [rr(37, 65, 54, 31, 7)], 0xffda75, 4);
    g.fillStyle(INK, 1).fillRoundedRect(59, 62, 10, 18, 3);
  },
  swap: g => {
    // little car (top-left), dino (bottom-right), a double arrow between them
    shapes(g, [rr(8, 16, 56, 22, 8), rr(20, 6, 30, 18, 7)], 0x6ec6ff, 4);
    shapes(g, [circ(22, 42, 8), circ(52, 42, 8)], WHITE, 4);
    shapes(g, [rr(58, 80, 54, 28, 12), circ(104, 76, 13), poly(60, 90, 34, 104, 62, 104), rr(70, 102, 9, 14, 3), rr(94, 102, 9, 14, 3)], 0x7ee081, 4);
    arrow(g, 14, 62, 62, WHITE);
    arrow(g, 114, 66, 62, WHITE);
  },
  lab: g => {
    shapes(g, [rr(26, 10, 76, 110, 12)], 0xc98a4b, 6);
    g.fillStyle(0xa86f38, 1).fillRoundedRect(36, 20, 56, 90, 8);
    shapes(g, [circ(64, 48, 20)], 0xcfefff, 4);
    // flask in the window
    g.fillStyle(0x3ec46d, 1).fillPoints([{ x: 58, y: 56 }, { x: 70, y: 56 }, { x: 76, y: 66 }, { x: 52, y: 66 }], true);
    g.fillStyle(0xffffff, 1).fillRect(60, 36, 8, 20);g.lineStyle(3, INK, 1).strokeRect(60, 36, 8, 20);
    shapes(g, [circ(88, 78, 6)], 0xffd54a, 3);
  },
  tick: g => {
    g.lineStyle(30, INK, 1).strokePoints([{ x: 22, y: 68 }, { x: 52, y: 98 }, { x: 108, y: 30 }]);
    g.lineStyle(20, WHITE, 1).strokePoints([{ x: 22, y: 68 }, { x: 52, y: 98 }, { x: 108, y: 30 }]);
  },
  cross: g => {
    for (const [w, c] of [[30, INK], [20, WHITE]] as const) {
      g.lineStyle(w, c, 1).strokePoints([{ x: 28, y: 28 }, { x: 100, y: 100 }]).strokePoints([{ x: 100, y: 28 }, { x: 28, y: 100 }]);
    }
  },
  play: g => { shapes(g, [poly(32, 14, 108, 64, 32, 114)], WHITE, 6); },
  home: g => { shapes(g, [rr(26, 58, 76, 56, 6), poly(64, 10, 118, 62, 10, 62), rr(52, 76, 24, 38, 4)], WHITE, 5); },
  exit: g => {
    shapes(g, [rr(12, 14, 50, 100, 8)], 0xc98a4b, 5);
    arrow(g, 40, 116, 64, WHITE);
  },
  pause: g => { shapes(g, [rr(30, 20, 26, 88, 8), rr(72, 20, 26, 88, 8)], WHITE, 6); },
  star: g => {
    const points = Array.from({ length: 10 }, (_, i) => {
      const angle = i * Math.PI / 5 - Math.PI / 2, radius = i % 2 === 0 ? 54 : 26;
      return { x: 64 + radius * Math.cos(angle), y: 67 + radius * Math.sin(angle) };
    });
    shapes(g, [{ t: 'poly', pts: points }], 0xffdf66, 5);
  },
  quest: g => {
    shapes(g, [rr(26, 14, 76, 100, 12)], 0xffe9ad, 6);
    g.fillStyle(INK, 1).fillRoundedRect(43, 41, 42, 8, 4).fillRoundedRect(43, 59, 42, 8, 4)
      .fillRoundedRect(43, 77, 28, 8, 4);
  },
};

/** Bake all icons into `scene.textures` (idempotent; textures are shared across scenes). */
export function bakeIcons(scene: Phaser.Scene): void {
  for (const name of Object.keys(DRAW) as IconName[]) {
    const key = iconKey(name);
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics({ x: 0, y: 0 });
    DRAW[name](g);
    g.generateTexture(key, ICON_SIZE, ICON_SIZE);
    g.destroy();
  }
}

/** Bake a rounded-rect plate (shadow + fill + white edge) at an exact size. */
export function bakePlate(scene: Phaser.Scene, key: string, w: number, h: number, fill: number, alpha = 1, radius = 28, edge = 0xffffff): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(fill, alpha).fillRoundedRect(0, 0, w, h, radius);
  g.lineStyle(6, edge, 1).strokeRoundedRect(3, 3, w - 6, h - 6, radius - 2);
  g.generateTexture(key, w, h);
  g.destroy();
}

/** Bake a filled round disc with a white ring. */
export function bakeDisc(scene: Phaser.Scene, key: string, r: number, fill: number, ring = 0xffffff): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(fill, 1).fillCircle(r, r, r - 2);
  g.lineStyle(Math.max(3, r / 8), ring, 1).strokeCircle(r, r, r - 3);
  g.generateTexture(key, r * 2, r * 2);
  g.destroy();
}
