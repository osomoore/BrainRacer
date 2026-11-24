/**
 * Dino Lab scene kit, layer 1: baked-texture registry and canvas painting primitives.
 *
 * Every picture in the kit is drawn ONCE with Canvas 2D into a cached `ws:` texture (CLAUDE.md rule 15:
 * never redraw rounded shapes per frame) and then placed as a plain Image. `def()` registers a drawing under
 * a key (nothing is drawn yet); `image()` bakes on first use and returns an Image whose origin is the
 * drawing's own origin point (e.g. feet, trunk base) so props sit on the ground line naturally.
 *
 * Reusable: nothing here knows about dinosaurs or scenarios. May be merged with a common run kit later.
 */
import type Phaser from 'phaser';
import { Q, ensureTexture, type PartSpec } from '../../../art/bake';
import { darken, lighten } from '../../../art/geom';

export const INK = '#1b1b3a';
export { darken, lighten };
export type G = CanvasRenderingContext2D;

const defs = new Map<string, PartSpec>();

/** Register a drawing. (ox, oy) is the origin inside the w x h box; draw() uses plain box coordinates (0..w, 0..h). */
export function def(key: string, w: number, h: number, ox: number, oy: number, draw: (g: G) => void): void {
  defs.set(key, { key: `ws:dino-run:${key}`, w, h, ox, oy, draw: (g) => { g.translate(-ox, -oy); draw(g); } });
}

export function hasDef(key: string): boolean { return defs.has(key); }

export function ensure(scene: Phaser.Scene, key: string): PartSpec {
  const s = defs.get(key);
  if (!s) throw new Error(`dino kit: unknown texture ${key}`);
  ensureTexture(scene, s);
  return s;
}

/** Baked picture as an Image at drawing scale `scale` (1 = design px), origin at the drawing's origin. Not added to any container. */
export function image(scene: Phaser.Scene, key: string, x = 0, y = 0, scale = 1): Phaser.GameObjects.Image {
  const s = ensure(scene, key);
  return scene.make.image({ x, y, key: s.key, add: false }).setOrigin(s.ox / s.w, s.oy / s.h).setScale(scale / Q);
}

/** Swap an Image to another baked drawing (keeps position/scale in design px). */
export function swap(scene: Phaser.Scene, im: Phaser.GameObjects.Image, key: string): void {
  const s = ensure(scene, key);
  im.setTexture(s.key).setOrigin(s.ox / s.w, s.oy / s.h);
}

/** Seeded-free deterministic pseudo random for baking (same pixels every time). */
export function bakeRng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

// ------------------------------------------------------------------ primitives

export function oval(g: G, cx: number, cy: number, rx: number, ry: number, fill: string, ol = 4, rot = 0): void {
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  g.fillStyle = fill; g.fill();
  if (ol > 0) { g.lineWidth = ol; g.strokeStyle = INK; g.stroke(); }
}

export function rrect(g: G, x: number, y: number, w: number, h: number, r: number, fill: string, ol = 4): void {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
  g.fillStyle = fill; g.fill();
  if (ol > 0) { g.lineWidth = ol; g.strokeStyle = INK; g.stroke(); }
}

/** Closed smooth blob through points (quadratic midpoints). */
export function blob(g: G, pts: readonly [number, number][], fill: string, ol = 4): void {
  const n = pts.length;
  const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  g.beginPath();
  g.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n]);
    g.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  g.closePath();
  g.fillStyle = fill; g.fill();
  if (ol > 0) { g.lineWidth = ol; g.strokeStyle = INK; g.stroke(); }
}

export function poly(g: G, pts: readonly [number, number][], fill: string, ol = 4): void {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
  g.fillStyle = fill; g.fill();
  if (ol > 0) { g.lineWidth = ol; g.strokeStyle = INK; g.stroke(); }
}

export function stroke(g: G, pts: readonly [number, number][], color: string, w: number): void {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.strokeStyle = color; g.lineWidth = w; g.stroke();
}

/** Cartoon eye: white ball with a pupil looking (lx, ly) in -1..1. */
export function eye(g: G, x: number, y: number, r: number, lx = 0.3, ly = 0): void {
  oval(g, x, y, r, r * 1.1, '#fff', 3);
  oval(g, x + lx * r * 0.4, y + ly * r * 0.4, r * 0.5, r * 0.55, INK, 0);
  oval(g, x + lx * r * 0.4 - r * 0.15, y + ly * r * 0.4 - r * 0.2, r * 0.17, r * 0.17, '#fff', 0);
}

/** Closed (sleeping / giggling) eye: a happy arc. */
export function arcEye(g: G, x: number, y: number, r: number, up = true): void {
  g.beginPath();
  g.arc(x, y, r, up ? Math.PI : 0, up ? Math.PI * 2 : Math.PI);
  g.strokeStyle = INK; g.lineWidth = 3.5; g.stroke();
}

export function smile(g: G, x: number, y: number, r: number, open = false): void {
  g.beginPath();
  g.arc(x, y, r, 0.15 * Math.PI, 0.85 * Math.PI);
  if (open) { g.closePath(); g.fillStyle = '#7a1f3d'; g.fill(); }
  g.strokeStyle = INK; g.lineWidth = 3.5; g.stroke();
}

export function vgrad(g: G, y0: number, y1: number, top: string, bottom: string): CanvasGradient {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  return gr;
}

export function star(g: G, cx: number, cy: number, r: number, fill: string, ol = 3, points = 5): void {
  const pts: [number, number][] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  poly(g, pts, fill, ol);
}
