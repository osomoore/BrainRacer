/**
 * Texture baking: every part is drawn ONCE with Canvas 2D into a Phaser canvas texture and cached by key
 * (CLAUDE.md rule 15: never redraw rounded shapes per frame). Textures are drawn at Q x for sharpness when scaled up.
 */
import type Phaser from 'phaser';
import { type Pt, darken } from './geom';

export const Q = 1.5;
export const OUTLINE = '#1b1b3a';
/** Outline thickness (visible, outside the fill) at design scale. */
export const OL = 5;

export interface PartSpec {
  /** Unique cache key (must include every look parameter that changes the pixels). */
  key: string;
  /** Texture size in design units. */
  w: number;
  h: number;
  /** Position of the part origin inside the texture, design units. Drawing coords have (0,0) at this point. */
  ox: number;
  oy: number;
  draw: (g: CanvasRenderingContext2D) => void;
}

export function ensureTexture(scene: Phaser.Scene, spec: PartSpec): void {
  if (scene.textures.exists(spec.key)) return;
  const tex = scene.textures.createCanvas(spec.key, Math.ceil(spec.w * Q), Math.ceil(spec.h * Q));
  if (!tex) return;
  const g = tex.getContext();
  g.save();
  g.scale(Q, Q);
  g.translate(spec.ox, spec.oy);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  spec.draw(g);
  g.restore();
  tex.refresh();
}

/** Bake (if needed) and add an Image whose origin is the part origin, at design scale. */
export function partImage(scene: Phaser.Scene, spec: PartSpec, x = 0, y = 0): Phaser.GameObjects.Image {
  ensureTexture(scene, spec);
  return scene.add.image(x, y, spec.key).setOrigin(spec.ox / spec.w, spec.oy / spec.h).setScale(1 / Q);
}

/** A drawable shape: path builder + fill. Two passes give one clean outline around a union of shapes. */
export interface Shape {
  path: (g: CanvasRenderingContext2D) => void;
  fill: string | CanvasGradient | ((g: CanvasRenderingContext2D) => void);
  /** Skip the outline stroke for this shape (inner details). */
  noStroke?: boolean;
  /** Extra detail drawn clipped to the shape after the fill. */
  detail?: (g: CanvasRenderingContext2D) => void;
}

export function drawShapes(g: CanvasRenderingContext2D, shapes: readonly Shape[], ol = OL, color = OUTLINE): void {
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = color;
  g.lineWidth = ol * 2;
  for (const s of shapes) { if (s.noStroke) continue; g.beginPath(); s.path(g); g.stroke(); }
  for (const s of shapes) {
    g.save();
    g.beginPath();
    s.path(g);
    g.clip();
    if (typeof s.fill === 'function') s.fill(g); else { g.fillStyle = s.fill; g.fill(); }
    s.detail?.(g);
    g.restore();
  }
}

export function polyPath(g: CanvasRenderingContext2D, pts: readonly Pt[]): void {
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.closePath();
}

/** Closed polygon with rounded corners (radius r, clamped by edge length). */
export function roundedPolyPath(g: CanvasRenderingContext2D, pts: readonly Pt[], r: number | readonly number[]): void {
  const n = pts.length;
  const rad = (i: number) => (typeof r === 'number' ? r : r[i % r.length]);
  const mid = (a: Pt, b: Pt): Pt => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const m0 = mid(pts[n - 1], pts[0]);
  g.moveTo(m0.x, m0.y);
  for (let i = 0; i < n; i++) {
    const p = pts[i], nx = pts[(i + 1) % n], pv = pts[(i + n - 1) % n];
    const lim = Math.min(Math.hypot(p.x - pv.x, p.y - pv.y), Math.hypot(nx.x - p.x, nx.y - p.y)) / 2;
    const m = mid(p, nx);
    g.arcTo(p.x, p.y, m.x, m.y, Math.min(rad(i), lim));
  }
  g.closePath();
}

export function rrectPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

export function ellipsePath(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, rot = 0): void {
  g.moveTo(cx + rx * Math.cos(rot), cy + rx * Math.sin(rot));
  g.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
  g.closePath();
}

/** Vertical gradient between two colours. */
export function vgrad(g: CanvasRenderingContext2D, y0: number, y1: number, top: string, bottom: string): CanvasGradient {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, top);
  gr.addColorStop(1, bottom);
  return gr;
}

export const shadeOf = (c: string): string => darken(c, 0.25);
