/**
 * Run scene kit: drawing helpers for baked props (CLAUDE.md rule 15: bake once, never redraw rounded shapes live).
 * Every prop is a `PartSpec` (see art/bake.ts) cached by key; `prop()` bakes it and returns an Image whose origin
 * is the spec origin (bottom-centre for most props), at design scale (1 unit = 1 world px).
 */
import type Phaser from 'phaser';
import { OUTLINE, type PartSpec, partImage } from '../../art/bake';
import { darken, lighten } from '../../art/geom';

export { OUTLINE, darken, lighten };
export type Ctx2D = CanvasRenderingContext2D;

/** Palette of the run scenes (cheerful, high contrast). */
export const PAL = {
  ink: OUTLINE, grass: '#5cc85a', grassDark: '#3fa046', dirt: '#b07a43', dirtDark: '#8a5a30', mud: '#7a4a24',
  mudDark: '#5a3418', sky: '#7fd3ff', skyLow: '#e6f7ff', white: '#ffffff', wood: '#c98a4b', woodDark: '#9a6230',
  stone: '#aab2bd', stoneDark: '#7d8794', red: '#e8434a', yellow: '#ffd23f', blue: '#2b8cff', green: '#2fb84f',
  orange: '#ff9a3c', pink: '#ff7eb6', purple: '#a35cff', water: '#4fb8ff', waterDark: '#2b8cff', snow: '#f4fbff',
  road: '#6b7280', roadDark: '#4b5563', hay: '#f2cf5a', hayDark: '#d4a933', night: '#141a3a',
} as const;

/** Build a spec: size w x h, origin defaults to bottom-centre minus a small pad. */
export function spec(key: string, w: number, h: number, draw: (g: Ctx2D) => void, ox = w / 2, oy = h - 8): PartSpec {
  // draw() works in top-left based coordinates; the baker translates by the origin, so cancel that here
  return { key: `wsr:${key}`, w, h, ox, oy, draw: (g) => { g.translate(-ox, -oy); draw(g); } };
}

/** Bake (cached) and add an image to `parent` (or the scene when null). */
export function prop(scene: Phaser.Scene, parent: Phaser.GameObjects.Container | null, s: PartSpec, x = 0, y = 0, scale = 1): Phaser.GameObjects.Image {
  const img = partImage(scene, s, x, y);
  img.setScale(img.scaleX * scale, img.scaleY * scale);
  parent?.add(img);
  return img;
}

/** Outlined fill: path builder -> fill + ink outline. */
export function ol(g: Ctx2D, fill: string | CanvasGradient, path: (g: Ctx2D) => void, lw = 5): void {
  g.beginPath(); path(g); g.fillStyle = fill; g.fill();
  g.lineWidth = lw; g.strokeStyle = OUTLINE; g.stroke();
}
/** Fill without outline. */
export function fl(g: Ctx2D, fill: string, path: (g: Ctx2D) => void): void {
  g.beginPath(); path(g); g.fillStyle = fill; g.fill();
}
export const circ = (cx: number, cy: number, r: number) => (g: Ctx2D) => { g.moveTo(cx + r, cy); g.arc(cx, cy, r, 0, Math.PI * 2); };
export const ell = (cx: number, cy: number, rx: number, ry: number, rot = 0) => (g: Ctx2D) => { g.moveTo(cx + rx * Math.cos(rot), cy + rx * Math.sin(rot)); g.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2); };
export const rr = (x: number, y: number, w: number, h: number, r: number) => (g: Ctx2D) => {
  const q = Math.min(r, w / 2, h / 2);
  g.moveTo(x + q, y); g.arcTo(x + w, y, x + w, y + h, q); g.arcTo(x + w, y + h, x, y + h, q);
  g.arcTo(x, y + h, x, y, q); g.arcTo(x, y, x + w, y, q); g.closePath();
};
export const poly = (pts: readonly (readonly [number, number])[]) => (g: Ctx2D) => {
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
};
/** Two small eyes with highlights, facing right. */
export function eyes(g: Ctx2D, x: number, y: number, r: number, gap: number): void {
  for (const dx of [-gap, gap]) {
    fl(g, '#fff', circ(x + dx, y, r));
    fl(g, OUTLINE, circ(x + dx + r * 0.25, y + r * 0.1, r * 0.55));
  }
}
export function line(g: Ctx2D, x0: number, y0: number, x1: number, y1: number, lw = 5, c: string = OUTLINE): void {
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.strokeStyle = c; g.lineWidth = lw; g.stroke();
}

/** Create (once) a small canvas texture and return its key (for particles / tiny shared textures). */
export function bakeKey(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: Ctx2D) => void): string {
  const k = `wsr:${key}`;
  if (!scene.textures.exists(k)) {
    const t = scene.textures.createCanvas(k, w, h);
    if (t) { const g = t.getContext(); g.lineJoin = 'round'; g.lineCap = 'round'; draw(g); t.refresh(); }
  }
  return k;
}

/**
 * A texture that lives only as long as `owner` (used for big one-off backgrounds such as the top-view track).
 * Returns its key; removed when `owner` is destroyed.
 */
let tmpId = 0;
export function bakeTemp(scene: Phaser.Scene, owner: Phaser.GameObjects.GameObject, w: number, h: number, draw: (g: Ctx2D) => void): string {
  const k = `wsr:tmp:${tmpId++}`;
  const t = scene.textures.createCanvas(k, Math.ceil(w), Math.ceil(h));
  if (t) { const g = t.getContext(); g.lineJoin = 'round'; g.lineCap = 'round'; draw(g); t.refresh(); }
  owner.once('destroy', () => { if (scene.textures.exists(k)) scene.textures.remove(k); });
  return k;
}

export function vGradient(g: Ctx2D, h: number, a: string, b: string, mid?: [number, string]): CanvasGradient {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, a);
  if (mid) gr.addColorStop(mid[0], mid[1]);
  gr.addColorStop(1, b);
  return gr;
}
